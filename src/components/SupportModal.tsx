import React from 'react';
import { Heart, ExternalLink, X, ShieldCheck, Sparkles, Coffee, Gift, Building2 } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAYPAL_DONATION_URL = 'https://www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S';

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-xl sm:max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 fill-amber-400/20" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg sm:text-2xl">Support Development</h3>
              <p className="text-xs sm:text-sm text-slate-400">Keep Cropalot 100% free & private offline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 text-sm sm:text-base max-h-[82vh] overflow-y-auto">
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-amber-950/30 to-slate-950/70 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2.5 text-amber-300 font-bold text-base sm:text-lg">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Independent & Private Forever</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-sm sm:text-base">
              Cropalot is built as a private, 100% offline tool without subscription paywalls, ad trackers, or account sign-ups. Your photos stay strictly on your device.
            </p>
          </div>

          <div className="space-y-4 text-slate-200">
            <p className="font-medium leading-relaxed text-sm sm:text-base">
              If Cropalot helped you digitize family photo albums, preserve old memories, or save hours of manual cropping, consider supporting direct development!
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <span>100% free to use for personal & family projects</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <span>Supports future computer vision & offline speed updates</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
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
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
            >
              <Heart className="w-5 h-5 text-rose-300 fill-rose-300 group-hover:scale-110 transition-transform" />
              <span>Donate via PayPal</span>
              <ExternalLink className="w-5 h-5 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          {/* Employer & Company Shout-out */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3">
            <div className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-cyan-300">
              <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Special Thanks & Technology Shout-Out</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Special thanks to my employer,{' '}
              <a
                href="https://halomsp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-bold underline inline-flex items-center gap-1"
              >
                Halo MSP
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              — helping businesses with safe and sensible AI and software implementation. Need general IT support? Our parent company{' '}
              <a
                href="https://tech2u.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-bold underline inline-flex items-center gap-1"
              >
                Tech 2U
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              {' '}can assist with any IT need!
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 px-6 sm:px-8">
          <span>Cropalot • Offline Photo Cropper</span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

