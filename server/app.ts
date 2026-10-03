/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Express } from 'express';
import { telemetryMiddleware, securityHeadersMiddleware, centralizedErrorHandler } from './core/middleware.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import memeRoutes from './routes/memeRoutes.js';
import failRoutes from './routes/failRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import birthdayRoutes from './routes/birthdayRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import spreadsheetRoutes from './routes/spreadsheetRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import { NotFoundError } from './core/errors.js';

export function createApp(): Express {
  const app = express();

  // Basic security headers
  app.use(securityHeadersMiddleware);

  // Body parsers with payload bounds for base64 / audio / images
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Telemetry & metrics tracking
  app.use(telemetryMiddleware);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), tier: 'enterprise' });
  });

  // Enterprise API route mounts
  app.use('/api/auth', authRoutes);
  app.use('/api/users', authRoutes); // Auth and user management routes
  app.use('/api/chat', chatRoutes);
  app.use('/api/conversations', chatRoutes); // Support /api/conversations/:id/messages
  app.use('/api/messages', chatRoutes); // Support /api/messages/:id
  app.use('/api/memes', memeRoutes);
  app.use('/api/fails', failRoutes);
  app.use('/api/failed-words', failRoutes); // Classroom 404 lexicon archive routes
  app.use('/api/notes', noteRoutes);
  app.use('/api/birthdays', birthdayRoutes);
  app.use('/api', noticeRoutes); // /api/notices and /api/polls
  app.use('/api/spreadsheet', spreadsheetRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api', telemetryRoutes); // /api/events/* and /api/system/*

  // 404 handler for API routes
  app.all('/api/*', (req, _res, next) => {
    next(new NotFoundError(`API endpoint not found: ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handling Middleware (MUST BE AT THE END OF API PIPELINE)
  app.use(centralizedErrorHandler);

  return app;
}
