import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Clean up any stale or conflicting Service Workers & caches that cause blank white screens
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key).catch(() => {});
      }
    }).catch(() => {});
  }
}

// Safely mount React application
const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    const root = createRoot(rootEl);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err) {
    console.error('Fatal mount error:', err);
    rootEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; padding: 1.5rem; background: #cae8fe;">
        <div style="background: white; border-radius: 20px; padding: 2rem; max-width: 400px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;">
          <h2 style="font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Next Capital MotoLease</h2>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">กำลังรีเฟรชระบบ กรุณากดปุ่มเพื่อโหลดข้อมูลใหม่</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="background: #0284c7; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-weight: bold; font-size: 13px; cursor: pointer;">
            รีเฟรชหน้าเว็บใหม่
          </button>
        </div>
      </div>
    `;
  }
}
