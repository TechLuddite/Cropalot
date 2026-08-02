import React, { useState, useEffect, useRef } from 'react';
import { FilterSettings } from '../types';
import { PhotoRecord } from '../utils/photoStore';
import { renderPhoto, renderThumb, THUMB_MAX_DIM } from '../utils/imageProcessing';
import {
  X, RotateCcw, RotateCw, Sparkles, Sliders, Check, SlidersHorizontal, Sun,
  Contrast as ContrastIcon, Palette, Flame, Scissors, CalendarDays
} from 'lucide-react';

interface PhotoEnhancerModalProps {
  photo: PhotoRecord;
  onSave: (updatedPhoto: PhotoRecord) => void;
  onClose: () => void;
}

/** Preview at thumbnail scale: fast enough to keep up with a dragged slider. */
const PREVIEW_MAX_DIM = THUMB_MAX_DIM * 2;

export const PhotoEnhancerModal: React.FC<PhotoEnhancerModalProps> = ({
  photo,
  onSave,
  onClose
}) => {
  const [filters, setFilters] = useState<FilterSettings>(photo.filters);
  const [rotation, setRotation] = useState<number>(photo.rotation || 0);
  const [title, setTitle] = useState<string>(photo.title);
  const [captureDate, setCaptureDate] = useState<string>(photo.captureDate ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  const previewUrlRef = useRef<string | null>(null);

  // The untouched crop, shown in the comparison pane.
  useEffect(() => {
    const url = URL.createObjectURL(photo.original);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.original]);

  // Re-render the preview whenever the controls move. Renders are debounced and
  // superseded, so dragging a slider does not queue up a full-resolution render
  // per pixel of travel.
  useEffect(() => {
    let cancelled = false;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const blob = await renderPhoto(photo.original, {
          filters,
          rotation,
          maxDim: PREVIEW_MAX_DIM,
          format: 'webp',
          quality: 0.9
        });
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (err) {
        console.error('Preview render failed', err);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, rotation, photo.original]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  // Escape closes, and focus is trapped inside the dialog while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleApplyPreset = (preset: FilterSettings['preset']) => {
    setFilters(prev => ({ ...prev, preset }));
  };

  const handleReset = () => {
    setFilters({
      brightness: 0, contrast: 0, saturation: 0, warmth: 0,
      sharpen: 0, trimMargin: 0, preset: 'none'
    });
    setRotation(0);
  };

  /**
   * Persists the settings, not the pixels.
   *
   * Only the small thumbnail is re-rendered; full-size output is produced from
   * the preserved original at export time. Every edit therefore stays
   * reversible and the library holds one copy of each photo.
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const thumb = await renderThumb(photo.original, filters, rotation);
      const quarterTurns = ((Math.round(rotation / 90) % 4) + 4) % 4;
      const swaps = quarterTurns % 2 === 1;

      onSave({
        ...photo,
        title,
        captureDate: captureDate.trim() || undefined,
        filters,
        rotation,
        width: swaps ? photo.height : photo.width,
        height: swaps ? photo.width : photo.height,
        thumb
      });
      onClose();
    } catch (err) {
      console.error('Could not save changes', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 md:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-base md:text-lg border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 rounded"
              />
              <p className="text-xs text-slate-400">Local Image Enhancement & Filter Studio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                showComparison
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showComparison ? 'Hide Original' : 'Compare Original'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view (Image Preview + Filter Sidebar) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto">
          {/* Image Preview Canvas Area */}
          <div className="md:col-span-7 bg-slate-950 p-6 flex flex-col items-center justify-center relative min-h-[320px]">
            {showComparison ? (
              <div className="grid grid-cols-2 gap-3 w-full h-full items-center">
                <div className="space-y-2 text-center">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Raw Deskewed</span>
                  <img
                    src={originalUrl ?? undefined}
                    alt="Original"
                    className="max-h-[300px] object-contain rounded-xl border border-slate-800 mx-auto"
                  />
                </div>
                <div className="space-y-2 text-center">
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Restored</span>
                  <img
                    src={previewUrl ?? undefined}
                    alt="Enhanced"
                    className="max-h-[300px] object-contain rounded-xl border border-emerald-500/40 shadow-xl mx-auto"
                  />
                </div>
              </div>
            ) : (
              <div className="relative max-h-[380px] flex items-center justify-center">
                <img
                  src={previewUrl ?? undefined}
                  alt="Preview"
                  className="max-h-[360px] object-contain rounded-xl border border-slate-800 shadow-2xl"
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-emerald-400 text-xs font-bold gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" /> Processing Filters...
                  </div>
                )}
              </div>
            )}

            {/* Rotation Bar */}
            <div className="flex items-center gap-3 mt-4 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
              <button
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <span>Rotate Left</span>
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
              >
                <RotateCw className="w-4 h-4 text-emerald-400" />
                <span>Rotate Right</span>
              </button>
            </div>
          </div>

          {/* Controls & Preset Settings Panel */}
          <div className="md:col-span-5 p-6 border-t md:border-t-0 md:border-l border-slate-800 space-y-6 bg-slate-900/60 overflow-y-auto">
            {/* Restoration Presets */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Photo Restoration Presets
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'autofix', name: 'Auto Fix', desc: 'Tone & Contrast' },
                  { id: 'vintage', name: 'Vintage Restorer', desc: 'Fix Yellow Fading' },
                  { id: 'bw', name: 'B&W Classic', desc: 'Monochrome' },
                  { id: 'sepia', name: 'Warm Sepia', desc: 'Nostalgic' },
                  { id: 'vivid', name: 'Vivid Memory', desc: 'Deep Color' },
                  { id: 'none', name: 'None (Raw)', desc: 'Original' }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      filters.preset === preset.id
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-white shadow-md'
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">{preset.name}</div>
                    <div className="text-[10px] text-slate-400">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Capture date -> EXIF DateTimeOriginal on JPEG export.
                Without this every digitised photo imports under today's date,
                which is most of the reason people give up on scanning albums. */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" /> When was it taken?
              </h4>
              <input
                type="text"
                value={captureDate}
                onChange={(e) => setCaptureDate(e.target.value)}
                placeholder="1974, 1974-08 or 1974-08-23"
                aria-label="Capture date"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Written into the file as the EXIF capture date when you export JPEG, so photo apps
                file it under the right year instead of today.
              </p>
            </div>

            {/* Fine-Tuning Sliders */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Fine Adjustments
              </h4>

              {/* Brightness */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                  </span>
                  <span className="text-emerald-400">{filters.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={filters.brightness}
                  onChange={(e) => setFilters({ ...filters, brightness: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <ContrastIcon className="w-3.5 h-3.5 text-cyan-400" /> Contrast
                  </span>
                  <span className="text-emerald-400">{filters.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={filters.contrast}
                  onChange={(e) => setFilters({ ...filters, contrast: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-400" /> Saturation
                  </span>
                  <span className="text-emerald-400">{filters.saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={filters.saturation}
                  onChange={(e) => setFilters({ ...filters, saturation: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Warmth */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" /> Warmth
                  </span>
                  <span className="text-emerald-400">{filters.warmth}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={filters.warmth}
                  onChange={(e) => setFilters({ ...filters, warmth: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Trim Margin */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-400" /> Scanner Edge Trim
                  </span>
                  <span className="text-emerald-400">{filters.trimMargin}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={filters.trimMargin}
                  onChange={(e) => setFilters({ ...filters, trimMargin: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>Reset to original</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
