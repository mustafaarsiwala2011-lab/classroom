/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { spreadsheetService } from '../services/spreadsheetService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/spreadsheet/config
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = spreadsheetService.getConfig();
  res.json(config);
}));

// POST /api/spreadsheet/sync
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const result = await spreadsheetService.syncGoogleSheet(req.body.url);
  res.json(result);
}));

// GET /api/spreadsheet/my-details
router.get('/my-details', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.query.userId || req.query.trNo || req.query.username || '');
  const trNo = String(req.query.trNo || '');
  const username = String(req.query.username || '');
  const name = String(req.query.name || '');
  const result = spreadsheetService.getMyDetails(userId, trNo, username, name);
  res.json(result);
}));

export default router;
