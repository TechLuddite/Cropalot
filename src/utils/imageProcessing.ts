import { FilterSettings } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Applies fine-tuning filters, presets, crop margin, and rotation to an extracted photo
 */
export async function applyPhotoFilters(
  sourceUrl: string,
  filters: FilterSettings,
  rotation: number = 0
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let srcW = img.width;
      let srcH = img.height;

      // Handle margin trim
      const trim = Math.min(filters.trimMargin || 0, Math.min(srcW, srcH) * 0.2);
      const cropX = trim;
      const cropY = trim;
      const cropW = srcW - trim * 2;
      const cropH = srcH - trim * 2;

      // Determine output dimensions after rotation
      const rad = (rotation * Math.PI) / 180;
      const isRotated90 = Math.abs(rotation % 180) === 90;
      const outW = isRotated90 ? cropH : cropW;
      const outH = isRotated90 ? cropW : cropH;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, outW);
      canvas.height = Math.max(1, outH);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }

      // Apply rotation transformation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH,
        -cropW / 2, -cropH / 2, cropW, cropH
      );
      ctx.restore();

      // Read pixel data for manipulation
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const len = data.length;

      // 1. Preset base processing
      if (filters.preset === 'autofix') {
        autoContrastStretch(data);
      } else if (filters.preset === 'vintage') {
        vintageColorRestore(data);
      } else if (filters.preset === 'bw') {
        convertToBW(data);
      } else if (filters.preset === 'sepia') {
        convertToSepia(data);
      } else if (filters.preset === 'vivid') {
        vividColorBoost(data);
      }

      // 2. Adjustments (Brightness, Contrast, Saturation, Warmth)
      const bMult = (filters.brightness / 100) * 255; // -255 to 255
      const cFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast)); // contrast formula
      const sat = 1 + filters.saturation / 100; // 0 to 2
      const warmth = filters.warmth; // -100 to 100

      for (let i = 0; i < len; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Brightness
        r += bMult;
        g += bMult;
        b += bMult;

        // Contrast
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;

        // Warmth (increase Red / decrease Blue)
        if (warmth !== 0) {
          r += warmth * 0.4;
          b -= warmth * 0.4;
        }

        // Saturation
        if (sat !== 1) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = gray + sat * (r - gray);
          g = gray + sat * (g - gray);
          b = gray + sat * (b - gray);
        }

        // Clamp
        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imgData, 0, 0);

      // 3. Optional Sharpen filter
      if (filters.sharpen && filters.sharpen > 0) {
        applySharpenKernel(ctx, canvas.width, canvas.height, filters.sharpen / 100);
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

function autoContrastStretch(data: Uint8ClampedArray) {
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < minR) minR = data[i];
    if (data[i] > maxR) maxR = data[i];
    if (data[i + 1] < minG) minG = data[i + 1];
    if (data[i + 1] > maxG) maxG = data[i + 1];
    if (data[i + 2] < minB) minB = data[i + 2];
    if (data[i + 2] > maxB) maxB = data[i + 2];
  }

  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(((data[i] - minR) / rangeR) * 255);
    data[i + 1] = Math.round(((data[i + 1] - minG) / rangeG) * 255);
    data[i + 2] = Math.round(((data[i + 2] - minB) / rangeB) * 255);
  }
}

function vintageColorRestore(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Compensate for yellowing / red-shift in vintage prints
    r = r * 0.95 + 10;
    g = g * 1.05;
    b = b * 1.2 - 10;

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }
}

function convertToBW(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function convertToSepia(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
  }
}

function vividColorBoost(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = Math.min(255, Math.max(0, gray + 1.45 * (data[i] - gray)));
    data[i + 1] = Math.min(255, Math.max(0, gray + 1.45 * (data[i + 1] - gray)));
    data[i + 2] = Math.min(255, Math.max(0, gray + 1.45 * (data[i + 2] - gray)));
  }
}

function applySharpenKernel(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const output = ctx.createImageData(w, h);
  const dst = output.data;

  // 3x3 Sharpen Kernel
  const kCenter = 1 + 4 * amount;
  const kEdge = -amount;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          kEdge * src[((y - 1) * w + x) * 4 + c] +
          kEdge * src[(y * w + (x - 1)) * 4 + c] +
          kCenter * src[i + c] +
          kEdge * src[(y * w + (x + 1)) * 4 + c] +
          kEdge * src[((y + 1) * w + x) * 4 + c];

        dst[i + c] = Math.min(255, Math.max(0, val));
      }
      dst[i + 3] = src[i + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
}

/**
 * Creates a ZIP archive of selected photos and triggers local download
 */
export async function downloadPhotosAsZip(
  photos: { title: string; url: string }[],
  zipFilename: string = 'Cropalot_Photos.zip'
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('Cropalot_Extracted');

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    // Strip data URL header
    const base64Data = photo.url.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    const cleanTitle = (photo.title || `Photo_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    folder?.file(`${cleanTitle}.png`, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFilename);
}
