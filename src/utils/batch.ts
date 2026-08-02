import { ScanSheet, FilterSettings } from '../types';
import { PhotoRecord } from './photoStore';
import { detectPhotos, extractPhotos } from './cvClient';
import { renderThumb } from './imageProcessing';
import { perceptualHash } from './perceptualHash';

/** Crops are stored exactly as rectified; corrections stay opt-in in the enhancer. */
export const NEUTRAL_FILTERS: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
  trimMargin: 0,
  preset: 'none'
};

/**
 * Builds a predictable, sortable title for an extracted photo.
 *
 * Digitising an album produces hundreds of files whose only ordering is the
 * one this name gives them. Leading the name with the capture date puts a
 * whole album in chronological order in any file browser, and zero-padding the
 * indices keeps page 10 after page 9 rather than after page 1.
 *
 * `1974-08_Album-Page_p03_02`
 */
export function photoTitle(
  sheet: ScanSheet,
  pageNumber: number,
  photoIndex: number,
  totalPages: number,
  captureDate?: string
): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  const pageWidth = Math.max(2, String(totalPages).length);

  const name = (sheet.name || 'Page')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'Page';

  const datePrefix = captureDate?.trim() ? `${captureDate.trim()}_` : '';
  const pagePart = totalPages > 1 ? `_p${pad(pageNumber, pageWidth)}` : '';

  return `${datePrefix}${name}${pagePart}_${pad(photoIndex + 1, 2)}`;
}

export interface SheetOutcome {
  sheetId: string;
  sheetName: string;
  photos: PhotoRecord[];
  error?: string;
}

export interface BatchProgress {
  /** 1-based index of the sheet being worked on. */
  page: number;
  totalPages: number;
  sheetName: string;
  stage: 'detecting' | 'extracting' | 'done';
  photosSoFar: number;
}

/**
 * Runs the whole pipeline over one sheet: detect, rectify, thumbnail, hash.
 *
 * Shared by the interactive editor and the unattended batch run so a photo
 * produced either way is identical.
 */
export async function processSheet(
  sheet: ScanSheet,
  options: {
    sensitivity: number;
    pageNumber: number;
    totalPages: number;
    captureDate?: string;
    quadsOverride?: ScanSheet['quads'];
    onStage?: (stage: BatchProgress['stage']) => void;
  }
): Promise<PhotoRecord[]> {
  const { sensitivity, pageNumber, totalPages, captureDate, quadsOverride, onStage } = options;

  onStage?.('detecting');
  const quads = quadsOverride?.length ? quadsOverride : await detectPhotos(sheet.blob, sensitivity);
  if (quads.length === 0) return [];

  onStage?.('extracting');
  const crops = await extractPhotos(sheet.blob, quads);

  const stamp = Date.now();
  const records: PhotoRecord[] = [];

  for (let i = 0; i < crops.length; i++) {
    const crop = crops[i];
    const [thumb, hash] = await Promise.all([
      renderThumb(crop.blob, NEUTRAL_FILTERS, 0),
      perceptualHash(crop.blob)
    ]);

    records.push({
      id: `photo_${stamp}_${pageNumber}_${i}`,
      sheetId: sheet.id,
      title: photoTitle(sheet, pageNumber, i, totalPages, captureDate),
      captureDate: captureDate?.trim() || undefined,
      tags: ['Scan'],
      quad: quads[i],
      width: crop.width,
      height: crop.height,
      rotation: 0,
      filters: { ...NEUTRAL_FILTERS },
      createdAt: stamp + i,
      original: crop.blob,
      thumb,
      hash
    });
  }

  onStage?.('done');
  return records;
}

/**
 * Processes every queued sheet without interaction.
 *
 * The point of the whole app is a shoebox of albums, not one page, and page
 * forty deserves the same attention as page one without forty rounds of
 * clicking. A sheet that fails is recorded and the run continues - one bad
 * scan must not abandon the other thirty-nine.
 */
export async function processAllSheets(
  sheets: ScanSheet[],
  options: {
    sensitivity: number;
    captureDate?: string;
    onProgress?: (progress: BatchProgress) => void;
    shouldCancel?: () => boolean;
  }
): Promise<SheetOutcome[]> {
  const { sensitivity, captureDate, onProgress, shouldCancel } = options;
  const outcomes: SheetOutcome[] = [];
  let photosSoFar = 0;

  for (let i = 0; i < sheets.length; i++) {
    if (shouldCancel?.()) break;

    const sheet = sheets[i];
    const report = (stage: BatchProgress['stage']) =>
      onProgress?.({
        page: i + 1,
        totalPages: sheets.length,
        sheetName: sheet.name,
        stage,
        photosSoFar
      });

    try {
      const photos = await processSheet(sheet, {
        sensitivity,
        pageNumber: i + 1,
        totalPages: sheets.length,
        captureDate: sheet.captureDate ?? captureDate,
        onStage: report
      });
      photosSoFar += photos.length;
      outcomes.push({ sheetId: sheet.id, sheetName: sheet.name, photos });
    } catch (err) {
      console.error(`Sheet "${sheet.name}" failed`, err);
      outcomes.push({
        sheetId: sheet.id,
        sheetName: sheet.name,
        photos: [],
        error: err instanceof Error ? err.message : 'processing failed'
      });
    }
  }

  return outcomes;
}
