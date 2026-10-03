/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { noteService } from '../services/noteService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/notes
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const notes = noteService.getAllNotes();
  res.json({ notes });
}));

// POST /api/notes
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const note = noteService.createNote(req.body);
  res.status(201).json({ note, ...note });
}));

// PUT /api/notes/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const note = noteService.updateNote(req.params.id, req.body);
  res.json({ note, ...note });
}));

// DELETE /api/notes/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = noteService.deleteNote(req.params.id);
  res.json({ success: deleted, id: req.params.id });
}));

export default router;
