/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.js';
import { env } from './server/config/env.js';
import { logSystem } from './server/services/telemetryService.js';

async function startServer(): Promise<void> {
  const app = createApp();
  const PORT = env.PORT;

  // Mount Vite development middleware or static production handler
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logSystem('INFO', 'Vite development middleware mounted successfully');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logSystem('INFO', `Serving static production build from ${distPath}`);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Enterprise Backend] Classroom Hub API & Web Server running on http://localhost:${PORT}`);
    logSystem('INFO', `Backend server started on port ${PORT} [Node: ${process.version}, Env: ${env.NODE_ENV}]`);
  });

  // Graceful shutdown handling
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Gracefully shutting down enterprise server...`);
    logSystem('INFO', `Server shutting down via ${signal}`);
    server.close(() => {
      console.log('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force shutdown after timeout if pending connections hang
    setTimeout(() => {
      console.error('Forcefully terminating process after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[CRITICAL] Failed to start backend server:', err);
  process.exit(1);
});
