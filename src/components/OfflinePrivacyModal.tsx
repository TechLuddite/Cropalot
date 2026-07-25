import React, { useState } from 'react';
import { ShieldCheck, WifiOff, HardDrive, Lock, Cpu, CheckCircle2, X, Terminal, Heart, ExternalLink } from 'lucide-react';

interface OfflinePrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  openSupportModal?: () => void;
}

const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S';

export const OfflinePrivacyModal: React.FC<OfflinePrivacyModalProps> = ({ isOpen, onClose, openSupportModal }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'verify'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">100% Offline & Private Guarantee</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Client-Side Only
                </span>
              </div>
              <p className="text-xs text-slate-400">
                How Cropalot processes family photos entirely on your device without server uploads.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-emerald-400 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Architecture & Privacy</span>
          </button>
          <button
            onClick={() => setActiveTab('technical')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'technical'
                ? 'border-emerald-400 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>In-Browser Processing</span>
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'verify'
                ? 'border-emerald-400 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>How To Self-Verify</span>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Core Question & Answer */}
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <WifiOff className="w-4 h-4" />
                  <span>How can a web app hosted offsite be 100% offline?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  When you visit Cropalot, your web browser downloads the HTML, CSS, and JavaScript application bundle into your browser memory. Once loaded, <strong>all calculations, computer vision algorithms, deskewing, image filtering, and file savings run 100% locally inside your browser process</strong>.
                </p>
              </div>

              {/* Guarantees List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No Image Uploads</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Photos, scanned album sheets, and cropped outputs are NEVER transmitted to any cloud server or third-party service.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No Accounts & No Tracking</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    There are no sign-ups, passwords, user tracking scripts, cookies, or remote analytics attached to your personal images.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Local Device Storage</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Extracted photo results reside exclusively in your browser's sandboxed <code className="bg-slate-800 px-1 py-0.5 rounded text-[11px] text-emerald-300">localStorage</code> and temporary memory cache.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Airplane Mode Ready</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You can disconnect your internet connection entirely right now, and Cropalot will continue to scan, crop, deskew, and export ZIP files without interruption.
                  </p>
                </div>
              </div>

              {/* Subtle Donation & Support Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Heart className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                    <span>Support Independent Offline Tools</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Cropalot is 100% free with no ad trackers or subscription paywalls. If it helps you preserve family photo albums, consider supporting ongoing development.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (openSupportModal) openSupportModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Support Project</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300 leading-relaxed space-y-3">
                <p>
                  Cropalot utilizes modern Web Platform capabilities to eliminate server dependencies completely:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">In-Browser Computer Vision (Canvas 2D)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Auto-cropping uses a custom lightweight Javascript computer vision engine (<code className="text-emerald-300">cvEngine.ts</code>) that analyzes canvas pixel arrays locally to detect photo bounds, calculate geometric quadrilaterals, and estimate deskew angles.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Local Homography Perspective Transformation</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Perspective correction calculates an 8-parameter perspective projection matrix directly on standard HTML5 canvas elements, mapping arbitrary 4-corner polygons into rectified rectangular images.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Client-Side JSZip File Bundling</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Batch ZIP creation utilizes <code className="text-emerald-300">jszip</code> to compress extracted images directly inside browser RAM. The resulting `.zip` archive is saved to your computer or phone downloads via Blob URLs without touching a remote disk.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                We believe in full transparency and verifiable privacy. Here are two quick methods you can use to test and verify Cropalot's offline behavior yourself:
              </p>

              {/* Method 1: Airplane Mode Test */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">1</span>
                  <span>The Airplane Mode Test (Easiest)</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1.5 pl-1 leading-relaxed">
                  <li>Load Cropalot in your browser.</li>
                  <li>Turn on <strong>Airplane Mode</strong> or disconnect your Wi-Fi/Ethernet.</li>
                  <li>Upload a photo sheet scan or capture a camera image.</li>
                  <li>Perform auto-crop, deskew, adjustments, and download your ZIP.</li>
                  <li className="text-emerald-300 font-medium">Notice how everything runs smoothly with zero internet connection!</li>
                </ol>
              </div>

              {/* Method 2: Browser Network Inspector */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">2</span>
                  <span>Browser Developer Tools Audit</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1.5 pl-1 leading-relaxed">
                  <li>Press <code className="bg-slate-800 px-1 py-0.5 rounded text-white">F12</code> or right-click and select <strong>Inspect</strong>.</li>
                  <li>Open the <strong>Network</strong> tab.</li>
                  <li>Process any photo sheet or export individual images.</li>
                  <li className="text-emerald-300 font-medium">Observe that zero HTTP requests are sent containing image data or upload payloads.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Your memories remain exclusively on your device.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/10"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
