/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { asyncHandler } from '../core/middleware.js';
import { createRateLimiter } from '../core/security.js';

const router = Router();

// Rate limiter for authentication attempts (30 requests per minute)
const authLimiter = createRateLimiter(60000, 30);

// POST /api/auth/login
router.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = authService.login(req.body);
  res.json(result);
}));

// POST /api/auth/google-login
router.post('/google-login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = authService.googleLogin(req.body);
  res.json(result);
}));

// POST /api/auth/change-password
router.post('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.changePassword(req.body);
  res.json(result);
}));

// GET /api/auth/resolve-identity?q=...
router.get('/resolve-identity', asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  const user = authService.resolveIdentity(q);
  res.json({ user });
}));

// GET /api/users
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const users = authService.getAllUsers();
  res.json({ users });
}));

// GET /api/users/requests
router.get('/requests', asyncHandler(async (req: Request, res: Response) => {
  const authorizedBy = String(req.query.authorizedBy || req.headers['x-authorized-by'] || '');
  const requests = authService.getAllRequests(authorizedBy);
  res.json({ requests });
}));

// PUT /api/users/profile
router.put('/profile', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.updateProfile(req.body);
  res.json(result);
}));

// POST /api/users/update-profile (alias)
router.post('/update-profile', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.updateProfile(req.body);
  res.json(result);
}));

// POST /api/users/approve
router.post('/approve', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.approveUser(req.body);
  res.json(result);
}));

// POST /api/users/request-permission
router.post('/request-permission', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.requestPermission(req.body);
  res.json(result);
}));

// POST /api/users/toggle-meme-master
router.post('/toggle-meme-master', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.toggleMemeMaster(req.body);
  res.json(result);
}));

// POST /api/users/toggle-fail-master
router.post('/toggle-fail-master', asyncHandler(async (req: Request, res: Response) => {
  const result = authService.toggleFailMaster(req.body);
  res.json(result);
}));

export default router;
