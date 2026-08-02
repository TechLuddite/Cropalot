/**
 * Canvas helpers that work identically on the main thread and inside a Worker.
 *
 * A Worker has no DOM, so `document.createElement('canvas')` is unavailable
 * there. OffscreenCanvas exists in both contexts, so the image pipeline is
 * written against it and falls back to a DOM canvas only where OffscreenCanvas
 * is missing (Safari below 16.4).
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** True when this context can run the pipeline without touching the DOM. */
export const hasOffscreenCanvas =
  typeof OffscreenCanvas !== 'undefined' &&
  typeof OffscreenCanvas.prototype.convertToBlob === 'function';

export function createCanvas(width: number, height: number): AnyCanvas {
  if (hasOffscreenCanvas) return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

export function get2d(
  canvas: AnyCanvas,
  options?: CanvasRenderingContext2DSettings
): AnyContext2D | null {
  return canvas.getContext('2d', options) as AnyContext2D | null;
}

export async function canvasToBlob(
  canvas: AnyCanvas,
  type = 'image/png',
  quality?: number
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('encoding failed'))),
      type,
      quality
    );
  });
}

/** Anything the pipeline knows how to draw from. */
export type DrawableSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

/** Decodes a Blob, preferring ImageBitmap so Workers can use it too. */
export async function decodeBlob(blob: Blob): Promise<DrawableSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }
  if (typeof document === 'undefined') throw new Error('cannot decode image in this context');

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Releases an ImageBitmap's memory immediately rather than waiting for GC. */
export function release(source: DrawableSource): void {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close();
}
