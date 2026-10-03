/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  getSystemHealthReport,
  getSystemMetricsReport,
  getSystemLogsReport,
  logSystem,
} from '../services/telemetryService.js';
import { registerSseClient, getSseStats, broadcastEvent } from '../services/sseService.js';
import { userRepository } from '../repositories/userRepository.js';
import { dbEngine } from '../repositories/db.js';
import { asyncHandler } from '../core/middleware.js';
import { ValidationError, ForbiddenError } from '../core/errors.js';

const router = Router();

// GET /api/events/stream
router.get('/events/stream', (req: Request, res: Response) => {
  registerSseClient(req, res);
});

// GET /api/events/stats
router.get('/events/stats', (_req: Request, res: Response) => {
  res.json(getSseStats());
});

// GET /api/system/health
router.get('/system/health', asyncHandler(async (_req: Request, res: Response) => {
  const db = userRepository.getRawDb();
  const sseStats = getSseStats();
  const report = getSystemHealthReport(db, sseStats.activeConnections);
  res.json(report);
}));

// GET /api/system/metrics
router.get('/system/metrics', asyncHandler(async (_req: Request, res: Response) => {
  res.json(getSystemMetricsReport());
}));

// GET /api/system/logs
router.get('/system/logs', asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const level = req.query.level ? String(req.query.level) : undefined;
  res.json({ logs: getSystemLogsReport(limit, level) });
}));

// GET /api/system/backup/export
router.get('/system/backup/export', asyncHandler(async (_req: Request, res: Response) => {
  const db = userRepository.getRawDb();
  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: '3.0.0-enterprise',
    checksum: Buffer.from(JSON.stringify(db)).toString('base64').slice(0, 32),
    data: db,
  };
  logSystem('AUTH', 'Full database snapshot exported');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="classroom-backup-${Date.now()}.json"`);
  res.json(snapshot);
}));

// POST /api/system/backup/import
router.post('/system/backup/import', asyncHandler(async (req: Request, res: Response) => {
  const { data, authorizedBy } = req.body;
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Valid database data object is required');
  }

  const user = userRepository.findByUsername(String(authorizedBy || ''));
  if (!user || user.username.toLowerCase() !== 'admin') {
    throw new ForbiddenError('Unauthorized. Only admin can restore snapshots.');
  }

  dbEngine.save(data);
  logSystem('AUTH', `Database snapshot restored by administrator (${authorizedBy})`);
  broadcastEvent('system_restored', { timestamp: new Date().toISOString() });
  res.json({ success: true, message: 'Snapshot successfully restored' });
}));

export default router;
