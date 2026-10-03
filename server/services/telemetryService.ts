/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'SSE' | 'AUTH';
  message: string;
  meta?: Record<string, any>;
}

const serverStartTime = Date.now();
const MAX_LOGS = 200;
const rollingLogs: LogEntry[] = [];

// Request telemetry counters
let totalRequests = 0;
let status2xx = 0;
let status4xx = 0;
let status5xx = 0;
let peakMemoryMb = 0;
const latencySamples: number[] = [];
const routeHitMap: Map<string, number> = new Map();
const recentRequestTimestamps: number[] = [];

/**
 * Add structured log entry to the rolling buffer
 */
export function logSystem(level: LogEntry['level'], message: string, meta?: Record<string, any>) {
  const entry: LogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    level,
    message,
    meta
  };

  rollingLogs.push(entry);
  if (rollingLogs.length > MAX_LOGS) {
    rollingLogs.shift();
  }

  // Console output
  const prefix = `[${entry.timestamp}] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, meta || '');
  } else if (level === 'WARN') {
    console.warn(prefix, message, meta || '');
  } else {
    console.log(prefix, message, meta || '');
  }
}

/**
 * Record incoming HTTP request for telemetry metrics
 */
export function recordRequestMetrics(method: string, route: string, statusCode: number, durationMs: number) {
  totalRequests++;
  const now = Date.now();
  recentRequestTimestamps.push(now);

  // Clean request timestamps older than 60s
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < now - 60000) {
    recentRequestTimestamps.shift();
  }

  if (statusCode >= 200 && statusCode < 400) {
    status2xx++;
  } else if (statusCode >= 400 && statusCode < 500) {
    status4xx++;
  } else if (statusCode >= 500) {
    status5xx++;
  }

  // Latency samples (keep last 100)
  latencySamples.push(durationMs);
  if (latencySamples.length > 100) {
    latencySamples.shift();
  }

  // Route hits
  const normalizedRoute = route.split('?')[0];
  const currentHits = routeHitMap.get(normalizedRoute) || 0;
  routeHitMap.set(normalizedRoute, currentHits + 1);

  // Update memory peak
  const memRss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  if (memRss > peakMemoryMb) {
    peakMemoryMb = memRss;
  }
}

/**
 * Get comprehensive High-Tech System Health
 */
export function getSystemHealthReport(dbData: any, sseConnections: number) {
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.round((Date.now() - serverStartTime) / 1000);

  const counts = {
    users: Object.keys(dbData?.users || {}).length,
    messages: (dbData?.messages || []).length,
    notes: (dbData?.notes || []).length,
    memes: (dbData?.memes || []).length,
    failedWords: (dbData?.failedWords || []).length,
    notices: (dbData?.notices || []).length,
    polls: (dbData?.polls || []).length,
    events: (dbData?.events || []).length,
  };

  return {
    status: 'ok',
    uptimeSeconds,
    uptimeHuman: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      externalMb: Math.round(memory.external / 1024 / 1024),
    },
    counts,
    sseConnections,
    nodeEnv: process.env.NODE_ENV || 'development',
    os: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024)
    },
    timestamp: new Date().toISOString(),
    version: '2.5.0-hightech'
  };
}

/**
 * Get Real-Time System Metrics & Performance Statistics
 */
export function getSystemMetricsReport() {
  const avgLatency = latencySamples.length > 0
    ? Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length)
    : 0;

  const topRoutes = Array.from(routeHitMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([route, hits]) => ({ route, hits }));

  return {
    totalRequests,
    requestsPerMinute: recentRequestTimestamps.length,
    statusCodes: {
      '2xx': status2xx,
      '4xx': status4xx,
      '5xx': status5xx,
    },
    avgLatencyMs: avgLatency,
    peakMemoryMb,
    topRoutes
  };
}

/**
 * Get filtered system logs
 */
export function getSystemLogsReport(limit = 100, levelFilter?: string) {
  let logs = [...rollingLogs];
  if (levelFilter && levelFilter !== 'ALL') {
    logs = logs.filter(l => l.level === levelFilter);
  }
  return logs.slice(-limit).reverse();
}
