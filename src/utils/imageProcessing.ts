import { FilterSettings, OutputFormat } from '../types';
import { PhotoRecord } from './photoStore';
import { parseCaptureDate, withExif } from './exif';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/** Thumbnails are for the gallery grid only; exports always re-render from the original. */
export const THUMB_MAX_DIM = 420;

const MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

const EXTENSION: Record<OutputFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp'
};

export function extensionFor(format: OutputFormat): string {
  return EXTENSION[format] ?? 'png';
}

/** Decodes a Blob to an ImageBitmap, falling back to <img> where unsupported. */
async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to the <img> path */
    }
  }
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

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('encoding failed'))),
      MIME[format],
      format === 'png' ? undefined : quality
    );
  });
}

export interface RenderOptions {
  filters: FilterSettings;
  rotation?: number;
  /** Longest output edge. Omit for full resolution. */
  maxDim?: number;
  format?: OutputFormat;
  quality?: number;
}

/**
 * Renders a stored crop with its filters applied.
 *
 * The stored original is never modified - every view and every export is
 * produced from it on demand. Editing is therefore always reversible, and the
 * library holds one copy of each photo rather than a raw copy plus a baked
 * "enhanced" copy that used to be the only thing export could reach.
 */
export async function renderPhoto(source: Blob, options: RenderOptions): Promise<Blob> {
  const { filters, rotation = 0, maxDim, format = 'png', quality = 0.92 } = options;

  const decoded = await decode(source);
  const srcW = decoded.width;
  const srcH = decoded.height;

  // Trim is expressed in source pixels and clamped so it can never eat the image.
  const trim = Math.min(Math.max(0, filters.trimMargin || 0), Math.min(srcW, srcH) * 0.2);
  const cropX = trim;
  const cropY = trim;
  const cropW = Math.max(1, srcW - trim * 2);
  const cropH = Math.max(1, srcH - trim * 2);

  const quarterTurns = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const swapsAxes = quarterTurns % 2 === 1;

  let outW = swapsAxes ? cropH : cropW;
  let outH = swapsAxes ? cropW : cropH;

  if (maxDim && Math.max(outW, outH) > maxDim) {
    const s = maxDim / Math.max(outW, outH);
    outW = Math.max(1, Math.round(outW * s));
    outH = Math.max(1, Math.round(outH * s));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((quarterTurns * 90 * Math.PI) / 180);
  const drawW = swapsAxes ? outH : outW;
  const drawH = swapsAxes ? outW : outH;
  ctx.drawImage(decoded, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  if ('close' in decoded) decoded.close();

  const hasAdjustments =
    filters.preset !== 'none' ||
    filters.brightness !== 0 ||
    filters.contrast !== 0 ||
    filters.saturation !== 0 ||
    filters.warmth !== 0;

  if (hasAdjustments) {
    const imgData = ctx.getImageData(0, 0, outW, outH);
    applyPreset(imgData.data, filters.preset);
    applyAdjustments(imgData.data, filters);
    ctx.putImageData(imgData, 0, 0);
  }

  if (filters.sharpen > 0) {
    applySharpen(ctx, outW, outH, filters.sharpen / 100);
  }

  return canvasToBlob(canvas, format, quality);
}

/** Convenience wrapper producing the gallery preview. */
export function renderThumb(source: Blob, filters: FilterSettings, rotation = 0): Promise<Blob> {
  return renderPhoto(source, {
    filters,
    rotation,
    maxDim: THUMB_MAX_DIM,
    format: 'webp',
    quality: 0.85
  });
}

function applyPreset(data: Uint8ClampedArray, preset: FilterSettings['preset']) {
  switch (preset) {
    case 'autofix': return autoContrastStretch(data);
    case 'vintage': return vintageColorRestore(data);
    case 'bw': return convertToBW(data);
    case 'sepia': return convertToSepia(data);
    case 'vivid': return vividColorBoost(data);
    default: return;
  }
}

function applyAdjustments(data: Uint8ClampedArray, filters: FilterSettings) {
  const bMult = (filters.brightness / 100) * 255;
  const cFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast));
  const sat = 1 + filters.saturation / 100;
  const warmth = filters.warmth;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + bMult;
    let g = data[i + 1] + bMult;
    let b = data[i + 2] + bMult;

    r = cFactor * (r - 128) + 128;
    g = cFactor * (g - 128) + 128;
    b = cFactor * (b - 128) + 128;

    if (warmth !== 0) {
      r += warmth * 0.4;
      b -= warmth * 0.4;
    }

    if (sat !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray);
      g = gray + sat * (g - gray);
      b = gray + sat * (b - gray);
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

/**
 * Percentile-based contrast stretch.
 *
 * Clipping to the absolute min and max, as this did previously, is defeated by
 * a single stray black or white pixel - a dust speck, a scanner edge - which is
 * exactly what old prints are full of. Ignoring the outer 0.5% of each channel
 * finds the real tonal range.
 */
function autoContrastStretch(data: Uint8ClampedArray) {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const pixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    hist[0][data[i]]++;
    hist[1][data[i + 1]]++;
    hist[2][data[i + 2]]++;
  }

  const clip = Math.floor(pixels * 0.005);
  const bounds = hist.map(h => {
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += h[v]; if (acc > clip) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += h[v]; if (acc > clip) { hi = v; break; } }
    return { lo, range: Math.max(1, hi - lo) };
  });

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = ((data[i + c] - bounds[c].lo) / bounds[c].range) * 255;
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

