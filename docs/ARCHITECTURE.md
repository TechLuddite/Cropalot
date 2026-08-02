# Architecture

How Cropalot is put together, and — more importantly — which properties are load
bearing. Several of the rules below exist because breaking them previously
produced a bug that was invisible in testing; those are marked **invariant** and
each says what goes wrong if you violate it.

Companion reading: [LESSONS.md](./LESSONS.md) for why the first draft needed this
work in the first place.

---

## Shape of the app

```
index.html          CSP + manifest link. The privacy guarantee lives here.
  └─ main.tsx       Registers the service worker, mounts React.
     └─ App.tsx     Tab routing, sheet queue, photo library state, settings.
        ├─ SheetUploader     Multi-file / folder input → ScanSheet[]
        ├─ DetectionEditor   Per-page corner editing, sensitivity, capture date
        ├─ BatchRunner       Unattended run over the whole queue
        └─ GalleryView       Library, duplicates, export
                └─ PhotoEnhancerModal   Non-destructive filter editing
```

Data flows one way: `SheetUploader` produces `ScanSheet`s → `App` holds them as a
queue → the editor or the batch runner turns a sheet into `PhotoRecord`s → `App`
persists them to IndexedDB → `GalleryView` renders and exports them.

## The image pipeline

```
Blob (uploaded file, camera capture, or generated sample)
  │
  ├─ cvClient.detectPhotos ──► Worker ──► cvEngine.detectPhotoQuads ──► PhotoQuad[]
  │                              │                                       (corners + angle)
  │                              └─ falls back inline if the Worker is unavailable
  │
  └─ cvClient.extractPhotos ─► Worker ──► cvEngine.extractAndDeskewPhoto ──► Blob per photo
                                            (homography + inverse map)
```

| Module | Responsibility |
|---|---|
| `utils/geometry.ts` | Pure maths: convex hull, min-area rect, polygon clipping, IoU, homography solve. No canvas, no DOM. |
| `utils/cvEngine.ts` | Detection pipeline and the rectifying warp. Canvas, no DOM. |
| `utils/cvClient.ts` | Front door. Dispatches to the Worker, falls back inline. |
| `utils/canvasCompat.ts` | Canvas helpers that work on the main thread *and* in a Worker. |
| `workers/cv.worker.ts` | Runs the above off the main thread. |
| `utils/batch.ts` | Per-sheet pipeline + unattended album run. Shared by both entry points. |
| `utils/imageProcessing.ts` | Rendering with filters, ZIP and folder export. |
| `utils/photoStore.ts` | IndexedDB library. |
| `utils/exif.ts` | EXIF APP1 writer for capture dates. |
| `utils/perceptualHash.ts` | dHash + colour signature for duplicate detection. |

### How detection works

Two stages, because they solve different problems:

1. **Coarse occupancy grid (96×96).** Estimate the page background as the
   per-channel *median* of a border ring, mark cells whose pixels differ from it,
   despeckle, fill enclosed holes, then find connected regions. This is robust to
   texture and noise and answers *where* the photos are.
2. **Per-region refinement.** Collect that region's foreground pixels at working
   resolution, take the convex hull, and fit its **minimum-area enclosing
   rectangle** by rotating calipers. This is where the rotation comes from — the
   optimal rectangle is always flush with a hull edge, so testing every edge is
   exact rather than approximate.

Then reject slivers (>12:1), reject regions that don't fill their own rectangle
(<62%), and suppress detections mostly contained within a larger one.

Three of those steps exist because of a specific observed failure:

- **Median, not mean, background** — a single photo overlapping a sheet corner
  poisoned a four-corner mean, which is extremely common on a full album page.
- **Despeckle, not morphological closing** — closing dilates before eroding, and
  dilation bridges any gap narrower than its kernel. That merged photos sitting
  close together (a 2×2 layout with a 100 px gutter came back as 2 photos, not
  4), and erosion cannot separate them once the bridge exists. The despeckle only
  fills background cells with ≥7 of 8 foreground neighbours, which cannot grow a
  region into its neighbour.
- **Hole filling** — photo content matching the page colour (a dark sea band on a
  black album leaf) punched through the mask and split a photo into fragments,
  and the leftover border strip surfaced as a spurious extra photo. Anything
  genuinely *outside* a photo connects to the sheet edge, so flood-filling
  background inward and marking the unreachable cells as foreground closes
  interior holes of any size while leaving the real page alone.

### How rectification works

Solve the 3×3 homography mapping the **output rectangle** back to the source
quad (an 8×8 linear system, Gaussian elimination with partial pivoting), then
inverse-map every destination pixel through it with bilinear sampling, and
supersample when the source region is more than 1.5× the output.

> **Invariant — the warp must stay projective.**
> A bilinear blend of the four corners agrees with a homography only when the
> quad is a parallelogram. For a page photographed at an angle the two differ
> throughout the interior, and *no amount of mesh subdivision closes the gap* —
> subdividing converges on the bilinear surface, which is the wrong surface. The
> previous implementation did exactly this while its comment claimed the mesh
> resolution made it "ultra-smooth".

---

## Invariants

### The Content-Security-Policy is the product

`index.html` ships `connect-src 'none'`. The browser refuses every `fetch`,
`XMLHttpRequest`, WebSocket, `EventSource` and `sendBeacon` the page can attempt,
before any application code runs.

> **Invariant — never relax `connect-src` in a production build.**
> This is the app's entire privacy claim, and its value is that it is
> *mechanical*: a user audits one `<meta>` tag instead of the whole bundle, and
> it holds for every future commit including ones nobody reviewed carefully. Any
> feature that needs the network is a feature this app does not have.

