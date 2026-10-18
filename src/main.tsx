import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Safely inject inlined Prompt font if needed for export without blocking DOM mount
if (typeof document !== 'undefined') {
  try {
    if (!document.getElementById('ncap-prompt-font-embedded')) {
      import('./data/promptFontBase64').then(({ PROMPT_FONT_EMBED_CSS }) => {
        try {
          const style = document.createElement('style');
          style.id = 'ncap-prompt-font-embedded';
          style.textContent = PROMPT_FONT_EMBED_CSS;
          document.head.appendChild(style);
        } catch {
          // ignore
        }
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Ensure any old or broken service worker is completely removed and caches cleaned
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  } catch {
    // ignore
  }
  if ('caches' in window) {
    try {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(() => {});
        }
      }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
