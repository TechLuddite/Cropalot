import { ScanSheet, PhotoQuad } from '../types';

/**
 * Generates 3 realistic high-res sample photo album sheets with auto-detectable photos
 */
export async function generateSampleSheets(): Promise<ScanSheet[]> {
  const sheet1 = await createVintageAlbumSheet();
  const sheet2 = await createPolaroidScrapbookSheet();
  const sheet3 = await createColorGridScanSheet();

  return [sheet1, sheet2, sheet3];
}

async function createVintageAlbumSheet(): Promise<ScanSheet> {
  const w = 1200;
  const h = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. Black textured vintage album paper background
  ctx.fillStyle = '#1e1c1a';
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain/texture
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const val = Math.random() * 25;
    ctx.fillStyle = `rgba(255,255,255,${val / 255})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Draw 4 photos placed at slight angles on the page
  // Photo 1: Beach Sunset Vacation (Top Left, rotated -3 deg)
  const quad1 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.26, y: 0.28 }, 420, 300, -3.5,
    'Beach Vacation 1974',
    (pCtx, pw, ph) => {
      // Sky gradient
      const grad = pCtx.createLinearGradient(0, 0, 0, ph);
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(0.4, '#facc15');
      grad.addColorStop(0.7, '#0284c7');
      grad.addColorStop(1, '#0c4a6e');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, pw, ph);

      // Sun
      pCtx.fillStyle = '#fff7ed';
      pCtx.beginPath();
      pCtx.arc(pw * 0.5, ph * 0.45, 40, 0, Math.PI * 2);
      pCtx.fill();

      // Sea reflection & silhouette
      pCtx.fillStyle = '#0f172a';
      pCtx.fillRect(0, ph * 0.65, pw, ph * 0.35);

      // Family silhouettes on beach
      pCtx.fillStyle = '#020617';
      pCtx.beginPath();
      pCtx.arc(pw * 0.3, ph * 0.62, 14, 0, Math.PI * 2); // Head
      pCtx.fillRect(pw * 0.27, ph * 0.62, 16, 35); // Body
      pCtx.arc(pw * 0.45, ph * 0.64, 10, 0, Math.PI * 2); // Child head
      pCtx.fillRect(pw * 0.43, ph * 0.64, 12, 25);
      pCtx.fill();
    }
  );

  // Photo 2: Birthday Cake (Top Right, rotated +4 deg)
  const quad2 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.73, y: 0.27 }, 400, 310, 4.2,
    'Birthday Party 1981',
    (pCtx, pw, ph) => {
      // Warm indoor background
      pCtx.fillStyle = '#78350f';
      pCtx.fillRect(0, 0, pw, ph);

      // Table
      pCtx.fillStyle = '#b45309';
      pCtx.fillRect(0, ph * 0.55, pw, ph * 0.45);

      // Birthday Cake
      pCtx.fillStyle = '#fef08a'; // Cake base
      pCtx.fillRect(pw * 0.3, ph * 0.42, pw * 0.4, ph * 0.28);
      pCtx.fillStyle = '#f43f5e'; // Frosting
      pCtx.fillRect(pw * 0.28, ph * 0.38, pw * 0.44, 20);

      // Candles
      for (let c = 0; c < 5; c++) {
        const cx = pw * 0.34 + c * 22;
        pCtx.fillStyle = '#38bdf8';
        pCtx.fillRect(cx, ph * 0.28, 6, 22);
        // Flame
        pCtx.fillStyle = '#fbbf24';
        pCtx.beginPath();
        pCtx.arc(cx + 3, ph * 0.24, 6, 0, Math.PI * 2);
        pCtx.fill();
      }
    }
  );

  // Photo 3: Vintage Car Road Trip (Bottom Left, rotated +2.5 deg)
  const quad3 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.27, y: 0.74 }, 410, 300, 2.8,
    'Mountain Road Trip 1968',
    (pCtx, pw, ph) => {
      // Blue sky & green mountains
      pCtx.fillStyle = '#38bdf8';
      pCtx.fillRect(0, 0, pw, ph * 0.5);

      // Mountain triangles
      pCtx.fillStyle = '#15803d';
      pCtx.beginPath();
      pCtx.moveTo(0, ph * 0.5);
      pCtx.lineTo(pw * 0.35, ph * 0.15);
      pCtx.lineTo(pw * 0.7, ph * 0.5);
      pCtx.fill();

      pCtx.fillStyle = '#166534';
      pCtx.beginPath();
      pCtx.moveTo(pw * 0.3, ph * 0.5);
      pCtx.lineTo(pw * 0.7, ph * 0.1);
      pCtx.lineTo(pw, ph * 0.5);
      pCtx.fill();

      // Road
      pCtx.fillStyle = '#475569';
      pCtx.fillRect(0, ph * 0.5, pw, ph * 0.5);

      // Vintage Red Car
      pCtx.fillStyle = '#dc2626';
      pCtx.fillRect(pw * 0.35, ph * 0.6, pw * 0.38, 35);
      pCtx.fillRect(pw * 0.42, ph * 0.52, pw * 0.24, 22);
      // Wheels
      pCtx.fillStyle = '#0f172a';
      pCtx.beginPath();
      pCtx.arc(pw * 0.42, ph * 0.75, 12, 0, Math.PI * 2);
      pCtx.arc(pw * 0.65, ph * 0.75, 12, 0, Math.PI * 2);
      pCtx.fill();
    }
  );

  // Photo 4: Family Porch Portrait (Bottom Right, rotated -3.8 deg)
  const quad4 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.74, y: 0.73 }, 400, 310, -3.8,
    'Grandma Porch Portrait 1979',
    (pCtx, pw, ph) => {
      // Cozy porch wood paneling background
      pCtx.fillStyle = '#92400e';
      pCtx.fillRect(0, 0, pw, ph);

      // Wood slats
      pCtx.strokeStyle = '#78350f';
      pCtx.lineWidth = 3;
      for (let y = 20; y < ph; y += 30) {
        pCtx.beginPath();
        pCtx.moveTo(0, y);
        pCtx.lineTo(pw, y);
        pCtx.stroke();
      }

      // Family figures
      pCtx.fillStyle = '#1e293b';
      pCtx.beginPath();
      pCtx.arc(pw * 0.5, ph * 0.4, 24, 0, Math.PI * 2); // Center figure
      pCtx.fillRect(pw * 0.42, ph * 0.4, 48, 70);
      pCtx.fill();

      pCtx.fillStyle = '#0284c7';
      pCtx.beginPath();
      pCtx.arc(pw * 0.28, ph * 0.45, 18, 0, Math.PI * 2);
      pCtx.fillRect(pw * 0.22, ph * 0.45, 36, 60);
      pCtx.fill();
    }
  );

  return {
    id: 'sheet_vintage_1',
    name: '1970s Family Album Page',
    dataUrl: canvas.toDataURL('image/png'),
    width: w,
    height: h,
    createdAt: Date.now() - 86400000 * 5,
    quads: [quad1, quad2, quad3, quad4]
  };
}

async function createPolaroidScrapbookSheet(): Promise<ScanSheet> {
  const w = 1100;
  const h = 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Cream album paper
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, w, h);

  // Handwritten notes style text on page margins
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 20px serif';
  ctx.fillText('Summer Memories - 1994', 80, 60);

  // Polaroid 1
  const quad1 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.3, y: 0.38 }, 340, 420, -5,
    'Dog in Garden 1994',
    (pCtx, pw, ph) => {
      // Lush green grass
      pCtx.fillStyle = '#15803d';
      pCtx.fillRect(0, 0, pw, ph);
      // Dog
      pCtx.fillStyle = '#b45309';
      pCtx.beginPath();
      pCtx.arc(pw * 0.5, ph * 0.5, 35, 0, Math.PI * 2);
      pCtx.fill();
      // Snout
      pCtx.fillStyle = '#78350f';
      pCtx.beginPath();
      pCtx.arc(pw * 0.5, ph * 0.55, 18, 0, Math.PI * 2);
      pCtx.fill();
    },
    true // Is Polaroid with bottom border
  );

  // Polaroid 2
  const quad2 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.72, y: 0.55 }, 340, 420, 6,
    'Lake House Dock',
    (pCtx, pw, ph) => {
      // Blue lake
      pCtx.fillStyle = '#0284c7';
      pCtx.fillRect(0, 0, pw, ph);
      // Dock
      pCtx.fillStyle = '#78350f';
      pCtx.fillRect(pw * 0.35, ph * 0.4, pw * 0.3, ph * 0.6);
    },
    true
  );

  return {
    id: 'sheet_polaroid_1',
    name: '1990s Polaroid Scrapbook Sheet',
    dataUrl: canvas.toDataURL('image/png'),
    width: w,
    height: h,
    createdAt: Date.now() - 86400000 * 2,
    quads: [quad1, quad2]
  };
}

async function createColorGridScanSheet(): Promise<ScanSheet> {
  const w = 1200;
  const h = 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // White flatbed scanner background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Draw 2 large landscape photo prints
  const quad1 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.28, y: 0.5 }, 480, 340, 1.2,
    'Family Christmas 2002',
    (pCtx, pw, ph) => {
      pCtx.fillStyle = '#065f46';
      pCtx.fillRect(0, 0, pw, ph);
      // Christmas tree triangle
      pCtx.fillStyle = '#047857';
      pCtx.beginPath();
      pCtx.moveTo(pw * 0.5, ph * 0.1);
      pCtx.lineTo(pw * 0.15, ph * 0.85);
      pCtx.lineTo(pw * 0.85, ph * 0.85);
      pCtx.fill();
      // Lights
      pCtx.fillStyle = '#facc15';
      pCtx.beginPath();
      pCtx.arc(pw * 0.5, ph * 0.3, 8, 0, Math.PI * 2);
      pCtx.arc(pw * 0.4, ph * 0.5, 8, 0, Math.PI * 2);
      pCtx.arc(pw * 0.6, ph * 0.6, 8, 0, Math.PI * 2);
      pCtx.fill();
    }
  );

  const quad2 = drawSamplePhoto(
    ctx, w, h,
    { x: 0.74, y: 0.5 }, 480, 340, -1.8,
    'Grand Canyon Visit',
    (pCtx, pw, ph) => {
      pCtx.fillStyle = '#ea580c';
      pCtx.fillRect(0, 0, pw, ph);
      // Canyon layers
      pCtx.fillStyle = '#c2410c';
      pCtx.fillRect(0, ph * 0.4, pw, ph * 0.6);
      pCtx.fillStyle = '#9a3412';
      pCtx.fillRect(0, ph * 0.65, pw, ph * 0.35);
    }
  );

  return {
    id: 'sheet_grid_1',
    name: '2000s Scanner Sheet (2 Prints)',
    dataUrl: canvas.toDataURL('image/png'),
    width: w,
    height: h,
    createdAt: Date.now() - 86400000,
    quads: [quad1, quad2]
  };
}

/**
 * Draws a sample photo onto the album page canvas at a given center position & rotation,
 * and returns the normalized 4-corner PhotoQuad object for auto detection!
 */
function drawSamplePhoto(
  ctx: CanvasRenderingContext2D,
  sheetW: number,
  sheetH: number,
  centerNorm: { x: number; y: number },
  pw: number,
  ph: number,
  rotationDeg: number,
  title: string,
  drawContent: (pCtx: CanvasRenderingContext2D, pw: number, ph: number) => void,
  isPolaroid: boolean = false
): PhotoQuad {
  const cx = centerNorm.x * sheetW;
  const cy = centerNorm.y * sheetH;
  const rad = (rotationDeg * Math.PI) / 180;

  // Inner photo canvas
  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = pw;
  photoCanvas.height = ph;
  const pCtx = photoCanvas.getContext('2d')!;

  // White border
  pCtx.fillStyle = '#ffffff';
  pCtx.fillRect(0, 0, pw, ph);

  const border = isPolaroid ? 12 : 8;
  const bottomBorder = isPolaroid ? 50 : 8;

  const contentW = pw - border * 2;
  const contentH = ph - border - bottomBorder;

  // Content region
  pCtx.save();
  pCtx.translate(border, border);

  const contentCanvas = document.createElement('canvas');
  contentCanvas.width = contentW;
  contentCanvas.height = contentH;
  const cCtx = contentCanvas.getContext('2d')!;
  drawContent(cCtx, contentW, contentH);

  pCtx.drawImage(contentCanvas, 0, 0);
  pCtx.restore();

  // Draw photo onto main sheet canvas
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  // Soft drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  ctx.drawImage(photoCanvas, -pw / 2, -ph / 2);
  ctx.restore();

  // Calculate actual rotated 4 corner coordinates in sheet space
  const localCorners = [
    { x: -pw / 2, y: -ph / 2 }, // TL
    { x: pw / 2, y: -ph / 2 },  // TR
    { x: pw / 2, y: ph / 2 },   // BR
    { x: -pw / 2, y: ph / 2 }   // BL
  ];

  const sheetPoints = localCorners.map(pt => {
    const rx = pt.x * Math.cos(rad) - pt.y * Math.sin(rad);
    const ry = pt.x * Math.sin(rad) + pt.y * Math.cos(rad);
    return {
      x: (cx + rx) / sheetW,
      y: (cy + ry) / sheetH
    };
  }) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];

  return {
    id: `quad_sample_${Math.random().toString(36).substring(2, 7)}`,
    points: sheetPoints,
    confidence: 0.95,
    label: title
  };
}
