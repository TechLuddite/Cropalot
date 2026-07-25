import React from 'react';
import { ShieldCheck, Smartphone, Monitor, Sparkles, Image as ImageIcon, Camera, Settings, Heart } from 'lucide-react';

interface NavbarProps {
  activeTab: 'upload' | 'editor' | 'gallery';
  setActiveTab: (tab: 'upload' | 'editor' | 'gallery') => void;
  isAndroidView: boolean;
  setIsAndroidView: (val: boolean) => void;
  extractedCount: number;
  openSettings: () => void;
  openCamera: () => void;
  openOfflineModal?: () => void;
  openSupportModal?: () => void;
}

export const NavbarTop: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isAndroidView,
  setIsAndroidView,
  extractedCount,
  openSettings,
  openCamera,
  openOfflineModal,
  openSupportModal
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shrink-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 font-black text-slate-950 text-base sm:text-lg tracking-tighter">
            CA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                Cropalot
              </span>
              <button
                onClick={openOfflineModal}
                title="Learn how Cropalot guarantees 100% offline & local photo processing"
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer group"
              >
                <ShieldCheck className="w-3 h-3 group-hover:scale-110 transition-transform" />
                <span>Offline</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 hidden lg:block">
              Auto Crop & Deskew Family Photo Sheets
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan Sheet</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'editor'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Deskew Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'gallery'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos</span>
            {extractedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-400/20 text-emerald-300 font-bold">
                {extractedCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Camera Quick Button */}
          <button
            onClick={openCamera}
            title="Capture sheet with camera"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700/60 flex items-center gap-1.5 text-xs font-medium"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Camera</span>
          </button>

          {/* Android Frame Toggle */}
          <button
            onClick={() => setIsAndroidView(!isAndroidView)}
            title={isAndroidView ? 'Switch to Fullscreen Desktop' : 'Switch to Android Frame View'}
            className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isAndroidView
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isAndroidView ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Monitor className="w-4 h-4" />}
            <span className="hidden sm:inline">{isAndroidView ? 'Android' : 'Desktop'}</span>
          </button>

          {/* Support / Donation Link */}
          <button
            onClick={openSupportModal}
            title="Support Cropalot's 100% offline development"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors border border-amber-500/20 flex items-center gap-1.5 text-xs font-semibold group cursor-pointer"
          >
            <Heart className="w-4 h-4 text-amber-400 fill-amber-400/30 group-hover:scale-110 transition-transform" />
            <span className="hidden xl:inline">Support</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={openSettings}
            title="Settings & Privacy"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export const NavbarBottom: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  extractedCount
}) => {
  return (
    <div className="md:hidden sticky bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around text-slate-400 shrink-0">
      <button
        onClick={() => setActiveTab('upload')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-[10px] font-bold transition-all ${
          activeTab === 'upload' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Sparkles className="w-5 h-5" />
        <span>Scan Sheet</span>
      </button>

      <button
        onClick={() => setActiveTab('editor')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-[10px] font-bold transition-all ${
          activeTab === 'editor' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Camera className="w-5 h-5" />
        <span>Deskew</span>
      </button>

      <button
        onClick={() => setActiveTab('gallery')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-[10px] font-bold transition-all relative ${
          activeTab === 'gallery' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <ImageIcon className="w-5 h-5" />
          {extractedCount > 0 && (
            <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[9px] rounded-full bg-emerald-500 text-slate-950 font-black shadow-sm">
              {extractedCount}
            </span>
          )}
        </div>
        <span>Photos</span>
      </button>
    </div>
  );
};

export const Navbar = NavbarTop;


