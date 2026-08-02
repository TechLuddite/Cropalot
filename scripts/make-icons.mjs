/**
 * Generates the PWA icon PNGs into public/.
 *
 * The generated PNGs are committed, so the normal build needs neither a browser
 * nor an extra dependency. Only run this after changing the mark:
 *
 *     npm i -D playwright-core && npm run icons
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const browsersRoot = '/opt/pw-browsers';
const chromiumDir = fs.existsSync(browsersRoot)
  ? fs.readdirSync(browsersRoot).find(d => d.startsWith('chromium-'))
  : null;

const browser = await chromium.launch(
  chromiumDir
    ? { executablePath: `${browsersRoot}/${chromiumDir}/chrome-linux/chrome`, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] }
);
const page = await browser.newPage();

/**
 * Scissors over a rounded emerald tile, matching the in-app mark.
 * `inset` leaves the safe area maskable icons need for platform-shaped masks.
 */
const draw = (size, inset) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d');

  x.fillStyle = '#020617';
  x.fillRect(0, 0, size, size);

  const pad = size * inset;
  const box = size - pad * 2;
  const r = box * 0.22;

  const grad = x.createLinearGradient(pad, pad, pad + box, pad + box);
  grad.addColorStop(0, '#34d399');
  grad.addColorStop(1, '#0d9488');
  x.fillStyle = grad;
  x.beginPath();
  x.roundRect(pad, pad, box, box, r);
  x.fill();

  // Crop marks: two corner brackets framing the tile.
  const s = box;
  x.strokeStyle = '#022c22';
  x.lineWidth = s * 0.075;
  x.lineCap = 'round';
  const m = pad + s * 0.24;
  const n = pad + s * 0.76;
  const arm = s * 0.2;

  x.beginPath();
  x.moveTo(m, m + arm); x.lineTo(m, m); x.lineTo(m + arm, m);
  x.moveTo(n, n - arm); x.lineTo(n, n); x.lineTo(n - arm, n);
  x.stroke();

  // Diagonal cut line between them.
  x.lineWidth = s * 0.055;
  x.beginPath();
  x.moveTo(m + arm * 0.6, n - arm * 0.6);
  x.lineTo(n - arm * 0.6, m + arm * 0.6);
  x.stroke();

  return c.toDataURL('image/png');
};

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.06 },
  { file: 'icon-512.png', size: 512, inset: 0.06 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.16 },
  { file: 'favicon.png', size: 64, inset: 0.04 }
];

await page.goto('about:blank');
for (const { file, size, inset } of targets) {
  const dataUrl = await page.evaluate(draw, size, inset).catch(async () => {
    // page.evaluate passes one argument, so bind through a wrapper instead.
    return page.evaluate(
      ([s, i, src]) => new Function('return ' + src)()(s, i),
      [size, inset, draw.toString()]
    );
  });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', file, size + 'px');
}

await browser.close();
