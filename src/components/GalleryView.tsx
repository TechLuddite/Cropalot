import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { PhotoRecord } from '../utils/photoStore';
import {
  downloadPhotosAsZip,
  exportToDirectory,
  canWriteToDirectory,
  renderForExport,
  extensionFor,
  safeFilename
} from '../utils/imageProcessing';
import { PhotoEnhancerModal } from './PhotoEnhancerModal';
import {
  Download, SlidersHorizontal, Trash2, CheckSquare, Square, Search,
  FolderArchive, FolderOpen, Plus, Image as ImageIcon, Loader2, AlertTriangle, X
} from 'lucide-react';

interface GalleryViewProps {
  photos: PhotoRecord[];
  settings: AppSettings;
  isLoading: boolean;
  onUpdatePhoto: (photo: PhotoRecord) => void;
  onDeletePhotos: (ids: string[]) => void;
  onClearAll: () => void;
  onNavigateToUpload: () => void;
}

/**
 * Hands out object URLs for the gallery thumbnails and revokes them when the
 * underlying Blob is replaced or the photo disappears.
 *
 * Without the revoke, every filter tweak would leak a Blob for the lifetime of
 * the document - which matters a great deal more now that these are real
 * full-quality images rather than strings.
 */
function useThumbUrls(photos: PhotoRecord[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef(new Map<string, { blob: Blob; url: string }>());

  useEffect(() => {
    const next: Record<string, string> = {};
    const live = new Set<string>();

    for (const photo of photos) {
      live.add(photo.id);
      const existing = cache.current.get(photo.id);
      if (existing && existing.blob === photo.thumb) {
        next[photo.id] = existing.url;
        continue;
      }
      if (existing) URL.revokeObjectURL(existing.url);
      const url = URL.createObjectURL(photo.thumb);
      cache.current.set(photo.id, { blob: photo.thumb, url });
      next[photo.id] = url;
    }

    for (const [id, entry] of cache.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(entry.url);
        cache.current.delete(id);
      }
    }

    setUrls(next);
  }, [photos]);

  // Release everything when the gallery unmounts.
  useEffect(() => {
    const cached = cache.current;
    return () => {
      for (const entry of cached.values()) URL.revokeObjectURL(entry.url);
      cached.clear();
    };
  }, []);

  return urls;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  settings,
  isLoading,
  onUpdatePhoto,
  onDeletePhotos,
  onClearAll,
  onNavigateToUpload
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingPhoto, setEditingPhoto] = useState<PhotoRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exportState, setExportState] = useState<{ done: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const thumbUrls = useThumbUrls(photos);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return photos;
    return photos.filter(
      p => p.title.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [photos, searchQuery]);

  /**
   * What an export actually covers: the current selection if there is one,
   * otherwise everything the search filter is showing.
   *
   * Previously this fell back to the entire library, so exporting while a search
   * was active silently produced every photo instead of the visible ones.
   */
  const exportTargets = useMemo(() => {
    if (selectedIds.length > 0) {
      const ids = new Set(selectedIds);
      return photos.filter(p => ids.has(p.id));
    }
    return filteredPhotos;
  }, [photos, filteredPhotos, selectedIds]);

  const visibleIds = useMemo(() => new Set(filteredPhotos.map(p => p.id)), [filteredPhotos]);
  const allVisibleSelected =
    filteredPhotos.length > 0 && filteredPhotos.every(p => selectedIds.includes(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const selectAll = () => {
    // Compare membership, not just counts: two different sets of equal size are
    // not the same selection.
    setSelectedIds(prev =>
      allVisibleSelected ? prev.filter(id => !visibleIds.has(id)) : filteredPhotos.map(p => p.id)
    );
  };

  const isExporting = exportState !== null;
  const format = settings.defaultOutputFormat;
  const quality = settings.exportQuality;

  const runExport = async (mode: 'zip' | 'folder') => {
    if (exportTargets.length === 0 || isExporting) return;
    setExportError(null);
    setExportState({ done: 0, total: exportTargets.length });

    const onProgress = (done: number, total: number) => setExportState({ done, total });

    try {
      if (mode === 'folder') {
        const written = await exportToDirectory(exportTargets, { format, quality, onProgress });
        if (written === null) return; // user closed the picker
      } else {
        await downloadPhotosAsZip(
          exportTargets,
          { format, quality, onProgress },
          'Cropalot_Family_Photos.zip'
        );
      }
    } catch (err) {
      console.error('Export failed', err);
      setExportError(
        err instanceof Error && /permission|denied/i.test(err.message)
          ? 'Permission to write to that folder was refused.'
          : 'Export failed. Try exporting a smaller selection.'
      );
    } finally {
      setExportState(null);
    }
  };

  const downloadSingle = async (photo: PhotoRecord) => {
    try {
      const blob = await renderForExport(photo, format, quality);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename(photo.title, 'Photo')}.${extensionFor(format)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the download a tick to start before the URL goes away.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error('Download failed', err);
      setExportError('That photo could not be rendered for download.');
    }
  };

  const exportLabel = `${exportTargets.length} ${format.toUpperCase()}`;

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:p-6 md:p-8 space-y-6 pb-20 md:pb-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Extracted Photos Library
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Stored on this device. Edits are non-destructive &mdash; the original crop is kept and
            exports are rendered from it.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={onNavigateToUpload}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs md:text-sm border border-slate-700 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Scan Another Sheet</span>
          </button>

          {/* Writing straight into a folder beats a ZIP for a whole album, but
              only Chromium-based browsers implement the picker. */}
          {canWriteToDirectory() && (
            <button
              onClick={() => runExport('folder')}
              disabled={exportTargets.length === 0 || isExporting}
              title="Write each photo as a separate file into a folder you choose"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs md:text-sm border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              <span>Save to Folder</span>
            </button>
          )}

          <button
            onClick={() => runExport('zip')}
            disabled={exportTargets.length === 0 || isExporting}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderArchive className="w-4 h-4" />
            )}
            <span>
              {isExporting
                ? `Rendering ${exportState.done}/${exportState.total}...`
                : `Export ZIP (${exportLabel})`}
            </span>
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-100"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">{exportError}</p>
          <button
            onClick={() => setExportError(null)}
            className="p-1 rounded-lg text-rose-300/70 hover:text-rose-200 shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Batch Bar */}
      {photos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search titles and tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={selectAll}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              {allVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({filteredPhotos.length})</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  onDeletePhotos(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}

            {photos.length > 0 && selectedIds.length === 0 && (
              <button
                onClick={() => {
                  if (confirm(`Delete all ${photos.length} photos from this device? This cannot be undone.`)) {
                    onClearAll();
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 text-xs font-semibold transition-colors"
              >
                Clear library
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo Cards Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Opening your photo library&hellip;</span>
        </div>
      ) : filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => {
            const isSelected = selectedIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                className={`group bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-2xl ${
                  isSelected
                    ? 'border-emerald-500 shadow-xl shadow-emerald-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center p-3 overflow-hidden">
                  {thumbUrls[photo.id] && (
                    <img
                      src={thumbUrls[photo.id]}
                      alt={photo.title}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                    />
                  )}

                  <button
                    onClick={() => toggleSelect(photo.id)}
                    aria-label={isSelected ? `Deselect ${photo.title}` : `Select ${photo.title}`}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-white hover:border-emerald-400 transition-colors z-10"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-slate-300 text-[10px] font-bold tabular-nums backdrop-blur-sm">
                    {photo.width}&times;{photo.height}
                  </span>

                  {photo.filters.preset !== 'none' && (
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-emerald-400 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                      {photo.filters.preset}
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <input
                      type="text"
                      value={photo.title}
                      aria-label="Photo title"
                      onChange={(e) => onUpdatePhoto({ ...photo, title: e.target.value })}
                      className="bg-transparent font-bold text-sm text-white hover:bg-slate-800/50 focus:bg-slate-800 focus:outline-none w-full px-1 py-0.5 rounded border border-transparent focus:border-slate-700 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {photo.captureDate ? `Taken ${photo.captureDate} · ` : ''}
                      Extracted {new Date(photo.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => setEditingPhoto(photo)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/60 transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Enhance</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => downloadSingle(photo)}
                        title={`Download as ${format.toUpperCase()}`}
                        aria-label={`Download ${photo.title}`}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <Download className="w-4 h-4 hover:text-emerald-400" />
                      </button>

                      <button
                        onClick={() => onDeletePhotos([photo.id])}
                        title="Delete photo"
                        aria-label={`Delete ${photo.title}`}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-white">
              {photos.length === 0 ? 'No photos extracted yet' : 'No photos match that search'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {photos.length === 0
                ? 'Scan or load a photo album sheet to auto-detect, deskew, and crop individual pictures.'
                : 'Try a different title or tag.'}
            </p>
          </div>
          {photos.length === 0 && (
            <button
              onClick={onNavigateToUpload}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Scan Photo Sheet</span>
            </button>
          )}
        </div>
      )}

      {editingPhoto && (
        <PhotoEnhancerModal
          photo={editingPhoto}
          onSave={onUpdatePhoto}
          onClose={() => setEditingPhoto(null)}
        />
      )}
    </div>
  );
};
