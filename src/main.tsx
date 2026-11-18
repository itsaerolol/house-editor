import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { useStore } from './store/store';
import { startWorkers } from './render/workerPool';
import { landBatched } from './viewport/renderBus';

// paint textures and build furniture off the main thread from the first frame
startWorkers(landBatched);

// installable PWA: cache the app for offline use (skipped in dev and where service workers are blocked)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// Safari pinch-zooms the whole page unless told not to; the canvas owns pinch
document.addEventListener('gesturestart', (e) => e.preventDefault());

// handy for debugging and automated checks
(window as unknown as { __store: typeof useStore }).__store = useStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
