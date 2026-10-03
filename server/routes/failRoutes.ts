/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { failService } from '../services/failService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/fails
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const failedWords = failService.getAllFailedWords();
  res.json({ failedWords });
}));

// POST /api/fails & /api/failed-words
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const fail = failService.createFailedWord(req.body);
  res.status(201).json({ failedWord: fail, ...fail });
}));

// PUT /api/fails/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const fail = failService.updateFailedWord(req.params.id, req.body);
  res.json({ failedWord: fail });
}));

// DELETE /api/fails/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requesterId = String(req.query.requesterId || req.body.requesterId || '');
  const deleted = failService.deleteFailedWord(req.params.id, requesterId);
  res.json({ success: deleted, id: req.params.id });
}));

// POST /api/fails/:id/react
router.post('/:id/react', asyncHandler(async (req: Request, res: Response) => {
  const fail = failService.reactToFailedWord(req.params.id, req.body);
  res.json({ failedWord: fail });
}));

export default router;
