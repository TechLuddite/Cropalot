/// <reference lib="webworker" />

import { PhotoQuad } from '../types';
import { detectPhotoQuads, prepareSheet, extractAndDeskewPhoto } from '../utils/cvEngine';
import { canvasToBlob } from '../utils/canvasCompat';

/**
 * Detection and rectification, off the main thread.
 *
 * Both are heavy pixel loops - a homography inverse-map touches every output
 * pixel - and running them inline froze the tab for seconds on a large flatbed
 * scan, with no way to paint a spinner because the thread that would paint it
 * was busy. The sheet arrives as a transferred ImageBitmap, so no pixel data is
 * copied across the boundary.
 */

type Request =
  | { id: number; type: 'detect'; bitmap: ImageBitmap; sensitivity: number }
  | { id: number; type: 'extract'; bitmap: ImageBitmap; quads: PhotoQuad[] };

type Response =
  | { id: number; type: 'detected'; quads: PhotoQuad[] }
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'extracted'; crops: { blob: Blob; width: number; height: number }[] }
  | { id: number; type: 'error'; message: string };

const post = (message: Response) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;

  try {
    if (request.type === 'detect') {
      const quads = await detectPhotoQuads(request.bitmap, request.sensitivity);
      request.bitmap.close();
      post({ id: request.id, type: 'detected', quads });
      return;
    }

    if (request.type === 'extract') {
      const pixels = prepareSheet(request.bitmap);
      request.bitmap.close();
      if (!pixels) throw new Error('could not read sheet pixels');

      const crops: { blob: Blob; width: number; height: number }[] = [];

      for (let i = 0; i < request.quads.length; i++) {
        const canvas = extractAndDeskewPhoto(pixels, request.quads[i]);
        if (!canvas) continue;

        // PNG for the stored master: it is the archival copy every export is
        // rendered from, so it must not accumulate lossy generations.
        const blob = await canvasToBlob(canvas, 'image/png');
        crops.push({ blob, width: canvas.width, height: canvas.height });

        post({ id: request.id, type: 'progress', done: i + 1, total: request.quads.length });
      }

      post({ id: request.id, type: 'extracted', crops });
      return;
    }
  } catch (err) {
    post({
      id: (request as { id: number }).id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};
