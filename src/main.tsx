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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
