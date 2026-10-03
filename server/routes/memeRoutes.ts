/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { memeService } from '../services/memeService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/memes
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const memes = memeService.getAllMemes();
  res.json({ memes });
}));

// POST /api/memes
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const meme = memeService.createMeme(req.body);
  res.status(201).json({ meme, ...meme });
}));

// DELETE /api/memes/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requesterId = String(req.query.requesterId || req.body.requesterId || '');
  const deleted = memeService.deleteMeme(req.params.id, requesterId);
  res.json({ success: deleted, id: req.params.id, memeId: req.params.id });
}));

export default router;
