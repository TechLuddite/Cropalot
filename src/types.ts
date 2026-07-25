export interface Point {
  x: number; // Normalized 0-1 or pixel coordinate
  y: number;
}

export interface PhotoQuad {
  id: string;
  points: [Point, Point, Point, Point]; // Top-Left, Top-Right, Bottom-Right, Bottom-Left
  confidence: number;
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

export interface ExtractedPhoto {
  id: string;
  sheetId: string;
  title: string;
  year?: string;
  tags: string[];
  quad: PhotoQuad;
  originalCropUrl: string; // Base cropped & deskewed
  enhancedUrl: string;    // Final image with filters
  width: number;
  height: number;
  rotation: number;       // 0, 90, 180, 270 degrees
  filters: FilterSettings;
  createdAt: number;
}

export interface ScanSheet {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
  quads: PhotoQuad[];
}

export interface AppSettings {
  autoDetectOnUpload: boolean;
  defaultOutputFormat: 'jpeg' | 'png' | 'webp';
  jpegQuality: number; // 0.1 to 1.0
  autoDeskewSensitivity: number; // 1 to 10
  defaultTrimMargin: number;
  theme: 'dark' | 'light' | 'system';
  isProUnlocked: boolean;
}
