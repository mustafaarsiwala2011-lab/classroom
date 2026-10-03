/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from './errors.js';
import { recordRequestMetrics, logSystem } from '../services/telemetryService.js';

/**
 * Higher-order function that wraps async Express routes to eliminate boilerplate try/catch blocks
 * and route any unhandled rejections straight to the centralized error handler.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Enterprise Telemetry & Request Latency Middleware
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const urlPath = req.originalUrl || req.url;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    recordRequestMetrics(req.method, urlPath, res.statusCode, durationMs);
    
    if (res.statusCode >= 500) {
      logSystem('ERROR', `[HTTP ${res.statusCode}] ${req.method} ${urlPath} completed in ${durationMs}ms`);
    } else if (res.statusCode >= 400 && res.statusCode !== 404) {
      logSystem('WARN', `[HTTP ${res.statusCode}] ${req.method} ${urlPath} validation/auth failure (${durationMs}ms)`);
    }
  });

  next();
}

/**
 * Basic Security Headers and CORS Middleware (enables cross-origin requests from Android APK / WebView)
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle CORS preflight options request immediately
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

/**
 * Centralized Typed Error Handler Middleware
 */
export function centralizedErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.errorCode,
      statusCode: err.statusCode,
      details: err.details || undefined,
      ...(typeof err.details === 'object' && err.details !== null ? err.details : {}),
      timestamp: new Date().toISOString(),
      path: req.originalUrl || req.url,
    });
    return;
  }

  // Handle generic syntax errors or unexpected exceptions
  const isSyntaxError = err instanceof SyntaxError;
  const statusCode = isSyntaxError ? 400 : 500;
  const errorCode = isSyntaxError ? 'MALFORMED_JSON_PAYLOAD' : 'INTERNAL_SERVER_ERROR';
  const message = isSyntaxError ? 'Malformed JSON payload' : 'An unexpected internal server error occurred';

  logSystem('ERROR', `Unhandled Exception: ${err.message}`, { stack: err.stack, path: req.originalUrl });

  res.status(statusCode).json({
    error: message,
    code: errorCode,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl || req.url,
  });
}
