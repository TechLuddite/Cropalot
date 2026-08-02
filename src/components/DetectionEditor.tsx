import React, { useState, useEffect, useRef } from 'react';
import { PhotoQuad, ScanSheet, Point, AppSettings, FilterSettings } from '../types';
import { quadIoU } from '../utils/cvEngine';
import { detectPhotos, extractPhotos } from '../utils/cvClient';
import { orderQuadPoints } from '../utils/geometry';
import { PhotoRecord } from '../utils/photoStore';
import { renderThumb } from '../utils/imageProcessing';
import { Plus, Trash2, RotateCw, Check, RefreshCw, ArrowRight, AlertTriangle, X, Target, Sliders, CalendarDays } from 'lucide-react';

/**
 * Crops are stored exactly as rectified, with no corrections baked in.
 *
 * Extraction used to apply an auto-contrast stretch, a saturation bump and a
 * sharpen pass to every photo automatically, into the only copy the gallery
 * could export. For irreplaceable family photographs the untouched pixels have
 * to be what is kept; corrections belong in the enhancer, where they are
 * reversible.
 */
const NEUTRAL_FILTERS: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
  trimMargin: 0,
  preset: 'none'
};

interface DetectionEditorProps {
  sheet: ScanSheet;
  settings: AppSettings;
  onPhotosExtracted: (photos: PhotoRecord[]) => void;
  onBackToUpload: () => void;
}

