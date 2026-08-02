# Cropalot 📸✂️

> **Browser-only multi-photo crop & straighten tool for digitizing family photo sheets**

**Cropalot** takes a scan or photo of an album page holding several photographs and helps you pull each picture out as its own image file. Everything happens inside your browser — no account, no upload, no server.

**[Try it →](https://techluddite.github.io/Cropalot/)**

---

## 🔒 The privacy guarantee, and why you don't have to take our word for it

Most tools tell you they don't upload your photos. Cropalot arranges for your browser to make it impossible.

`index.html` ships this Content-Security-Policy:

```
connect-src 'none'
```

Your browser reads that line before a single line of our JavaScript executes, and then refuses every outbound request this page can attempt — `fetch`, `XMLHttpRequest`, WebSocket, `EventSource`, `sendBeacon`. There is no code we could write, or that anyone could later add, that transmits your photos while that line is present.

So the audit is one line long. View source, read the `<meta>` tag, done. You don't have to read the other four thousand.

Two things worth knowing about the honest limits of this:

- **It is not a proof about the server.** Code running in a page can't prove its own integrity — anything that could tamper with the app could tamper with a self-check the app displays. That's why Cropalot shows you its commit SHA and instructions to rebuild it yourself, and does **not** show you a green "verified" badge it drew for itself. (An earlier version did exactly that, hashing copies of its own source that were embedded in the same bundle it was checking. It has been removed; it proved nothing.)
- **Reloading still needs the network.** Once the page is open you can go offline and keep working. Refresh the tab and you'll need a connection to fetch the app again — installable offline support is on the roadmap, not shipped.

### Verify it yourself

```bash
# What this page served you
curl -s https://techluddite.github.io/Cropalot/assets/*.js | sha256sum

# Build the same commit and compare
git clone https://github.com/TechLuddite/Cropalot && cd Cropalot
git checkout <commit shown in the app's "This Build" tab>
npm ci && npm run build && sha256sum dist/assets/*.js
```

Or just open DevTools → Network and crop a sheet. Nothing goes out. If anything ever tried, the Console would show a CSP violation rather than quietly allowing it.

---

## ✨ What it does today

- **Multi-photo detection with real deskew** — estimates the page background, groups the regions that differ from it, and fits each one's *minimum-area enclosing rectangle*, so a photo lying at an angle is detected at that angle rather than boxed upright.
- **True perspective correction** — solves the homography mapping your quadrilateral to a rectangle and inverse-maps every output pixel through it, with bilinear sampling and supersampling on downscale.
- **Detection sensitivity** — a slider for low-contrast pages, and a per-photo readout of the tilt found and how completely the photo fills its own box.
- **Manual 4-corner adjustment** — drag any corner, with a 3× magnifier for precision. Corners are re-ordered on release, so a corner dragged past its neighbour can't silently produce a broken crop.
- **Non-destructive editing** — extraction gives you the pixels as cropped. Colour and tone corrections are opt-in in the enhancer and are applied on top of a preserved original.
- **Enhancement presets** — auto-fix, vintage restore, B&W, sepia, vivid, plus brightness / contrast / saturation / warmth / sharpen / edge-trim sliders.
- **Batch ZIP export** — download every crop in one archive.
- **Camera capture** — grab a page with a phone or webcam instead of a scanner.
- **Sample sheets that double as a benchmark** — three generated album pages, each carrying the exact corners of the photos drawn onto it. Detection runs on them for real and the editor shows the resulting mean IoU against those known corners, so accuracy regressions are visible rather than hidden. Currently **0.93–0.99 IoU, all photos found**.

## ⚠️ Limitations worth knowing before you rely on it

Being straight with you about where this currently falls short:

- **The photo library is capped by `localStorage`.** A 4×6″ print at 300 dpi serializes to roughly 6 MB, and the browser gives an origin about 5 MB total — so large scans will not persist across a reload. The app now says so plainly when it happens instead of failing silently, but **export anything you care about before closing the tab.** Moving to IndexedDB/OPFS is the fix and it is queued.
- **Big sheets can freeze the tab.** Detection and cropping run on the main thread. A 50-megapixel flatbed scan with eight photos on it will hurt. Web Worker offload is planned.
- **Export is PNG only.** The format and quality controls in Settings are not yet wired up.
- **JPEG, PNG and WebP only.** Browsers can't decode TIFF or HEIC in an `<img>`; convert those first. Cropalot now tells you instead of doing nothing.

---

## 🛠️ Tech stack

- **React 19 + TypeScript**, built with **Vite 6**
- **Tailwind CSS v4**, **Lucide** icons
- **Canvas 2D** for all image analysis and rendering — plain JavaScript, no WASM, no native deps
- Convex hull, rotating-calipers minimum-area rectangle, Sutherland–Hodgman clipping and an 8×8 homography solve, all hand-rolled in `src/utils/geometry.ts`
- **JSZip** + **FileSaver.js** for batch export

No backend, no API keys, no analytics, no cookies, no telemetry, no fonts or scripts from a CDN. The dependency list above is the whole of it.

---

## 🚀 Getting started

```bash
git clone https://github.com/TechLuddite/Cropalot
cd Cropalot
npm install
npm run dev      # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |

> The dev server relaxes `connect-src` so hot-reload's WebSocket works — see the `devCspRelax` plugin in `vite.config.ts`. It is scoped to `apply: 'serve'` and never runs during a build, so production ships the policy exactly as written in `index.html`.

---

## 📂 Project structure

```
Cropalot/
├── index.html                      # App shell + the Content-Security-Policy
├── vite.config.ts                  # Build config, dev CSP relaxation, commit-SHA injection
├── metadata.json                   # Applet manifest
└── src/
    ├── main.tsx                    # Entry point
    ├── App.tsx                     # Top-level state & tab routing
    ├── types.ts                    # Shared TypeScript types
    ├── utils/
    │   ├── geometry.ts             # Hull, min-area rect, polygon clipping, homography solver
    │   ├── cvEngine.ts             # Detection pipeline + homography warp
    │   ├── imageProcessing.ts      # Filters, presets, rotation, ZIP export
    │   └── sampleSheets.ts         # Generated demo album pages
    └── components/
        ├── Navbar.tsx              # Top & bottom navigation
        ├── SheetUploader.tsx       # Drop zone, sample picker, upload errors
        ├── DetectionEditor.tsx     # Interactive corner editor + magnifier
        ├── GalleryView.tsx         # Extracted photo library & batch export
        ├── PhotoEnhancerModal.tsx  # Per-photo filter studio
        ├── CameraModal.tsx         # Webcam / phone capture
        ├── SettingsModal.tsx       # Preferences
        ├── OfflinePrivacyModal.tsx # Privacy architecture & self-verification
        ├── BuildProvenance.tsx     # Commit SHA + how to verify this build
        ├── SupportModal.tsx        # Credits & donation
        └── AndroidFrame.tsx        # Phone-preview chrome
```

---

## 💖 Support & acknowledgments

Cropalot is free software — no ads, no subscriptions, no paywalls.

👉 **[Support development via PayPal](https://www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S)**

Special thanks to **[Halo MSP](https://halomsp.com)** — helping businesses with safe and sensible AI and software implementation. For general business IT, see our parent company **[Tech 2U](https://tech2u.com)**.

---

## 📜 License

MIT — see [LICENSE](./LICENSE).
