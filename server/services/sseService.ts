/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Response, Request } from 'express';

interface SseClient {
  id: string;
  res: Response;
  userId?: string;
  username?: string;
  ip: string;
  connectedAt: number;
  lastPingAt: number;
}

const clients: Map<string, SseClient> = new Map();
let lifetimeBroadcastCount = 0;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Initialize or maintain periodic keep-alive heartbeat
function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(`: heartbeat ${now}\n\n`);
        client.lastPingAt = now;
      } catch (err) {
        // Connection broken, remove
        try { client.res.end(); } catch (_) {}
        clients.delete(id);
      }
    }
  }, 15000);
}

/**
 * Register a new Server-Sent Events client connection
 */
export function registerSseClient(req: Request, res: Response): string {
  const clientId = 'sse_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const userId = (req.query.userId as string) || undefined;
  const username = (req.query.username as string) || undefined;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Flush headers immediately
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId, connectedAt: new Date().toISOString() })}\n\n`);

  const client: SseClient = {
    id: clientId,
    res,
    userId,
    username,
    ip,
    connectedAt: Date.now(),
    lastPingAt: Date.now()
  };

  clients.set(clientId, client);
  ensureHeartbeat();

  console.log(`[SSE] Client connected: ${clientId} (${username || 'anonymous'}, total: ${clients.size})`);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId} (total: ${clients.size})`);
  });

  return clientId;
}

/**
 * Broadcast an event to all active SSE clients
 */
export function broadcastEvent(eventType: string, payload: any) {
  lifetimeBroadcastCount++;
  const payloadWithMeta = (typeof payload === 'object' && payload !== null)
    ? { ...payload, type: eventType, eventType }
    : { data: payload, type: eventType, eventType };
  const dataString = JSON.stringify(payloadWithMeta);
  
  // Named SSE message for addEventListener(eventType)
  const namedMessage = `event: ${eventType}\ndata: ${dataString}\n\n`;
  // Generic SSE message for .onmessage
  const genericMessage = `data: ${dataString}\n\n`;

  const deadClients: string[] = [];

  for (const [id, client] of clients.entries()) {
    try {
      client.res.write(namedMessage);
      client.res.write(genericMessage);
    } catch (err) {
      deadClients.push(id);
    }
  }

  // Cleanup dead connections
  deadClients.forEach(id => {
    const client = clients.get(id);
    if (client) {
      try { client.res.end(); } catch (_) {}
      clients.delete(id);
    }
  });
}

/**
 * Get active SSE client statistics
 */
export function getSseStats() {
  return {
    activeConnections: clients.size,
    lifetimeBroadcastCount,
    connectedClients: Array.from(clients.values()).map(c => ({
      id: c.id,
      userId: c.userId,
      username: c.username,
      connectedDurationSec: Math.round((Date.now() - c.connectedAt) / 1000)
    }))
  };
}