function vintageColorRestore(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] * 0.95 + 10;
    const g = data[i + 1] * 1.05;
    const b = data[i + 2] * 1.2 - 10;
    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

function convertToBW(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
}

function convertToSepia(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
  }
}

function vividColorBoost(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    for (let c = 0; c < 3; c++) {
      const v = gray + 1.45 * (data[i + c] - gray);
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (w < 3 || h < 3) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const out = ctx.createImageData(w, h);
  const dst = out.data;

  // Start from a copy so the untouched 1px border keeps its pixels rather than
  // being left transparent, as the previous implementation did.
  dst.set(src);

  const kCenter = 1 + 4 * amount;
  const kEdge = -amount;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          kEdge * src[((y - 1) * w + x) * 4 + c] +
          kEdge * src[(y * w + (x - 1)) * 4 + c] +
          kCenter * src[i + c] +
          kEdge * src[(y * w + (x + 1)) * 4 + c] +
          kEdge * src[((y + 1) * w + x) * 4 + c];
        dst[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      dst[i + 3] = src[i + 3];
    }
  }

  ctx.putImageData(out, 0, 0);
}

export function safeFilename(title: string, fallback: string): string {
  const clean = (title || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
  return clean.length > 0 ? clean.slice(0, 80) : fallback;
}

export interface ExportOptions {
  format: OutputFormat;
  quality: number;
  onProgress?: (done: number, total: number) => void;
}

/** Renders one stored photo to its export bytes, EXIF included where supported. */
export async function renderForExport(
  photo: PhotoRecord,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  const blob = await renderPhoto(photo.original, {
    filters: photo.filters,
    rotation: photo.rotation,
    format,
    quality
  });

  // Only JPEG carries the EXIF block this writes.
  if (format !== 'jpeg') return blob;

  return withExif(blob, {
    captureDate: parseCaptureDate(photo.captureDate),
    modifiedDate: new Date(photo.createdAt),
    software: 'Cropalot'
  });
}

/** Builds a ZIP of the given photos and hands it to the browser's downloader. */
export async function downloadPhotosAsZip(
  photos: PhotoRecord[],
  options: ExportOptions,
  zipFilename = 'Cropalot_Photos.zip'
): Promise<void> {
  const { format, quality, onProgress } = options;
  const zip = new JSZip();
  const folder = zip.folder('Cropalot_Extracted');
  const ext = extensionFor(format);
  const used = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const blob = await renderForExport(photo, format, quality);

    let name = safeFilename(photo.title, `Photo_${i + 1}`);
    let candidate = `${name}.${ext}`;
    let n = 2;
    while (used.has(candidate)) candidate = `${name}_${n++}.${ext}`;
    used.add(candidate);

    folder?.file(candidate, blob);
    onProgress?.(i + 1, photos.length);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFilename);
}

/** True when this browser can write straight into a folder the user picks. */
export function canWriteToDirectory(): boolean {
  return typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

interface FileSystemDirectoryHandleLike {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/**
 * Writes each photo as its own file into a folder chosen by the user.
 *
 * Nicer than a ZIP for the case this app exists to serve - forty album pages,
 * hundreds of photos - because the files land where they are wanted instead of
 * in an archive that then has to be unpacked. Falls back to ZIP wherever the
 * File System Access API is missing (Firefox, Safari).
 *
 * Returns the number of files written, or null if the user cancelled the picker.
 */
export async function exportToDirectory(
  photos: PhotoRecord[],
  options: ExportOptions
): Promise<number | null> {
  const picker = (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandleLike>;
  }).showDirectoryPicker;

  let dir: FileSystemDirectoryHandleLike;
  try {
    dir = await picker({ mode: 'readwrite' });
  } catch (err) {
    // AbortError means the user simply closed the picker.
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }

  const { format, quality, onProgress } = options;
  const ext = extensionFor(format);
  const used = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const blob = await renderForExport(photo, format, quality);

    const base = safeFilename(photo.title, `Photo_${i + 1}`);
    let candidate = `${base}.${ext}`;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}_${n++}.${ext}`;
    used.add(candidate);

    const handle = await dir.getFileHandle(candidate, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    onProgress?.(i + 1, photos.length);
  }

  return photos.length;
}
