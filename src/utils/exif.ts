/**
 * Minimal EXIF writer for exported JPEGs.
 *
 * The single most useful thing a photo-digitising tool can do, and one almost
 * none of them bother with: stamp the original capture date onto the file. Land
 * 300 album scans in Google Photos or Apple Photos without it and they all pile
 * up under today's date, which defeats most of the point of digitising an album
 * in the first place. With DateTimeOriginal set, they sort into 1974 where they
 * belong.
 *
 * This builds an APP1 segment containing a small TIFF/EXIF structure and splices
 * it in immediately after the JPEG SOI marker, replacing any APP1 the encoder
 * already wrote. Canvas-encoded JPEGs carry no metadata at all, so in practice
 * there is nothing to replace.
 */

const TAG_SOFTWARE = 0x0131;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;

const TYPE_ASCII = 2;
const TYPE_LONG = 4;

/** Formats a Date as EXIF's "YYYY:MM:DD HH:MM:SS". */
export function toExifDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Parses the loose date strings a user might type for an album page.
 * Accepts 'YYYY', 'YYYY-MM' and 'YYYY-MM-DD'; anything else yields null.
 * Missing components default to January 1st at noon, which keeps the date on
 * the intended day in every timezone.
 */
export function parseCaptureDate(input: string | undefined): Date | null {
  if (!input) return null;
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;

  const year = Number(m[1]);
  if (year < 1826 || year > 9999) return null; // no photographs predate 1826

  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface AsciiEntry { tag: number; value: string; }

/** Builds the APP1 payload: "Exif\0\0" + a TIFF header with IFD0 and an Exif IFD. */
function buildExifPayload(ifd0: AsciiEntry[], exifIfd: AsciiEntry[]): Uint8Array {
  // Each ASCII value is NUL-terminated; values of 4 bytes or fewer live inline.
  const pad = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    const out = new Uint8Array(bytes.length + 1);
    out.set(bytes);
    return out;
  };

  const ifd0Values = ifd0.map(e => pad(e.value));
  const exifValues = exifIfd.map(e => pad(e.value));

  const ifd0Count = ifd0.length + (exifIfd.length > 0 ? 1 : 0);
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  const exifIfdSize = exifIfd.length > 0 ? 2 + exifIfd.length * 12 + 4 : 0;

  const ifd0DataStart = 8 + ifd0Size;
  const ifd0DataSize = ifd0Values.reduce((n, v) => n + (v.length > 4 ? v.length : 0), 0);
  const exifIfdStart = ifd0DataStart + ifd0DataSize;
  const exifDataStart = exifIfdStart + exifIfdSize;
  const exifDataSize = exifValues.reduce((n, v) => n + (v.length > 4 ? v.length : 0), 0);

  const tiffSize = exifDataStart + exifDataSize;
  const buf = new ArrayBuffer(tiffSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // TIFF header, big-endian.
  view.setUint16(0, 0x4d4d);   // 'MM'
  view.setUint16(2, 0x002a);   // magic 42
  view.setUint32(4, 8);        // offset of IFD0

  const writeIfd = (
    offset: number,
    entries: AsciiEntry[],
    values: Uint8Array[],
    dataStart: number,
    extraTag?: { tag: number; value: number }
  ): number => {
    const count = entries.length + (extraTag ? 1 : 0);
    view.setUint16(offset, count);
    let entryPos = offset + 2;
    let dataPos = dataStart;

    entries.forEach((entry, i) => {
      const value = values[i];
      view.setUint16(entryPos, entry.tag);
      view.setUint16(entryPos + 2, TYPE_ASCII);
      view.setUint32(entryPos + 4, value.length);
      if (value.length > 4) {
        view.setUint32(entryPos + 8, dataPos);
        bytes.set(value, dataPos);
        dataPos += value.length;
      } else {
        bytes.set(value, entryPos + 8);
      }
      entryPos += 12;
    });

    if (extraTag) {
      view.setUint16(entryPos, extraTag.tag);
      view.setUint16(entryPos + 2, TYPE_LONG);
      view.setUint32(entryPos + 4, 1);
      view.setUint32(entryPos + 8, extraTag.value);
      entryPos += 12;
    }

    view.setUint32(entryPos, 0); // no next IFD
    return dataPos;
  };

  writeIfd(
    8,
    ifd0,
    ifd0Values,
    ifd0DataStart,
    exifIfd.length > 0 ? { tag: TAG_EXIF_IFD, value: exifIfdStart } : undefined
  );

  if (exifIfd.length > 0) {
    writeIfd(exifIfdStart, exifIfd, exifValues, exifDataStart);
  }

  // "Exif\0\0" identifier ahead of the TIFF block.
  const header = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const payload = new Uint8Array(header.length + tiffSize);
  payload.set(header);
  payload.set(bytes, header.length);
  return payload;
}

export interface ExifOptions {
  /** Written to DateTimeOriginal and DateTimeDigitized. */
  captureDate?: Date | null;
  /** Written to DateTime (i.e. when this file was produced). */
  modifiedDate?: Date;
  software?: string;
}

/**
 * Returns a copy of `jpeg` carrying an EXIF APP1 segment. If the input is not a
 * JPEG, or there is nothing to write, the original bytes are returned unchanged.
 */
export async function withExif(jpeg: Blob, options: ExifOptions): Promise<Blob> {
  const { captureDate, modifiedDate, software } = options;
  if (!captureDate && !modifiedDate && !software) return jpeg;

  const buf = new Uint8Array(await jpeg.arrayBuffer());
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return jpeg; // not a JPEG

  const ifd0: AsciiEntry[] = [];
  if (modifiedDate) ifd0.push({ tag: TAG_DATETIME, value: toExifDateTime(modifiedDate) });
  if (software) ifd0.push({ tag: TAG_SOFTWARE, value: software });

  const exifIfd: AsciiEntry[] = [];
  if (captureDate) {
    exifIfd.push({ tag: TAG_DATETIME_ORIGINAL, value: toExifDateTime(captureDate) });
    exifIfd.push({ tag: TAG_DATETIME_DIGITIZED, value: toExifDateTime(captureDate) });
  }

  // EXIF tag numbers must ascend within an IFD.
  ifd0.sort((a, b) => a.tag - b.tag);
  exifIfd.sort((a, b) => a.tag - b.tag);

  const payload = buildExifPayload(ifd0, exifIfd);
  const segmentLength = payload.length + 2;
  if (segmentLength > 0xffff) return jpeg; // will not fit in one APP1

  // Skip an APP1 the encoder may already have emitted.
  let insertAt = 2;
  if (buf.length > 4 && buf[2] === 0xff && buf[3] === 0xe1) {
    insertAt = 4 + ((buf[4] << 8) | buf[5]);
  }

  const out = new Uint8Array(insertAt + 2 + segmentLength + (buf.length - insertAt));
  let o = 0;
  out.set(buf.subarray(0, 2), o); o += 2;              // SOI
  out[o++] = 0xff; out[o++] = 0xe1;                    // APP1 marker
  out[o++] = (segmentLength >> 8) & 0xff;
  out[o++] = segmentLength & 0xff;
  out.set(payload, o); o += payload.length;
  out.set(buf.subarray(insertAt), o);

  return new Blob([out], { type: 'image/jpeg' });
}
