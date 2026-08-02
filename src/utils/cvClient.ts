import { PhotoQuad } from '../types';
import { detectPhotoQuads, prepareSheet, extractAndDeskewPhoto } from './cvEngine';
import { canvasToBlob, decodeBlob, hasOffscreenCanvas, release } from './canvasCompat';

/**
 * Front door to the image pipeline.
 *
 * Uses a Worker where the platform allows it, and runs the identical code
 * inline where it does not (no Worker, or no OffscreenCanvas - Safari below
 * 16.4). The fallback is the same functions, so behaviour cannot drift between
 * the two paths.
 */

export interface Crop {
  blob: Blob;
  width: number;
  height: number;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (done: number, total: number) => void;
};

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerBroken || !hasOffscreenCanvas || typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/cv.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;

      if (msg.type === 'progress') {
        entry.onProgress?.(msg.done, msg.total);
        return;
      }

      pending.delete(msg.id);
      if (msg.type === 'error') entry.reject(new Error(msg.message));
      else if (msg.type === 'detected') entry.resolve(msg.quads);
      else if (msg.type === 'extracted') entry.resolve(msg.crops);
    };

    // A worker that dies takes every in-flight request with it; fail those
    // loudly and fall back to inline work from then on.
    const fail = () => {
      workerBroken = true;
      for (const [, entry] of pending) entry.reject(new Error('image worker failed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
  } catch {
    workerBroken = true;
    return null;
  }

  return worker;
}

function call<T>(
  payload: Record<string, unknown>,
  transfer: Transferable[],
  onProgress?: (done: number, total: number) => void
): Promise<T> | null {
  const w = getWorker();
  if (!w) return null;

  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    w.postMessage({ id, ...payload }, transfer);
  });
}

/**
 * Runs `viaWorker`, falling back to `inline` if the worker is unavailable or
 * fails for any reason.
 *
 * A Worker can die for reasons that have nothing to do with the request - a
 * chunk fetch racing service-worker activation, memory pressure, a browser
 * quirk. None of those are the user's problem, and none of them mean the work
 * cannot be done; they just mean it has to happen on this thread instead. So a
 * worker failure degrades to inline processing rather than surfacing as
 * "detection failed".
 */
async function withWorkerFallback<T>(
  viaWorker: () => Promise<T> | null,
  inline: () => Promise<T>
): Promise<T> {
  try {
    const result = viaWorker();
    if (result) return await result;
  } catch (err) {
    console.warn('Image worker failed; continuing on the main thread.', err);
    workerBroken = true;
  }
  return inline();
}

/** Finds the photos on a sheet and the angle each one sits at. */
export async function detectPhotos(source: Blob, sensitivity: number): Promise<PhotoQuad[]> {
  return withWorkerFallback(
    () => {
      if (!getWorker() || typeof createImageBitmap !== 'function') return null;
      // Transferring hands the pixels over rather than copying them.
      return createImageBitmap(source).then(bitmap =>
        call<PhotoQuad[]>({ type: 'detect', bitmap, sensitivity }, [bitmap])
      );
    },
    async () => {
      const bitmap = await decodeBlob(source);
      try {
        return await detectPhotoQuads(bitmap, sensitivity);
      } finally {
        release(bitmap);
      }
    }
  );
}

/** Crops and rectifies every quad out of the sheet. */
export async function extractPhotos(
  source: Blob,
  quads: PhotoQuad[],
  onProgress?: (done: number, total: number) => void
): Promise<Crop[]> {
  return withWorkerFallback(
    () => {
      if (!getWorker() || typeof createImageBitmap !== 'function') return null;
      return createImageBitmap(source).then(bitmap =>
        call<Crop[]>({ type: 'extract', bitmap, quads }, [bitmap], onProgress)
      );
    },
    async () => {
      const bitmap = await decodeBlob(source);
      try {
        const pixels = prepareSheet(bitmap);
        if (!pixels) throw new Error('could not read sheet pixels');

        const crops: Crop[] = [];
        for (let i = 0; i < quads.length; i++) {
          const canvas = extractAndDeskewPhoto(pixels, quads[i]);
          if (!canvas) continue;
          crops.push({
            blob: await canvasToBlob(canvas, 'image/png'),
            width: canvas.width,
            height: canvas.height
          });
          onProgress?.(i + 1, quads.length);
          // Yield so the progress indicator can repaint on this fallback path.
          await new Promise(r => setTimeout(r, 0));
        }
        return crops;
      } finally {
        release(bitmap);
      }
    }
  );
}
