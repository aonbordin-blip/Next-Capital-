import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PROMPT_FONT_EMBED_CSS } from './data/promptFontBase64';

// Inject inlined Prompt base64 web font so text metrics and typography are 100% identical in preview and export
if (typeof document !== 'undefined') {
  if (!document.getElementById('ncap-prompt-font-embedded')) {
    const style = document.createElement('style');
    style.id = 'ncap-prompt-font-embedded';
    style.textContent = PROMPT_FONT_EMBED_CSS;
    document.head.appendChild(style);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
