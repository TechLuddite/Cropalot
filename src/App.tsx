/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { NavbarTop, NavbarBottom } from './components/Navbar';
import { SheetUploader } from './components/SheetUploader';
import { DetectionEditor } from './components/DetectionEditor';
import { GalleryView } from './components/GalleryView';
import { CameraModal } from './components/CameraModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflinePrivacyModal } from './components/OfflinePrivacyModal';
import { SupportModal } from './components/SupportModal';
import { AndroidFrame } from './components/AndroidFrame';
import { ScanSheet, ExtractedPhoto, AppSettings } from './types';

const STORAGE_KEY_PHOTOS = 'cropalot_extracted_photos';
const STORAGE_KEY_SETTINGS = 'cropalot_app_settings';
const OLD_STORAGE_KEY_PHOTOS = 'splitsnap_extracted_photos';
const OLD_STORAGE_KEY_SETTINGS = 'splitsnap_app_settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'editor' | 'gallery'>('upload');
  const [currentSheet, setCurrentSheet] = useState<ScanSheet | null>(null);
  const [extractedPhotos, setExtractedPhotos] = useState<ExtractedPhoto[]>([]);
  const [isAndroidView, setIsAndroidView] = useState<boolean>(false);

  const [storageError, setStorageError] = useState<string | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>({
    autoDetectOnUpload: true,
    defaultOutputFormat: 'png',
    jpegQuality: 0.9,
    autoDeskewSensitivity: 5,
    defaultTrimMargin: 2,
    theme: 'dark',
    isProUnlocked: false
  });

  // Load saved state from LocalStorage
  useEffect(() => {
    try {
      const savedPhotos = localStorage.getItem(STORAGE_KEY_PHOTOS) || localStorage.getItem(OLD_STORAGE_KEY_PHOTOS);
      if (savedPhotos) {
        setExtractedPhotos(JSON.parse(savedPhotos));
      }
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS) || localStorage.getItem(OLD_STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (err) {
      console.error('Failed to load local storage:', err);
    }
  }, []);

  /**
   * Persists the photo library to localStorage, reporting failure to the user
   * instead of swallowing it.
   *
   * localStorage caps an origin at roughly 5 MB. A single 4x6" print scanned at
   * 300 dpi serialises to a ~6 MB PNG data URL, and every photo is stored twice
   * (the raw crop plus the enhanced render) - so the very first real scan
   * exceeds the budget. Previously that threw, got logged to the console, and
   * left the user believing a library that would vanish on reload had been
   * saved. Until the storage layer moves to IndexedDB/OPFS Blobs, at least say
   * so out loud.
   */
  const persistPhotos = (photos: ExtractedPhoto[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
      setStorageError(null);
    } catch {
      // Drop the stale entry so a reload shows an empty library rather than a
      // silently out-of-date one.
      try { localStorage.removeItem(STORAGE_KEY_PHOTOS); } catch { /* nothing left to do */ }
      setStorageError(
        photos.length > 0
          ? 'These photos are too large for browser storage, so they will be lost if you reload or close this tab. Export them before leaving.'
          : null
      );
    }
  };

  // Save extracted photos locally
  const savePhotosLocally = (photos: ExtractedPhoto[]) => {
    setExtractedPhotos(photos);
    persistPhotos(photos);
  };

  // Handlers
  const handleSheetSelected = (sheet: ScanSheet) => {
    setCurrentSheet(sheet);
    setActiveTab('editor');
  };

  const handlePhotosExtracted = (newPhotos: ExtractedPhoto[]) => {
    const updated = [...newPhotos, ...extractedPhotos];
    savePhotosLocally(updated);
    setActiveTab('gallery');
  };

  const handleUpdatePhoto = (updated: ExtractedPhoto) => {
    const newList = extractedPhotos.map(p => (p.id === updated.id ? updated : p));
    savePhotosLocally(newList);
  };

  const handleDeletePhoto = (id: string) => {
    setExtractedPhotos(prev => {
      const newList = prev.filter(p => p.id !== id);
      persistPhotos(newList);
      return newList;
    });
  };

  const handleDeleteBatchPhotos = (ids: string[]) => {
    const idSet = new Set(ids);
    setExtractedPhotos(prev => {
      const newList = prev.filter(p => !idSet.has(p.id));
      persistPhotos(newList);
      return newList;
    });
  };

  const handleClearAll = () => {
    savePhotosLocally([]);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  // Main UI Content rendering
  const mainContent = (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 relative">
      {/* Top Bar Navigation */}
      <NavbarTop
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAndroidView={isAndroidView}
        setIsAndroidView={setIsAndroidView}
        extractedCount={extractedPhotos.length}
        openSettings={() => setIsSettingsOpen(true)}
        openCamera={() => setIsCameraOpen(true)}
        openOfflineModal={() => setIsOfflineModalOpen(true)}
        openSupportModal={() => setIsSupportModalOpen(true)}
      />

      {/* Storage failure notice - never let a save fail silently */}
      {storageError && (
        <div
          role="alert"
          className="mx-3 mt-3 sm:mx-6 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-100"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">
            <strong className="font-bold text-amber-300">Not saved to this browser. </strong>
            {storageError}
          </p>
          <button
            onClick={() => setStorageError(null)}
            className="p-1 rounded-lg text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10 shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tab Screen */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'upload' && (
          <SheetUploader
            onSheetSelected={handleSheetSelected}
            openCamera={() => setIsCameraOpen(true)}
            openOfflineModal={() => setIsOfflineModalOpen(true)}
            openSupportModal={() => setIsSupportModalOpen(true)}
          />
        )}

        {activeTab === 'editor' && (
          currentSheet ? (
            <DetectionEditor
              sheet={currentSheet}
              onPhotosExtracted={handlePhotosExtracted}
              onBackToUpload={() => setActiveTab('upload')}
            />
          ) : (
            <div className="text-center py-20 max-w-md mx-auto space-y-4 px-4">
              <h3 className="font-bold text-lg text-white">No active scan sheet loaded</h3>
              <p className="text-xs text-slate-400">
                Please upload a photo sheet scan or choose a sample sheet to start auto cropping & deskewing.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Scan Photo Sheet
              </button>
            </div>
          )
        )}

        {activeTab === 'gallery' && (
          <GalleryView
            photos={extractedPhotos}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhoto={handleDeletePhoto}
            onDeleteBatchPhotos={handleDeleteBatchPhotos}
            onClearAll={handleClearAll}
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        )}
      </main>

      {/* Bottom Navigation Bar for Mobile / Phone Resolution */}
      <NavbarBottom
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAndroidView={isAndroidView}
        setIsAndroidView={setIsAndroidView}
        extractedCount={extractedPhotos.length}
        openSettings={() => setIsSettingsOpen(true)}
        openCamera={() => setIsCameraOpen(true)}
        openOfflineModal={() => setIsOfflineModalOpen(true)}
        openSupportModal={() => setIsSupportModalOpen(true)}
      />

      {/* Modals */}
      {isCameraOpen && (
        <CameraModal
          onCapture={handleSheetSelected}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
          openOfflineModal={() => setIsOfflineModalOpen(true)}
          openSupportModal={() => setIsSupportModalOpen(true)}
        />
      )}

      <OfflinePrivacyModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        openSupportModal={() => setIsSupportModalOpen(true)}
      />

      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );

  return isAndroidView ? (
    <AndroidFrame activeTab={activeTab} setActiveTab={setActiveTab}>
      {mainContent}
    </AndroidFrame>
  ) : (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {mainContent}
    </div>
  );
}
