import React, { useState } from 'react';
import { ExtractedPhoto } from '../types';
import { downloadPhotosAsZip } from '../utils/imageProcessing';
import { PhotoEnhancerModal } from './PhotoEnhancerModal';
import { Download, SlidersHorizontal, Trash2, CheckSquare, Square, Search, Sparkles, FolderArchive, Plus, Image as ImageIcon } from 'lucide-react';

interface GalleryViewProps {
  photos: ExtractedPhoto[];
  onUpdatePhoto: (photo: ExtractedPhoto) => void;
  onDeletePhoto: (id: string) => void;
  onDeleteBatchPhotos?: (ids: string[]) => void;
  onClearAll: () => void;
  onNavigateToUpload: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  onUpdatePhoto,
  onDeletePhoto,
  onDeleteBatchPhotos,
  onClearAll,
  onNavigateToUpload
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingPhoto, setEditingPhoto] = useState<ExtractedPhoto | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filtered photos
  const filteredPhotos = photos.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredPhotos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPhotos.map(p => p.id));
    }
  };

  // Batch Export as ZIP
  const handleBatchDownloadZip = async () => {
    const toExport = photos.filter(p =>
      selectedIds.length > 0 ? selectedIds.includes(p.id) : true
    );
    if (toExport.length === 0) return;

    setIsExporting(true);
    try {
      await downloadPhotosAsZip(
        toExport.map(p => ({ title: p.title, url: p.enhancedUrl })),
        'Cropalot_Family_Photos.zip'
      );
    } catch (err) {
      console.error('Failed to export ZIP', err);
    } finally {
      setIsExporting(false);
    }
  };

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
            High-res auto-cropped & deskewed family photos saved locally in browser memory.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={onNavigateToUpload}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs md:text-sm border border-slate-700 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Scan Another Sheet</span>
          </button>

          <button
            onClick={handleBatchDownloadZip}
            disabled={photos.length === 0 || isExporting}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
          >
            <FolderArchive className="w-4 h-4" />
            <span>
              {isExporting ? 'Creating ZIP...' : `Export ZIP (${selectedIds.length > 0 ? selectedIds.length : photos.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Filter & Batch Bar */}
      {photos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search photo titles..."
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
              {selectedIds.length === filteredPhotos.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({filteredPhotos.length})</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  if (onDeleteBatchPhotos) {
                    onDeleteBatchPhotos(selectedIds);
                  } else {
                    selectedIds.forEach(id => onDeletePhoto(id));
                  }
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo Cards Grid */}
      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => {
            const isSelected = selectedIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                className={`group bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-2xl hover:scale-[1.01] ${
                  isSelected
                    ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 bg-slate-900/90'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Photo Image Box */}
                <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center p-3 overflow-hidden">
                  <img
                    src={photo.enhancedUrl}
                    alt={photo.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md transition-transform group-hover:scale-105"
                  />

                  {/* Selection Checkbox Overlay */}
                  <button
                    onClick={() => toggleSelect(photo.id)}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-white hover:border-emerald-400 transition-colors z-10"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {/* Preset Badge */}
                  {photo.filters.preset !== 'none' && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-emerald-400 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                      {photo.filters.preset}
                    </span>
                  )}
                </div>

                {/* Info & Footer Actions */}
                <div className="p-4 space-y-3">
                  <div>
                    <input
                      type="text"
                      value={photo.title}
                      onChange={(e) => onUpdatePhoto({ ...photo, title: e.target.value })}
                      className="bg-transparent font-bold text-sm text-white hover:bg-slate-800/50 focus:bg-slate-800 focus:outline-none w-full px-1 py-0.5 rounded border border-transparent focus:border-slate-700 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Auto Deskewed • {new Date(photo.createdAt).toLocaleDateString()}
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
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = photo.enhancedUrl;
                          a.download = `${photo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                          a.click();
                        }}
                        title="Download Photo"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <Download className="w-4 h-4 text-slate-300 hover:text-emerald-400" />
                      </button>

                      <button
                        onClick={() => onDeletePhoto(photo.id)}
                        title="Delete Photo"
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
            <h3 className="font-bold text-lg text-white">No photos extracted yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Scan or load a photo album sheet to auto-detect, deskew, and crop individual pictures.
            </p>
          </div>
          <button
            onClick={onNavigateToUpload}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Scan Photo Sheet</span>
          </button>
        </div>
      )}

      {/* Single Photo Enhancer Modal */}
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
