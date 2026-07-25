import React, { useState } from 'react';
import { AppSettings } from '../types';
import { Settings, Shield, Heart, Check, X, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClose: () => void;
  openOfflineModal?: () => void;
  openSupportModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  openOfflineModal,
  openSupportModal
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  const paypalDonationUrl = 'https://www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S';

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-lg">Cropalot Settings & Privacy</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Privacy Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Shield className="w-4 h-4" /> 100% Local & Privacy First Promise
              </div>
              {openOfflineModal && (
                <button
                  type="button"
                  onClick={openOfflineModal}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline transition-colors"
                >
                  Verify Architecture →
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cropalot performs all computer vision, deskew matrix calculations, and filter processing entirely inside your browser memory. No data, photos, or metrics leave your device.
            </p>
          </div>

          {/* Export & Processing Preferences */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Processing & Export Defaults
            </h4>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white">Default Export Format</div>
                  <div className="text-[10px] text-slate-400">Format for extracted individual photos</div>
                </div>
                <select
                  value={localSettings.defaultOutputFormat}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultOutputFormat: e.target.value as any })}
                  className="bg-slate-800 border border-slate-700 text-white font-semibold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="png">PNG (Lossless)</option>
                  <option value="jpeg">JPEG (Compressed)</option>
                  <option value="webp">WebP (Modern)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <div className="font-bold text-xs text-white">Auto-Detect on Upload</div>
                  <div className="text-[10px] text-slate-400">Automatically run computer vision engine</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoDetectOnUpload}
                  onChange={(e) => setLocalSettings({ ...localSettings, autoDetectOnUpload: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Support & Paypal Donation Section */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Support Development & Donate
            </h4>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="space-y-1">
                <div className="font-bold text-sm text-white">
                  Support Cropalot
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cropalot is built as a private, 100% offline application without subscription paywalls or ad trackers. You can support direct development via PayPal.
                </p>
              </div>

              {/* Support Pop-out Trigger */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (openSupportModal) openSupportModal();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 group cursor-pointer"
              >
                <Heart className="w-4 h-4 text-rose-300 fill-rose-300" />
                <span>Support Development & Donate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-[10px] text-slate-500">Cropalot v2.5 • Offline Android Edition</span>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
