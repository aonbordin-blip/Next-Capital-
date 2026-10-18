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

// Ensure broken dev service worker is removed if present
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (reg.active && reg.active.scriptURL.includes('dev-sw')) {
        reg.unregister();
      }
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
