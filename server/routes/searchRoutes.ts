/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { executeUniversalSearch } from '../services/searchService.js';
import { userRepository } from '../repositories/userRepository.js';
import { asyncHandler } from '../core/middleware.js';

const router = Router();

// GET /api/search
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const db = userRepository.getRawDb();
  const results = executeUniversalSearch(q, db);
  res.json({ query: q, total: results.length, results });
}));

export default router;
