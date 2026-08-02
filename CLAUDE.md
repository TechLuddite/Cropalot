# Working on Cropalot

Cropalot crops and straightens individual photographs out of scanned album pages,
entirely in the browser. No server, no account, no network.

**Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) before changing the image
pipeline or the storage layer.** It lists invariants that exist because breaking
them previously produced a bug that testing did not catch.
[docs/LESSONS.md](./docs/LESSONS.md) explains how those bugs got there — the
project began as an AI Studio one-shot, and its characteristic failure modes are
worth knowing before you add to it.

---

## Hard rules

These are not style preferences. Each one has a specific bug behind it.

1. **Never relax `connect-src 'none'`** in a production build. That line in
   `index.html` *is* the privacy guarantee — the browser enforces it before any
   of our code runs. A feature that needs the network is a feature this app does
   not have.
2. **No data URLs in the photo path.** `Blob` everywhere; `createImageBitmap` to
   decode, `createObjectURL` to display, and revoke it afterwards. base64 is what
   made the original storage layer fail on the very first real photo.
3. **Never bake corrections into stored pixels.** `PhotoRecord.original` is the
   archival copy; filters are settings, and every preview and export renders from
   the original on demand.
4. **Nothing fails silently.** `console.warn` in a catch block is not error
   handling. Every `Image` load gets an `onerror`; every spinner gets a state
   that clears on failure; every storage write surfaces its failure.
5. **`groundTruthQuads` is for scoring only.** Never seed crops from it. The
   samples exist to measure the detector, not to flatter it.
6. **No plausible constants presented as data.** If the UI shows a number,
   something must have computed it.
7. **Trace every setting from where it's written to where it's read** before
   considering it done.

## Verifying a change

`npm run lint` and `npm run build` are necessary and nowhere near sufficient —
most of the serious bugs in this project's history typechecked cleanly. Drive the
built app in a real browser.

```bash
npm run build
npx vite preview --port 4173
# then Playwright against /opt/pw-browsers, or just open it
```

Check, at minimum:

- **Sample IoU** still at or above `0.99 / 0.95 / 0.93` (all photos found) for
  the 1970s / 1990s / 2000s sample sheets. The editor shows this live.
- **A real, large scan** (≥ 15 MP, photographic content) still works. Small
  flat-coloured fixtures hide almost every interesting failure — that is the
  single most repeated lesson in this project's history.
- **Reload persistence**, and **offline reload** with the network cut.
- **Zero CSP violations** in the console; zero outbound requests in Network.
- **Main thread stays responsive** while a big sheet is extracting.

## Conventions

- Comments explain *why*, especially where a non-obvious choice guards against a
  specific failure. Several look over-explained; they are load bearing.
- Prefer platform capability over a dependency. The project has no CV library, no
  PWA framework, no EXIF library, and no hashing library — the maths is small
  enough to own and read.
- Documentation must describe what the code *does*, not what it was meant to do.
  If a doc names a technique, the technique should be greppable.
- State limitations in the README rather than letting users discover them.

## Layout

```
index.html              CSP, manifest, icons
vite.config.ts          Build config, dev CSP relaxation, service worker generation
public/                 Manifest + PWA icons (committed; `npm run icons` to regenerate)
scripts/make-icons.mjs  Icon generator (needs playwright-core installed ad hoc)
docs/                   ARCHITECTURE.md, LESSONS.md
src/
  utils/geometry.ts     Pure maths — hull, min-area rect, clipping, homography
  utils/cvEngine.ts     Detection pipeline + rectifying warp
  utils/cvClient.ts     Worker dispatch with inline fallback
  utils/batch.ts        Shared per-sheet pipeline + unattended album run
  utils/photoStore.ts   IndexedDB library
  utils/imageProcessing.ts  Rendering, filters, ZIP & folder export
  utils/exif.ts         EXIF writer for capture dates
  utils/perceptualHash.ts   Duplicate detection
  workers/cv.worker.ts  Detection + rectification off the main thread
  components/           UI
```

## Known gaps

Documented in the README's Limitations section; worth reading before proposing
work. The largest open item is that detection uses a single global colour
threshold with no local-contrast signal, which is why the sensitivity slider
exists and why the default sits at 7.
