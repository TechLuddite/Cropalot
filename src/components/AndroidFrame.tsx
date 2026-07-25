import React from 'react';
import { WifiOff, Battery, ShieldCheck } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  activeTab: 'upload' | 'editor' | 'gallery';
  setActiveTab: (tab: 'upload' | 'editor' | 'gallery') => void;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({
  children,
  activeTab,
  setActiveTab
}) => {
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-2 sm:p-6 md:p-10">
      {/* Outer Android Smartphone Chassis */}
      <div className="w-full max-w-[480px] h-[92vh] max-h-[920px] bg-slate-900 border-[8px] sm:border-[12px] border-slate-800 rounded-[44px] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-slate-700/50">
        
        {/* Top Camera Notch / Punch Hole */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-800 z-50 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
        </div>

        {/* Android Top Status Bar */}
        <div className="bg-slate-950 text-slate-300 px-6 pt-3 pb-1.5 text-[11px] font-semibold flex items-center justify-between select-none shrink-0 z-40 border-b border-slate-900">
          <span>{currentTime}</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> Offline
            </span>
            <WifiOff className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-0.5 text-slate-300">
              <span>100%</span>
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Inner App Content Screen */}
        <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col relative">
          {children}
        </div>

        {/* Android Bottom Navigation Bar */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-6 py-2.5 flex items-center justify-around text-slate-400 shrink-0 z-40">
          {/* Gesture Home Pill */}
          <div className="w-32 h-1 bg-slate-700 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
};
