/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  GEMINI_API_KEY?: string;
  APP_URL?: string;
}

function parseEnv(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const validNodeEnv = nodeEnv === 'production' ? 'production' : (nodeEnv === 'test' ? 'test' : 'development');
  
  const port = parseInt(process.env.PORT || '3000', 10);
  const validatedPort = isNaN(port) || port <= 0 ? 3000 : port;

  return {
    NODE_ENV: validNodeEnv,
    PORT: validatedPort,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim() || undefined,
    APP_URL: process.env.APP_URL?.trim() || undefined,
  };
}

export const env: EnvConfig = parseEnv();
