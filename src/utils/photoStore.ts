import { PhotoQuad, FilterSettings } from '../types';

/**
 * Photo library storage.
 *
 * Photos were previously kept in localStorage as base64 data URLs. A 4x6" print
 * at 300 dpi serialises to roughly 6 MB that way, against a per-origin budget
 * of about 5 MB - and each photo was stored twice, raw and enhanced. The first
 * real scan therefore threw QuotaExceededError, which was swallowed by a
 * console.warn, and the user's library silently evaporated on reload.
 *
 * IndexedDB stores Blobs directly: no base64 (which inflates by a third), no
 * JSON round-trip of the entire library on every edit, and a quota measured in
 * a share of free disk rather than five megabytes.
 */

const DB_NAME = 'cropalot';
const DB_VERSION = 1;
const STORE = 'photos';

/** Legacy localStorage keys, drained on first run and then removed. */
const LEGACY_KEYS = ['cropalot_extracted_photos', 'splitsnap_extracted_photos'];

export interface PhotoRecord {
  id: string;
  sheetId: string;
  title: string;
  captureDate?: string;   // 'YYYY-MM-DD', written into exported EXIF when present
  tags: string[];
  quad: PhotoQuad;
  width: number;
  height: number;
  rotation: number;
  filters: FilterSettings;
  createdAt: number;
  /** Full-resolution crop, exactly as rectified. Never overwritten by an edit. */
  original: Blob;
  /** Small preview for the gallery grid, re-rendered when filters change. */
  thumb: Blob;
  /** Perceptual hash of the crop, used to spot the same photo scanned twice. */
  hash?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
    req.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
      })
  );
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  const all = await tx<PhotoRecord[]>('readonly', s => s.getAll() as IDBRequest<PhotoRecord[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putPhoto(record: PhotoRecord): Promise<void> {
  await tx('readwrite', s => s.put(record));
}

export async function putPhotos(records: PhotoRecord[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const r of records) store.put(r);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

export async function deletePhotos(ids: string[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearPhotos(): Promise<void> {
  await tx('readwrite', s => s.clear());
}

/** Reports how much space the library occupies, when the browser will say. */
export async function estimateUsage(): Promise<{ usageMB: number; quotaMB: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usageMB: usage / 1048576, quotaMB: quota / 1048576 };
}

/**
 * Asks the browser not to evict this library under storage pressure.
 *
 * Chrome grants this silently once a site looks "engaged"; Firefox prompts.
 * A refusal is not an error - it just means eviction stays possible - so the
 * result is reported rather than thrown.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  try {
    if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mime });
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Moves any library left in localStorage by an older build into IndexedDB.
 *
 * Realistically most users will have nothing to migrate, because the old code
 * could not successfully store a full-size photo in the first place. Small
 * crops did fit, though, so the ones that survived are worth carrying over.
 * Returns how many records were recovered.
 */
export async function migrateFromLocalStorage(): Promise<number> {
  let migrated = 0;

  for (const key of LEGACY_KEYS) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;

    try {
      const legacy = JSON.parse(raw) as Array<Record<string, unknown>>;
      const records: PhotoRecord[] = [];

      for (const item of legacy) {
        const originalUrl = (item.originalCropUrl ?? item.enhancedUrl) as string | undefined;
        if (!originalUrl) continue;
        const original = dataUrlToBlob(originalUrl);
        if (!original) continue;
        const thumb = dataUrlToBlob((item.enhancedUrl as string) ?? originalUrl) ?? original;

        records.push({
          id: (item.id as string) ?? `photo_migrated_${migrated}_${Date.now()}`,
          sheetId: (item.sheetId as string) ?? 'legacy',
          title: (item.title as string) ?? 'Untitled',
          tags: (item.tags as string[]) ?? [],
          quad: item.quad as PhotoQuad,
          width: (item.width as number) ?? 0,
          height: (item.height as number) ?? 0,
          rotation: (item.rotation as number) ?? 0,
          filters: item.filters as FilterSettings,
          createdAt: (item.createdAt as number) ?? Date.now(),
          original,
          thumb
        });
      }

      if (records.length > 0) {
        await putPhotos(records);
        migrated += records.length;
      }
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Could not migrate legacy library "${key}":`, err);
    }
  }

  return migrated;
}
