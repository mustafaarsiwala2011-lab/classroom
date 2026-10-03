/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { noticeService } from '../services/noticeService.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/notices
router.get('/notices', asyncHandler(async (_req: Request, res: Response) => {
  const notices = noticeService.getAllNotices();
  res.json({ notices });
}));

// POST /api/notices
router.post('/notices', asyncHandler(async (req: Request, res: Response) => {
  const notice = noticeService.createNotice(req.body);
  res.status(201).json(notice);
}));

// DELETE /api/notices/:id
router.delete('/notices/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.query.userId || req.body.userId || '');
  const deleted = noticeService.deleteNotice(req.params.id, userId);
  res.json({ success: deleted, id: req.params.id });
}));

// GET /api/polls
router.get('/polls', asyncHandler(async (_req: Request, res: Response) => {
  const polls = noticeService.getAllPolls();
  res.json({ polls });
}));

// POST /api/polls
router.post('/polls', asyncHandler(async (req: Request, res: Response) => {
  const poll = noticeService.createPoll(req.body);
  res.status(201).json(poll);
}));

// POST /api/polls/:id/vote
router.post('/polls/:id/vote', asyncHandler(async (req: Request, res: Response) => {
  const poll = noticeService.votePoll(req.params.id, req.body);
  res.json(poll);
}));

export default router;