export const DetectionEditor: React.FC<DetectionEditorProps> = ({
  sheet,
  settings,
  onPhotosExtracted,
  onBackToUpload
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [quads, setQuads] = useState<PhotoQuad[]>(sheet.quads || []);
  const [selectedQuadId, setSelectedQuadId] = useState<string | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ quadId: string; pointIdx: number } | null>(null);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; normX: number; normY: number } | null>(null);

  const [sensitivity, setSensitivity] = useState<number>(settings.autoDeskewSensitivity);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<{ meanIoU: number; matched: number; expected: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [captureDate, setCaptureDate] = useState<string>(sheet.captureDate ?? '');
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  // Display URL for the sheet, released when the sheet changes or we unmount.
  useEffect(() => {
    const url = URL.createObjectURL(sheet.blob);
    setSheetUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sheet.blob]);

  // Auto-detect on mount if no quads exist
  useEffect(() => {
    if ((!sheet.quads || sheet.quads.length === 0) && settings.autoDetectOnUpload) {
      runAutoDetection(sensitivity);
    } else if (sheet.quads && sheet.quads.length > 0) {
      setQuads(sheet.quads);
      setSelectedQuadId(sheet.quads[0].id);
    }
    // Detection is re-run explicitly by the sensitivity control, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  /**
   * Scores detection against the sample sheet's known-correct corners.
   *
   * Each expected photo is matched to its best-overlapping detection, so a
   * missed photo drags the mean toward zero rather than being quietly ignored.
   */
  const scoreAgainstGroundTruth = (detected: PhotoQuad[]) => {
    const truth = sheet.groundTruthQuads;
    if (!truth || truth.length === 0) {
      setAccuracy(null);
      return;
    }

    let total = 0;
    let matched = 0;
    for (const expected of truth) {
      let bestIoU = 0;
      for (const found of detected) {
        const iou = quadIoU(expected.points, found.points);
        if (iou > bestIoU) bestIoU = iou;
      }
      total += bestIoU;
      if (bestIoU > 0.5) matched++;
    }

    setAccuracy({ meanIoU: total / truth.length, matched, expected: truth.length });
  };

  const runAutoDetection = async (withSensitivity: number) => {
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await detectPhotos(sheet.blob, withSensitivity);
      setQuads(detected);
      setSelectedQuadId(detected.length > 0 ? detected[0].id : null);
      scoreAgainstGroundTruth(detected);
      if (detected.length === 0) {
        setError('No photos found on this sheet. Raise the sensitivity, or use "Add Box" to place crops by hand.');
      }
    } catch (err) {
      console.error('Detection failed', err);
      setError('This scan could not be opened. Go back and try a JPEG, PNG or WebP version.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Corner point dragging logic
  const handleMouseDown = (quadId: string, pointIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedQuadId(quadId);
    setDraggingPoint({ quadId, pointIdx });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPoint || !containerRef.current || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Calculate normalized 0-1 coordinates relative to image bounding rect
    let normX = (clientX - rect.left) / rect.width;
    let normY = (clientY - rect.top) / rect.height;

    // Clamp
    normX = Math.max(0, Math.min(1, normX));
    normY = Math.max(0, Math.min(1, normY));

    // Update quad point
    setQuads(prev =>
      prev.map(q => {
        if (q.id === draggingPoint.quadId) {
          const newPts = [...q.points] as [Point, Point, Point, Point];
          newPts[draggingPoint.pointIdx] = { x: normX, y: normY };
          return { ...q, points: newPts };
        }
        return q;
      })
    );

    // Update loupe position
    setLoupePos({
      x: clientX - containerRef.current.getBoundingClientRect().left,
      y: clientY - containerRef.current.getBoundingClientRect().top,
      normX,
      normY
    });

    renderLoupe(normX, normY);
  };

  /**
   * Re-sorts a quad's corners into TL/TR/BR/BL order.
   *
   * Dragging one corner past another produces a self-intersecting "bowtie",
   * which the warp renders as garbage. orderQuadPoints existed for exactly this
   * and was imported but never called, so the failure was silent.
   */
  const normaliseQuad = (quadId: string) => {
    setQuads(prev =>
      prev.map(q =>
        q.id === quadId ? { ...q, points: orderQuadPoints(q.points) } : q
      )
    );
  };

  const handleMouseUp = () => {
    if (draggingPoint) normaliseQuad(draggingPoint.quadId);
    setDraggingPoint(null);
    setLoupePos(null);
  };

  // Render 3x Magnifying Loupe
  const renderLoupe = (normX: number, normY: number) => {
    const canvas = loupeCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 120; // Loupe size
    canvas.width = size;
    canvas.height = size;

    const srcX = normX * img.naturalWidth;
    const srcY = normY * img.naturalHeight;
    const zoom = 3;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw magnified image snippet
    ctx.save();
    ctx.drawImage(
      img,
      srcX - (size / (2 * zoom)),
      srcY - (size / (2 * zoom)),
      size / zoom,
      size / zoom,
      0,
      0,
      size,
      size
    );

    // Crosshair target
    ctx.strokeStyle = '#10b981'; // Emerald 500
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    // Vertical line
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // Center target dot
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Touch dragging logic for mobile devices
  const handleTouchStart = (quadId: string, pointIdx: number, e: React.TouchEvent) => {
    e.stopPropagation();
    setSelectedQuadId(quadId);
    setDraggingPoint({ quadId, pointIdx });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingPoint || !containerRef.current || !imageRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const rect = imageRef.current.getBoundingClientRect();
    let normX = (touch.clientX - rect.left) / rect.width;
    let normY = (touch.clientY - rect.top) / rect.height;

    normX = Math.max(0, Math.min(1, normX));
    normY = Math.max(0, Math.min(1, normY));

    setQuads(prev =>
      prev.map(q => {
        if (q.id === draggingPoint.quadId) {
          const newPts = [...q.points] as [Point, Point, Point, Point];
          newPts[draggingPoint.pointIdx] = { x: normX, y: normY };
          return { ...q, points: newPts };
        }
        return q;
      })
    );

    setLoupePos({
      x: touch.clientX - containerRef.current.getBoundingClientRect().left,
      y: touch.clientY - containerRef.current.getBoundingClientRect().top,
      normX,
      normY
    });

    renderLoupe(normX, normY);
  };

  const handleTouchEnd = () => {
    if (draggingPoint) normaliseQuad(draggingPoint.quadId);
    setDraggingPoint(null);
    setLoupePos(null);
  };

  const handleAddQuad = () => {
    const newId = `quad_${Date.now()}`;
    const newQuad: PhotoQuad = {
      id: newId,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.6, y: 0.6 },
        { x: 0.2, y: 0.6 }
      ],
      confidence: 1,
      angleDeg: 0,
      label: `Photo ${quads.length + 1}`
    };
    setQuads([...quads, newQuad]);
    setSelectedQuadId(newId);
  };

  const handleRemoveQuad = (id: string) => {
    setQuads(quads.filter(q => q.id !== id));
    if (selectedQuadId === id) {
      const remaining = quads.filter(q => q.id !== id);
      setSelectedQuadId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleRotateQuad = (id: string) => {
    setQuads(prev =>
      prev.map(q => {
        if (q.id === id) {
          // Shift point array indices
          const [p0, p1, p2, p3] = q.points;
          return { ...q, points: [p3, p0, p1, p2] };
        }
        return q;
      })
    );
  };

  // Crop each selected region out of the sheet at full source resolution
  const handleExtractAll = async () => {
    if (quads.length === 0) return;
    setIsExtracting(true);
    setError(null);
    setProgress({ done: 0, total: quads.length });

    try {
      const crops = await extractPhotos(sheet.blob, quads, (done, total) =>
        setProgress({ done, total })
      );

      if (crops.length === 0) {
        setError('Nothing could be extracted from these regions.');
        return;
      }

      const stamp = Date.now();
      const extracted: PhotoRecord[] = [];

      for (let i = 0; i < crops.length; i++) {
        const crop = crops[i];
        extracted.push({
          id: `photo_${stamp}_${i}`,
          sheetId: sheet.id,
          title: quads[i]?.label || `${sheet.name}_Photo_${i + 1}`,
          captureDate: captureDate.trim() || undefined,
          tags: ['Scan'],
          quad: quads[i],
          width: crop.width,
          height: crop.height,
          rotation: 0,
          filters: { ...NEUTRAL_FILTERS },
          createdAt: stamp + i,
          original: crop.blob,
          thumb: await renderThumb(crop.blob, NEUTRAL_FILTERS, 0)
        });
      }

      onPhotosExtracted(extracted);
    } catch (err) {
      console.error('Extraction failed', err);
      setError('Extraction failed. The sheet may be too large for this device to process at once.');
    } finally {
      setIsExtracting(false);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div>
          <h2 className="font-bold text-lg text-white flex items-center gap-2 flex-wrap">
            <span>Deskew & Crop Editor</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {quads.length} {quads.length === 1 ? 'Photo' : 'Photos'} Detected
            </span>
            {/* Only the generated samples have known-correct corners to score against. */}
            {accuracy && (
              <span
                title="Mean intersection-over-union of automatic detection against this sample sheet's known photo corners. 1.00 is a perfect match."
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${
                  accuracy.meanIoU >= 0.9
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : accuracy.meanIoU >= 0.7
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                <Target className="w-3 h-3" />
                <span>
                  IoU {accuracy.meanIoU.toFixed(2)} &middot; {accuracy.matched}/{accuracy.expected} found
                </span>
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Drag corners to fine-tune cropping & perspective alignment. Use magnifier lens for pixel accuracy.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleAddQuad}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Box</span>
          </button>

          <button
            onClick={() => runAutoDetection(sensitivity)}
            disabled={isDetecting}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>Re-Detect</span>
          </button>

          <button
            onClick={handleExtractAll}
            disabled={quads.length === 0 || isExtracting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
          >
            {isExtracting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {progress ? `Deskewing ${progress.done}/${progress.total}...` : 'Deskewing...'}
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Extract All ({quads.length})</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Detection sensitivity - the state existed but had no control bound to it,
          so the threshold was permanently pinned at its default. */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">Detection sensitivity</span>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-[10px] text-slate-500 shrink-0">Fewer</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={sensitivity}
            aria-label="Detection sensitivity"
            onChange={(e) => setSensitivity(parseInt(e.target.value, 10))}
            onMouseUp={(e) => runAutoDetection(parseInt((e.target as HTMLInputElement).value, 10))}
            onTouchEnd={(e) => runAutoDetection(parseInt((e.target as HTMLInputElement).value, 10))}
            onKeyUp={(e) => runAutoDetection(parseInt((e.target as HTMLInputElement).value, 10))}
            className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 shrink-0">More</span>
          <span className="text-xs font-bold text-emerald-400 w-5 text-right tabular-nums">{sensitivity}</span>
        </div>
        <p className="text-[10px] text-slate-500 sm:max-w-[16rem] leading-relaxed">
          Raise this if photos are missed on a low-contrast page; lower it if the page texture is being picked up as photos.
        </p>
      </div>

      {/* One date for the whole page, inherited by every photo cropped from it.
          Album pages are usually from one occasion, so setting it here beats
          typing it into each photo afterwards. */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays className="w-4 h-4 text-emerald-400" />
          <label htmlFor="sheet-capture-date" className="text-xs font-bold text-slate-200">
            When was this page taken?
          </label>
        </div>
        <input
          id="sheet-capture-date"
          type="text"
          value={captureDate}
          onChange={(e) => setCaptureDate(e.target.value)}
          placeholder="1974, 1974-08 or 1974-08-23  (optional)"
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
        />
        <p className="text-[10px] text-slate-500 sm:max-w-[16rem] leading-relaxed">
          Saved as the EXIF capture date on JPEG export, so these land under the right year in your photo library rather than today.
        </p>
      </div>

      {/* Detection / extraction failure notice */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-100"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">{error}</p>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-lg text-rose-300/70 hover:text-rose-200 hover:bg-rose-500/10 shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Interactive Canvas Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative bg-slate-950 border border-slate-800 rounded-3xl p-2 sm:p-4 flex items-center justify-center overflow-hidden min-h-[350px] sm:min-h-[500px] select-none shadow-2xl"
      >
        {sheetUrl ? (
          <div className="relative max-w-full max-h-[65vh] flex items-center justify-center">
            {/* Base Scan Sheet Image */}
            <img
              ref={imageRef}
              src={sheetUrl}
              alt="Scan Sheet"
              className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl block"
              draggable={false}
            />

            {/* SVG Quad Overlay Layer */}
            {imageRef.current && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {quads.map((quad, qIdx) => {
                  const isSelected = quad.id === selectedQuadId;
                  const pts = quad.points;
                  const polygonPoints = pts.map(p => `${p.x * 100},${p.y * 100}`).join(' ');

                  return (
                    <g key={quad.id} className="pointer-events-auto">
                      {/* Quad Fill Polygon */}
                      <polygon
                        points={polygonPoints}
                        onClick={() => setSelectedQuadId(quad.id)}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'fill-emerald-500/25 stroke-emerald-400 stroke-[0.8]'
                            : 'fill-cyan-500/15 stroke-cyan-400/80 stroke-[0.5] hover:fill-cyan-500/25'
                        }`}
                      />

                      {/* Photo Label Badge */}
                      <text
                        x={pts[0].x * 100 + 1}
                        y={pts[0].y * 100 - 1.5}
                        fill="#10b981"
                        fontSize="2.5"
                        fontWeight="bold"
                        className="drop-shadow-md select-none"
                      >
                        {quad.label || `Photo ${qIdx + 1}`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Interactive Corner Drag Handles */}
            {quads.map((quad) => {
              const isSelected = quad.id === selectedQuadId;
              return quad.points.map((pt, pIdx) => (
                <div
                  key={`${quad.id}_corner_${pIdx}`}
                  onMouseDown={(e) => handleMouseDown(quad.id, pIdx, e)}
                  onTouchStart={(e) => handleTouchStart(quad.id, pIdx, e)}
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`
                  }}
                  className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 transition-transform cursor-grab active:cursor-grabbing z-30 flex items-center justify-center touch-none ${
                    isSelected
                      ? 'bg-emerald-400 border-white shadow-lg shadow-emerald-500/50 scale-125'
                      : 'bg-cyan-400 border-slate-900 opacity-80 hover:opacity-100 hover:scale-125'
                  }`}
                  title={`Corner ${pIdx + 1}`}
                >
                  <div className="w-2 h-2 rounded-full bg-slate-950" />
                </div>
              ));
            })}

            {/* Magnifier Loupe Floating Lens */}
            {loupePos && (
              <div
                style={{
                  left: `${loupePos.x - 70}px`,
                  top: `${loupePos.y - 140}px`
                }}
                className="absolute z-50 pointer-events-none rounded-full border-4 border-emerald-400 bg-slate-950 shadow-2xl overflow-hidden w-32 h-32 flex items-center justify-center animate-in fade-in zoom-in duration-100"
              >
                <canvas ref={loupeCanvasRef} className="w-full h-full rounded-full" />
                <span className="absolute bottom-1 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 rounded">
                  3X LENS
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-400 space-y-2 py-12">
            <p>No scan sheet loaded.</p>
            <button
              onClick={onBackToUpload}
              className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
            >
              Back to Upload
            </button>
          </div>
        )}
      </div>

      {/* Quad List Controls Sidebar / Bottom Drawer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Detected Photos List & Custom Controls
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quads.map((quad, idx) => {
            const isSelected = quad.id === selectedQuadId;
            return (
              <div
                key={quad.id}
                onClick={() => setSelectedQuadId(quad.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold text-xs text-emerald-400">
                    {quad.label || `Photo ${idx + 1}`}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {quad.angleDeg !== undefined && Math.abs(quad.angleDeg) >= 0.5
                      ? `${quad.angleDeg > 0 ? '+' : ''}${quad.angleDeg.toFixed(1)}° tilt`
                      : 'Square to page'}
                    {quad.confidence > 0 && ` · ${Math.round(quad.confidence * 100)}% fill`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRotateQuad(quad.id); }}
                    title="Rotate Corners"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveQuad(quad.id); }}
                    title="Remove Photo Region"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
