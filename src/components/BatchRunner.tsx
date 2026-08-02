import React, { useEffect, useRef, useState } from 'react';
import { ScanSheet } from '../types';
import { PhotoRecord } from '../utils/photoStore';
import { processAllSheets, BatchProgress, SheetOutcome } from '../utils/batch';
import { Layers, CheckCircle2, AlertTriangle, Loader2, XCircle, ArrowRight } from 'lucide-react';

interface BatchRunnerProps {
  sheets: ScanSheet[];
  sensitivity: number;
  captureDate?: string;
  onComplete: (photos: PhotoRecord[]) => void;
  onCancel: () => void;
}

/**
 * Unattended run over a whole album.
 *
 * The app exists for a shoebox of albums, not one page, and nothing here
 * previously acknowledged that: every sheet had to be opened, reviewed and
 * extracted by hand. Forty pages meant forty rounds of clicking, so in practice
 * people stopped after two. This processes the entire queue and reports what
 * happened per page, so the work can be started and walked away from.
 */
export const BatchRunner: React.FC<BatchRunnerProps> = ({
  sheets,
  sensitivity,
  captureDate,
  onComplete,
  onCancel
}) => {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [outcomes, setOutcomes] = useState<SheetOutcome[]>([]);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const results = await processAllSheets(sheets, {
        sensitivity,
        captureDate,
        onProgress: setProgress,
        shouldCancel: () => cancelled.current
      });
      if (cancelled.current) return;
      setOutcomes(results);
      setFinished(true);
    })();

    return () => { cancelled.current = true; };
  }, [sheets, sensitivity, captureDate]);

  const totalPhotos = outcomes.reduce((n, o) => n + o.photos.length, 0);
  const failures = outcomes.filter(o => o.error);
  const empties = outcomes.filter(o => !o.error && o.photos.length === 0);

  const pct = progress ? Math.round(((progress.page - 1) / progress.totalPages) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {finished ? 'Album processed' : 'Processing album'}
            </h2>
            <p className="text-xs text-slate-400">
              {finished
                ? `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} from ${sheets.length} page${sheets.length === 1 ? '' : 's'}.`
                : `${sheets.length} pages queued. You can leave this running.`}
            </p>
          </div>
        </div>

        {!finished && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  {progress
                    ? `Page ${progress.page} of ${progress.totalPages} — ${progress.stage === 'detecting' ? 'finding photos' : 'cropping'}`
                    : 'Starting…'}
                </span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {progress?.photosSoFar ?? 0} extracted
                </span>
              </div>

              <div
                className="h-2 rounded-full bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {progress && (
                <p className="text-[11px] text-slate-500 truncate">{progress.sheetName}</p>
              )}
            </div>

            <button
              onClick={() => { cancelled.current = true; onCancel(); }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
            >
              Stop
            </button>
          </>
        )}

        {finished && (
          <>
            {/* Per-page results: a page that found nothing is a page worth
                revisiting by hand, so it must not be silently absorbed into a
                total that looks fine. */}
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
              {outcomes.map((o, i) => (
                <div key={o.sheetId} className="flex items-center gap-3 px-3.5 py-2.5 text-xs">
                  {o.error ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : o.photos.length === 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-slate-500 tabular-nums w-8 shrink-0">p{i + 1}</span>
                  <span className="flex-1 truncate text-slate-300">{o.sheetName}</span>
                  <span className={`shrink-0 font-semibold ${o.error ? 'text-rose-400' : o.photos.length === 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                    {o.error ? 'failed' : o.photos.length === 0 ? 'nothing found' : `${o.photos.length} photos`}
                  </span>
                </div>
              ))}
            </div>

            {(failures.length > 0 || empties.length > 0) && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                {empties.length > 0 && `${empties.length} page${empties.length === 1 ? '' : 's'} produced nothing — open ${empties.length === 1 ? 'it' : 'them'} individually and raise the detection sensitivity, or place crops by hand. `}
                {failures.length > 0 && `${failures.length} page${failures.length === 1 ? '' : 's'} failed to process.`}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(outcomes.flatMap(o => o.photos))}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <span>Open library ({totalPhotos})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
