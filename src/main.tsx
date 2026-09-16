import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for Background Push Notifications & PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (registration) => {
        console.log('PWA Service Worker registered with scope:', registration.scope);
        // Register periodic background sync if supported by OS/browser
        if ('periodicSync' in registration) {
          try {
            const status = await (navigator as any).permissions?.query({
              name: 'periodic-background-sync',
            });
            if (status?.state === 'granted') {
              await (registration as any).periodicSync.register('budget-periodic-refresh', {
                minInterval: 60 * 60 * 1000, // 1 hour
              });
              console.log('Periodic Background Sync registered successfully');
            }
          } catch (e) {
            // Periodic sync not permitted or not supported in this context
          }
        }
      })
      .catch((error) => {
        console.warn('PWA Service Worker registration error:', error);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
