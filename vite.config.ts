import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Production server URL for Classroom Hub (used by default for static APK builds)
const DEFAULT_PRODUCTION_API_URL = 'https://ais-pre-upvakm2w6fxksdstlk4amx-204475641904.asia-east1.run.app';

export default defineConfig(({mode, command}) => {
  // Load environment variables from .env files and process.env
  const env = loadEnv(mode, process.cwd(), '');

  // Determine target API URL:
  // - If VITE_API_URL is explicitly set, use it.
  // - If running dev server (command === 'serve'), default to empty string so requests hit local Express server.
  // - If building static production assets (e.g. for Android APK / Capacitor), automatically route to the live production server.
  const isDev = command === 'serve' || mode === 'development';
  const targetApiUrl = (env.VITE_API_URL || (isDev ? '' : (env.APP_URL || DEFAULT_PRODUCTION_API_URL))).replace(/\/$/, '');

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(targetApiUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
