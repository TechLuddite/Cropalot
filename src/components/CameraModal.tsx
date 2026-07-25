import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { ScanSheet } from '../types';

interface CameraModalProps {
  onCapture: (sheet: ScanSheet) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const startCam = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Camera access failed:', err);
        setErrorMsg('Could not access device camera. Please check permissions.');
      }
    };

    startCam();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    const newSheet: ScanSheet = {
      id: `sheet_camera_${Date.now()}`,
      name: `Camera Scan ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      createdAt: Date.now(),
      quads: []
    };

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    onCapture(newSheet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-6 relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-lg">Scan Photo Sheet with Camera</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-rose-400 text-sm">{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="relative aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Document Alignment Frame Box */}
            <div className="absolute inset-8 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
              <span className="bg-slate-950/80 px-3 py-1 rounded-full text-emerald-300 text-xs font-semibold backdrop-blur-sm">
                Position Photo Album Sheet inside box
              </span>
            </div>
          </div>
        )}

        {!errorMsg && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Local Processing
            </span>

            <button
              onClick={handleSnap}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Camera className="w-5 h-5" />
              <span>Capture Sheet</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
