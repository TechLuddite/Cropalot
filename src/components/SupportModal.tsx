import React from 'react';
import { Heart, ExternalLink, X, ShieldCheck, Sparkles, Coffee, Gift } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAYPAL_DONATION_URL = 'https://www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S';

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-amber-400/20" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">Support Development</h3>
              <p className="text-[11px] text-slate-400">Keep Cropalot 100% free & offline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/20 to-slate-950/60 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Independent & Private Forever</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              Cropalot is built as a private, 100% offline tool without subscription paywalls, ad trackers, or account sign-ups. Your photos stay strictly on your device.
            </p>
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            <p className="font-medium text-slate-200">
              If Cropalot helped you digitize family photo albums, preserve old memories, or save hours of manual cropping, consider supporting direct development!
            </p>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>100% free to use for personal & family projects</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Supports future computer vision & offline speed updates</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Gift className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Voluntary contributions via secure PayPal link</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <a
              href={PAYPAL_DONATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] group"
            >
              <Heart className="w-4 h-4 text-rose-300 fill-rose-300 group-hover:scale-110 transition-transform" />
              <span>Donate via PayPal</span>
              <ExternalLink className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-[10px] text-slate-500 px-5">
          <span>Cropalot • Offline Photo Cropper</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