The dev server relaxes it so HMR's WebSocket works — via the `devCspRelax` plugin
in `vite.config.ts`, scoped `apply: 'serve'`, so it can never affect a build.

If you add a feature that trips the CSP, that is the CSP working. Design the
feature to work locally or drop it.

### Never show a self-drawn "verified" badge

Code running in a page cannot prove its own integrity: anything able to change
what the app does could equally change whatever self-check it displays. The app
therefore states its commit SHA, explains how to rebuild and compare hashes
independently, and explicitly tells the user why no green checkmark is offered.

> **Invariant — verification UI must not assert more than it can know.**
> The original implementation hashed copies of its own source that were embedded
> in the same bundle it was checking, and showed "In Sync (100% Match)". It
> proved nothing. See [LESSONS.md #9](./LESSONS.md#9-security-theatre-that-inverted-the-guarantee-it-defended).

### Photos are Blobs, never data URLs

> **Invariant — no `toDataURL` / base64 in the photo path.**
> base64 inflates by a third and allocates the whole image again as a JS string.
> The original code stored every photo twice as a data URL in `localStorage`; a
> 4×6″ print at 300 dpi is **5.8 MB** that way against a ~5 MB origin budget, so
> the first real photo always threw `QuotaExceededError` — caught by a
> `console.warn`, so the library silently evaporated on reload.

An uploaded `File` already *is* a `Blob`; pass it straight through. Use
`createImageBitmap` to decode and `URL.createObjectURL` to display, and revoke
the URL when the Blob is replaced or the component unmounts.

### Storage is IndexedDB, and one copy per photo

`PhotoRecord` holds `original` (the crop exactly as rectified, never modified)
and `thumb` (a small preview). Filters and rotation are stored as **settings**;
every preview and export is rendered from `original` on demand.

> **Invariant — never bake corrections into the stored pixels.**
> These are irreplaceable family photographs. The original code applied an
> auto-contrast stretch, a saturation bump, a sharpen pass and a 2 px trim to
> every extracted photo automatically, into the only copy the gallery could
> export — there was no path to the untouched pixels at all.

### Nothing fails silently

> **Invariant — a failed user-visible operation must reach the UI.**
> `console.warn` in a catch block is not error handling. Every `Image` load needs
> an `onerror`; every storage write needs a visible failure path; every spinner
> needs a state that clears on failure.

The original code had three `onload` handlers with no `onerror`, so an
undecodable file left "Deskewing…" spinning forever.

### Settings must be read where they are used

> **Invariant — trace every setting from write to read before shipping it.**
> The original Settings panel persisted seven values to `localStorage` and
> `settings` was never passed to the editor or the gallery. The whole panel was
> decorative and export was hardcoded to PNG.

### Sample sheets are a benchmark

`generateSampleSheets()` returns each sheet with `groundTruthQuads` — the exact
corners of the photos drawn onto it.

> **Invariant — `groundTruthQuads` is for scoring only, never for seeding crops.**
> The original detector returned these verbatim whenever they existed and
> sensitivity sat at its default (which no UI could change), so the samples
> showcased perfect angled crops the real detector had no part in producing. The
> headline feature was demo-only and nobody could tell.

The editor now runs real detection on the samples and displays mean IoU against
the ground truth, so accuracy is visible and regressions cannot hide.

**Current baseline — treat a drop as a regression:**

| Sample sheet | Mean IoU | Photos found |
|---|---|---|
| 1970s Family Album | 0.99 | 4 / 4 |
| 1990s Scrapbook Page | 0.95 | 2 / 2 |
| 2000s Flatbed Scan | 0.93 | 2 / 2 |

### The Worker path and the inline path run the same code

`cvClient` calls the same `cvEngine` functions either way, so behaviour cannot
drift between them. A Worker that dies — a chunk fetch racing service-worker
activation, memory pressure — **falls back to inline processing** rather than
surfacing an error; the work is still perfectly doable, just on this thread.

> This was observed in practice: a sheet reported "0 photos found" purely because
> the Worker had not survived a navigation.

### Numbers in the UI must be measured

> **Invariant — no plausible-looking constants presented as data.**
> `confidence` is the measured fill ratio of a photo within its own enclosing
> rectangle. It was previously a hardcoded `0.92` on every quad, and
> `ExtractedPhoto` recorded `800×600` for every photo regardless of actual size.

---

## Build and deploy

- `vite.config.ts` injects `__COMMIT_SHA__` and `__BUILD_TIME__`, generates
  `sw.js` with a precache manifest of the real hashed filenames, and relaxes the
  dev CSP.
- The service worker precaches the build and serves cache-first, so a reload with
  no network still opens the app. Verified with the network fully disabled.
- `public/` holds the manifest and icons. Icons are committed; regenerate with
  `npm i -D playwright-core && npm run icons` only if the mark changes.
- GitHub Pages deploy runs from `.github/workflows/deploy.yml` on push to `main`.

## How to verify a change

`npm run lint` and `npm run build` are necessary and nowhere near sufficient —
most of the serious bugs in this project's history typechecked cleanly.

Drive the built app in a real browser and check, at minimum:

1. **Sample IoU** hasn't dropped below the baseline table above.
2. **A real, large scan** (≥ 15 MP, photographic content) still detects and
   extracts. Small flat-coloured fixtures hide almost everything.
3. **Reload persistence** — extract photos, reload, confirm they're still there.
4. **Offline reload** — cut the network, reload, confirm the app opens.
5. **No CSP violations** in the console, and no outbound requests in Network.
6. **Main-thread responsiveness** during extraction of a big sheet.

A worked example of driving all of this from Playwright is in the PR history
(#1–#5); the pattern is `vite preview`, then `chromium.launch` against
`/opt/pw-browsers`, then assert on rendered text and `page.evaluate` probes.
