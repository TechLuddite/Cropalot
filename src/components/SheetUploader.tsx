import React, { useRef, useState } from 'react';
import { Upload, Camera, Sparkles, Shield, Lock, Cpu, HardDrive, CheckCircle2, ArrowRight, Heart } from 'lucide-react';
import { ScanSheet } from '../types';
import { generateSampleSheets } from '../utils/sampleSheets';

interface SheetUploaderProps {
  onSheetSelected: (sheet: ScanSheet) => void;
  openCamera: () => void;
  openOfflineModal?: () => void;
  openSupportModal?: () => void;
}

export const SheetUploader: React.FC<SheetUploaderProps> = ({ onSheetSelected, openCamera, openOfflineModal, openSupportModal }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  // Handle custom file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const newSheet: ScanSheet = {
          id: `sheet_upload_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          width: img.width,
          height: img.height,
          createdAt: Date.now(),
          quads: [] // Will auto-detect in editor
        };
        onSheetSelected(newSheet);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Handle sample load
  const loadSample = async (index: number) => {
    setLoadingSample(true);
    try {
      const samples = await generateSampleSheets();
      if (samples[index]) {
        onSheetSelected(samples[index]);
      }
    } catch (err) {
      console.error('Failed to load sample sheet', err);
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 pb-20 md:pb-8">
      {/* Privacy First Hero Header */}
      <div className="text-center space-y-2 sm:space-y-3">
        <button
          type="button"
          onClick={openOfflineModal}
          title="Learn how Cropalot operates 100% offline & locally on your device"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer group shadow-sm"
        >
          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
          <span>100% Offline • Local Device Only</span>
          <span className="text-[10px] underline opacity-80 group-hover:opacity-100 ml-1">How it works →</span>
        </button>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          Auto Crop & Deskew <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Family Photo Sheets
          </span>
        </h1>
        <p className="text-slate-300 max-w-xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed px-2">
          Scan or capture entire album pages containing multiple photos. Cropalot automatically detects each picture, corrects perspective angles, and extracts high-res individual photos.
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsHovered(true); }}
        onDragLeave={() => setIsHovered(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsHovered(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            const input = fileInputRef.current;
            if (input) {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              handleFileChange({ target: input } as any);
            }
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all cursor-pointer overflow-hidden group ${
          isHovered
            ? 'border-emerald-400 bg-emerald-950/20 shadow-2xl shadow-emerald-500/10 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">
              Drop photo sheet scan or click to browse
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports JPG, PNG, WEBP, TIFF scanned pages (any resolution)
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              Select Image File
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openCamera(); }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 flex items-center gap-2 transition-all"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preloaded Sample Sheets for Quick Testing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Try Pre-loaded Sample Photo Sheets
          </h2>
          <span className="text-xs text-slate-400">Click to test instant auto-crop</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => loadSample(0)}
            disabled={loadingSample}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-left transition-all group space-y-2"
          >
            <div className="w-full h-28 rounded-xl bg-amber-950/40 border border-amber-800/30 overflow-hidden relative flex items-center justify-center p-2">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />
              <div className="text-center z-20 space-y-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  4 Photos • Vintage
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                <span>1970s Family Album</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Black paper page with photo corners & skewed photos</p>
            </div>
          </button>

          <button
            onClick={() => loadSample(1)}
            disabled={loadingSample}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-left transition-all group space-y-2"
          >
            <div className="w-full h-28 rounded-xl bg-amber-100/10 border border-amber-200/20 overflow-hidden relative flex items-center justify-center p-2">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />
              <div className="text-center z-20 space-y-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  2 Polaroids
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                <span>1990s Scrapbook Page</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Cream album paper with white Polaroid frames</p>
            </div>
          </button>

          <button
            onClick={() => loadSample(2)}
            disabled={loadingSample}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-left transition-all group space-y-2"
          >
            <div className="w-full h-28 rounded-xl bg-slate-800/40 border border-slate-700/50 overflow-hidden relative flex items-center justify-center p-2">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />
              <div className="text-center z-20 space-y-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  2 Landscape Prints
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                <span>2000s Flatbed Scan</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">High-contrast white scanner background sheet</p>
            </div>
          </button>
        </div>
      </div>

      {/* Feature Highlights / Privacy Guarantee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
        <div 
          onClick={openOfflineModal}
          className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all cursor-pointer flex items-start gap-3 group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
              <span>Zero Cloud & No Accounts</span>
              <span className="text-[10px] text-emerald-400 font-semibold underline">Verify →</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your family photos never leave your device. No server uploads, no user tracking, no sign ups required.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white">Auto Contour & Deskew</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Client-side computer vision automatically calculates corner perspective matrices to straighten crooked pictures.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white">Batch ZIP Export</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enhance colors, restore vintage tones, and download all cropped pictures instantly in a clean ZIP archive.
            </p>
          </div>
        </div>
      </div>

      {/* Subtle Support Hint Bar */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
          <span>Cropalot is 100% free with no ads or subscription paywalls.</span>
          <button
            type="button"
            onClick={openSupportModal}
            className="text-amber-300 hover:text-amber-200 font-semibold underline inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Heart className="w-3 h-3 text-amber-400 fill-amber-400/40" />
            <span>Support ongoing development</span>
          </button>
        </p>
      </div>
    </div>
  );
};
