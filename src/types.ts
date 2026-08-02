export interface Point {
  x: number; // Normalized 0-1 or pixel coordinate
  y: number;
}

export interface PhotoQuad {
  id: string;
  points: [Point, Point, Point, Point]; // Top-Left, Top-Right, Bottom-Right, Bottom-Left
  /** How completely the photo fills its own enclosing rectangle, 0-1. Measured, not assumed. */
  confidence: number;
  /** Detected rotation in degrees, in (-45, 45]. 0 means the photo sits square on the page. */
  angleDeg?: number;
  label?: string;
}

export interface FilterSettings {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  warmth: number;     // -100 to 100
  sharpen: number;    // 0 to 100
  trimMargin: number; // 0 to 20 pixels
  preset: 'none' | 'autofix' | 'vintage' | 'bw' | 'sepia' | 'vivid';
}

export type OutputFormat = 'png' | 'jpeg' | 'webp';

export interface ScanSheet {
  id: string;
  name: string;
  /**
   * The sheet image itself.
   *
   * A Blob rather than a data URL: an uploaded file already is one, so there is
   * no reason to base64 it into a string a third larger than the file and then
   * decode it again.
   */
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
  /** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. Inherited by every photo cropped from this sheet. */
  captureDate?: string;
  quads: PhotoQuad[];
  /**
   * Known-correct corners, available only for the generated sample sheets
   * because their layout is chosen by us rather than measured.
   *
   * This is a scoring reference, never a shortcut. Detection previously
   * returned these verbatim whenever they existed, so the samples showcased
   * perfect crops that the real detector had no part in producing - which hid
   * the fact that automatic detection could not deskew anything at all.
   */
  groundTruthQuads?: PhotoQuad[];
}

export interface AppSettings {
  /** Run detection automatically when a sheet is opened. */
  autoDetectOnUpload: boolean;
  /** Format used for downloads, ZIP export and folder export. */
  defaultOutputFormat: OutputFormat;
  /** Encoder quality for JPEG and WebP, 0.1 to 1.0. Ignored for PNG. */
  exportQuality: number;
  /** Starting threshold for the detector, 1 to 10. */
  autoDeskewSensitivity: number;
}
