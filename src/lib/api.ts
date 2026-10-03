/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live production server URL for Classroom Hub.
 * Used as default target for static APK, Android WebView, Cordova/Capacitor, or file:// environments.
 */
export const DEFAULT_PRODUCTION_API_URL = 'https://ais-pre-upvakm2w6fxksdstlk4amx-204475641904.asia-east1.run.app';

/**
 * Detects if the current application is running inside an Android APK, WebView, Capacitor, Cordova, or file:// protocol.
 */
export function isStandaloneOrApkEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  const origin = window.location.origin;
  return (
    protocol === 'file:' ||
    origin === 'null' ||
    protocol.startsWith('capacitor') ||
    protocol.startsWith('ionic') ||
    (typeof navigator !== 'undefined' && /wv|Android.*Version\/[\d.]+/i.test(navigator.userAgent))
  );
}

/**
 * Adaptable API Base URL configuration and helper for Web & Android APK runtimes.
 * If VITE_API_URL is configured (e.g. for standalone Android APK / Capacitor / Cordova),
 * API requests will target the remote server. When empty in a standard web browser,
 * relative paths (/api/...) are used.
 */
function resolveApiBaseUrl(): string {
  const configured = ((import.meta as any)?.env?.VITE_API_URL as string | undefined)?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  // Automatically route to live production server if executing within an Android APK or WebView
  if (isStandaloneOrApkEnvironment()) {
    return DEFAULT_PRODUCTION_API_URL;
  }
  return '';
}

export const API_BASE_URL: string = resolveApiBaseUrl();

/**
 * Returns a fully qualified or relative API endpoint URL.
 */
export function getApiUrl(path: string): string {
  const activeBase = API_BASE_URL || (isStandaloneOrApkEnvironment() ? DEFAULT_PRODUCTION_API_URL : '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${activeBase}${normalizedPath}`;
}

export const apiUrl = getApiUrl;

/**
 * Adaptable fetch wrapper that ensures any endpoint connects to VITE_API_URL if configured.
 */
export function apiFetch(endpoint: string | RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const activeBase = API_BASE_URL || (isStandaloneOrApkEnvironment() ? DEFAULT_PRODUCTION_API_URL : '');
  if (typeof endpoint === 'string') {
    if (endpoint.startsWith('/api/') || endpoint.startsWith('api/')) {
      const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = activeBase ? `${activeBase}${normalizedPath}` : normalizedPath;
      return window.fetch(url, options);
    }
    const url = endpoint.startsWith('/') && activeBase ? `${activeBase}${endpoint}` : endpoint;
    return window.fetch(url, options);
  }
  return window.fetch(endpoint, options);
}

/**
 * Install global fetch patch so that all native fetch('/api/...') calls
 * in every component automatically route through VITE_API_URL in standalone APK mode.
 */
export function setupApiProxy(): void {
  if (typeof window === 'undefined') return;
  const activeBase = API_BASE_URL || (isStandaloneOrApkEnvironment() ? DEFAULT_PRODUCTION_API_URL : '');
  if (activeBase) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let resolvedInput = input;
      if (typeof input === 'string') {
        if (input.startsWith('/api/') || input.startsWith('api/')) {
          const path = input.startsWith('/') ? input : `/${input}`;
          resolvedInput = `${activeBase}${path}`;
        }
      } else if (input instanceof Request) {
        try {
          const urlObj = new URL(input.url, window.location.href);
          if (urlObj.pathname.startsWith('/api/')) {
            resolvedInput = new Request(`${activeBase}${urlObj.pathname}${urlObj.search}`, input);
          }
        } catch {
          if (input.url.startsWith('/api/')) {
            resolvedInput = new Request(`${activeBase}${input.url}`, input);
          }
        }
      }
      return originalFetch(resolvedInput, init);
    };
    console.log(`[API Bridge] Remote API host configured for Android APK: ${activeBase}`);
  }
}
