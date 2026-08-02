/**
 * Service worker registration and offline-readiness reporting.
 *
 * The app has always claimed to work offline. That was true only until you
 * refreshed the tab, at which point the browser had to fetch the bundle again
 * and there was nothing to fetch it from. Precaching the build closes that gap,
 * and this module lets the UI state honestly whether the gap is closed *on this
 * device right now* rather than asserting it in the abstract.
 */

export type OfflineStatus = 'unsupported' | 'installing' | 'ready' | 'failed';

let status: OfflineStatus = 'unsupported';
const listeners = new Set<(s: OfflineStatus) => void>();

function setStatus(next: OfflineStatus) {
  status = next;
  for (const listener of listeners) listener(next);
}

export function getOfflineStatus(): OfflineStatus {
  return status;
}

export function onOfflineStatusChange(listener: (s: OfflineStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // The dev server serves modules individually and has no built sw.js, so
  // registering there would only cache a half-built app.
  if (import.meta.env.DEV) return;

  setStatus('installing');

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // Resolve against the document, not this module: the bundle lives in
      // assets/ while sw.js sits at the site root, and a worker's scope cannot
      // extend above its own directory.
      .register(new URL('sw.js', window.location.href).href, { scope: './' })
      .then(registration => {
        if (registration.active && !registration.installing && !registration.waiting) {
          setStatus('ready');
          return;
        }
        const worker = registration.installing ?? registration.waiting;
        if (!worker) {
          setStatus('ready');
          return;
        }
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') setStatus('ready');
          else if (worker.state === 'redundant') setStatus('failed');
        });
      })
      .catch(err => {
        console.warn('Offline install unavailable:', err);
        setStatus('failed');
      });
  });
}
