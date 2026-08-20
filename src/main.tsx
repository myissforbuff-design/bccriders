// Make window.fetch assignable (writable via getter/setter) to prevent getter-only TypeError when polyfills reassign fetch
if (typeof window !== 'undefined' && window.fetch) {
  try {
    let currentFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: () => currentFetch,
      set: (fn) => { currentFetch = fn; },
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    try {
      if (window.Window && window.Window.prototype) {
        let currentFetchProto = window.fetch;
        Object.defineProperty(window.Window.prototype, 'fetch', {
          get: () => currentFetchProto,
          set: (fn) => { currentFetchProto = fn; },
          configurable: true,
          enumerable: true,
        });
      }
    } catch (err) {
      // ignore
    }
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA offline capabilities and installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker successfully registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
