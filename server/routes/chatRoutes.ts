/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { chatService } from '../services/chatService.js';
import { asyncHandler } from '../core/middleware.js';
import { createRateLimiter } from '../core/security.js';

const router = Router();

// Chat posting rate limiter (120 req / min)
const chatLimiter = createRateLimiter(60000, 120);

// GET /api/chat or GET /api/chat/messages
router.get(['/', '/messages'], asyncHandler(async (req: Request, res: Response) => {
  const conversationId = req.query.conversationId ? String(req.query.conversationId) : 'conv_general';
  const messages = chatService.getMessages(conversationId);
  res.json({ messages });
}));

// POST /api/chat or POST /api/chat/messages
router.post(['/', '/messages'], chatLimiter, asyncHandler(async (req: Request, res: Response) => {
  const conversationId = req.body.conversationId || 'conv_general';
  const message = chatService.postMessage(conversationId, req.body);
  res.status(201).json({ message, ...message });
}));

// GET /api/chat/conversations or GET /api/conversations
router.get(['/conversations', '/conversations/'], asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const conversations = chatService.getConversations(userId);
  res.json({ conversations });
}));

// POST /api/chat/conversations or POST /api/conversations
router.post(['/conversations', '/conversations/'], asyncHandler(async (req: Request, res: Response) => {
  const result = chatService.createConversation(req.body);
  res.status(result.isExisting ? 200 : 201).json(result);
}));

// GET /api/conversations/:id/messages or GET /api/chat/conversations/:id/messages
router.get(['/conversations/:id/messages', '/:id/messages'], asyncHandler(async (req: Request, res: Response) => {
  const conversationId = req.params.id || 'conv_general';
  const messages = chatService.getMessages(conversationId);
  res.json({ messages });
}));

// POST /api/conversations/:id/messages or POST /api/chat/conversations/:id/messages
router.post(['/conversations/:id/messages', '/:id/messages'], chatLimiter, asyncHandler(async (req: Request, res: Response) => {
  const conversationId = req.params.id || req.body.conversationId || 'conv_general';
  const message = chatService.postMessage(conversationId, req.body);
  res.status(201).json({ message, ...message });
}));

// POST /api/chat/typing
router.post('/typing', asyncHandler(async (req: Request, res: Response) => {
  const result = chatService.setTyping(req.body);
  res.json(result);
}));

// GET /api/chat/typing/:conversationId
router.get('/typing/:conversationId', asyncHandler(async (req: Request, res: Response) => {
  const typers = chatService.getActiveTypers(req.params.conversationId);
  res.json({ typers });
}));

// POST /api/chat/presence
router.post('/presence', asyncHandler(async (req: Request, res: Response) => {
  const result = chatService.updatePresence(req.body);
  res.json(result);
}));

// POST /api/chat/read
router.post('/read', asyncHandler(async (req: Request, res: Response) => {
  const { conversationId, userId, userName, messageIds } = req.body;
  if (conversationId && userId) {
    const result = chatService.markAsRead(conversationId, userId, userName, messageIds);
    return res.json({ success: true, ...result });
  }
  res.json({ success: true });
}));

// POST /api/chat/status
router.post('/status', asyncHandler(async (req: Request, res: Response) => {
  const { messageId, messageIds, status } = req.body;
  const targetIds = messageIds || (messageId ? [messageId] : []);
  const updated: any[] = [];
  for (const id of targetIds) {
    const resMsg = chatService.updateMessageStatus(id, status);
    if (resMsg) updated.push(resMsg);
  }
  res.json({ success: true, count: updated.length, messages: updated });
}));

// POST /api/messages/:id/status or POST /api/chat/messages/:id/status
router.post(['/messages/:id/status', '/:id/status'], asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const updated = chatService.updateMessageStatus(req.params.id, status);
  res.json({ success: Boolean(updated), message: updated });
}));

// PUT /api/messages/:id or PUT /api/chat/messages/:id or PUT /api/chat/:id
router.put(['/messages/:id', '/:id'], asyncHandler(async (req: Request, res: Response) => {
  const message = chatService.editMessage(req.params.id, req.body);
  res.json({ message, ...message });
}));

// DELETE /api/messages/:id or DELETE /api/chat/messages/:id or DELETE /api/chat/:id
router.delete(['/messages/:id', '/:id'], asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.query.userId || req.body.userId || '');
  const username = String(req.query.username || req.body.username || '');
  const email = String(req.query.email || req.body.email || '');
  const deleted = chatService.deleteMessage(req.params.id, userId, username, email);
  res.json({ success: deleted, id: req.params.id });
}));

// POST /api/messages/:id/reactions or POST /api/chat/messages/:id/reactions
router.post(['/messages/:id/reactions', '/:id/reactions'], asyncHandler(async (req: Request, res: Response) => {
  const result = chatService.toggleReaction(req.params.id, req.body);
  res.json(result);
}));

export default router;
