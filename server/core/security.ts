/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitExceededError } from './errors.js';

/**
 * Sanitizes generic string inputs to remove dangerous executable HTML / script tags
 * while preserving valid typography and classroom text.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .trim();
}

/**
 * Validates and sanitizes standard text fields in an object recursively.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * In-memory sliding window rate limiter state tracker.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitBuckets = new Map<string, RateLimitRecord>();

/**
 * Cleans up stale rate limit entries periodically (every 5 minutes).
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitBuckets.entries()) {
    record.timestamps = record.timestamps.filter(t => now - t < 60000);
    if (record.timestamps.length === 0) {
      rateLimitBuckets.delete(key);
    }
  }
}, 300000);

/**
 * Rate limiting middleware generator.
 * @param windowMs Window duration in milliseconds (e.g., 60000 for 1 min)
 * @param maxRequests Maximum allowed requests per window
 * @param keyGenerator Function to extract identifier (IP / user ID)
 */
export function createRateLimiter(
  windowMs = 60000,
  maxRequests = 60,
  keyGenerator?: (req: Request) => string
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyGenerator
      ? keyGenerator(req)
      : (req.ip || req.headers['x-forwarded-for'] || 'anonymous').toString();
    
    const now = Date.now();
    let record = rateLimitBuckets.get(key);
    if (!record) {
      record = { timestamps: [] };
      rateLimitBuckets.set(key, record);
    }

    // Keep only timestamps within window
    record.timestamps = record.timestamps.filter(t => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      next(new RateLimitExceededError(`Rate limit exceeded (${maxRequests} req / ${windowMs / 1000}s). Try again shortly.`));
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
