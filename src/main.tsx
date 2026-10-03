import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setupApiProxy} from './lib/api.ts';

// Initialize remote API routing for standalone Android APK / WebView if VITE_API_URL is configured
setupApiProxy();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
