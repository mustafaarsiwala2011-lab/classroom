/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { birthdayService } from '../services/birthdayService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/birthdays
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const events = birthdayService.getAllEvents();
  res.json({ events });
}));

// POST /api/birthdays
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const event = birthdayService.createEvent(req.body);
  res.status(201).json(event);
}));

// PUT /api/birthdays/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const event = birthdayService.updateEvent(req.params.id, req.body);
  res.json(event);
}));

// DELETE /api/birthdays/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = birthdayService.deleteEvent(req.params.id);
  res.json({ success: deleted, id: req.params.id });
}));

export default router;
