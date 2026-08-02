/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { ScanSheet, AppSettings } from './types';
import {
  PhotoRecord,
  getAllPhotos,
  putPhotos,
  putPhoto,
  deletePhotos,
  clearPhotos,
  migrateFromLocalStorage,
  requestPersistence
} from './utils/photoStore';

const STORAGE_KEY_SETTINGS = 'cropalot_app_settings';
const OLD_STORAGE_KEY_SETTINGS = 'splitsnap_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  autoDetectOnUpload: true,
  defaultOutputFormat: 'jpeg',
  exportQuality: 0.92,
  autoDeskewSensitivity: 5
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'editor' | 'gallery'>('upload');
  const [currentSheet, setCurrentSheet] = useState<ScanSheet | null>(null);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(true);
  const [isAndroidView, setIsAndroidView] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Settings are a handful of scalars, so localStorage remains the right home
  // for them. Only the photo library moved to IndexedDB.
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_SETTINGS) || localStorage.getItem(OLD_STORAGE_KEY_SETTINGS);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (err) {
      console.error('Failed to read saved settings:', err);
    }
  }, []);

  // Load the library, draining anything an older build left in localStorage.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const migrated = await migrateFromLocalStorage();
        const all = await getAllPhotos();
        if (cancelled) return;
        setPhotos(all);
        if (migrated > 0) {
          setNotice(`Recovered ${migrated} photo${migrated === 1 ? '' : 's'} from this browser's older local storage.`);
        }
      } catch (err) {
        console.error('Could not open the photo library:', err);
        if (!cancelled) {
          setNotice(
            'Your browser would not open local storage for the photo library, so photos will not be kept between visits. Private browsing usually causes this. Export anything you want to keep.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingLibrary(false);
      }
    })();

    // Ask the browser not to evict the library under storage pressure.
    requestPersistence().catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const handleSheetSelected = (sheet: ScanSheet) => {
    setCurrentSheet(sheet);
    setActiveTab('editor');
  };

  const handlePhotosExtracted = useCallback(async (newPhotos: PhotoRecord[]) => {
    setPhotos(prev => [...newPhotos, ...prev]);
    setActiveTab('gallery');
    try {
      await putPhotos(newPhotos);
    } catch (err) {
      console.error('Could not save extracted photos:', err);
      setNotice('These photos could not be written to local storage. Export them before closing this tab.');
    }
  }, []);

  const handleUpdatePhoto = useCallback(async (updated: PhotoRecord) => {
    setPhotos(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    try {
      await putPhoto(updated);
    } catch (err) {
      console.error('Could not save photo changes:', err);
      setNotice('That change could not be saved to local storage.');
    }
  }, []);

  const handleDeletePhotos = useCallback(async (ids: string[]) => {
    const idSet = new Set(ids);
    setPhotos(prev => prev.filter(p => !idSet.has(p.id)));
    try {
      await deletePhotos(ids);
    } catch (err) {
      console.error('Could not delete photos:', err);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    setPhotos([]);
    try {
      await clearPhotos();
    } catch (err) {
      console.error('Could not clear the library:', err);
    }
  }, []);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  const mainContent = (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 relative">
      <NavbarTop
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAndroidView={isAndroidView}
        setIsAndroidView={setIsAndroidView}
        extractedCount={photos.length}
        openSettings={() => setIsSettingsOpen(true)}
        openCamera={() => setIsCameraOpen(true)}
        openOfflineModal={() => setIsOfflineModalOpen(true)}
        openSupportModal={() => setIsSupportModalOpen(true)}
      />

      {/* Storage and migration notices - never let a save fail silently. */}
      {notice && (
        <div
          role="alert"
          className="mx-3 mt-3 sm:mx-6 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-100"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            className="p-1 rounded-lg text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10 shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
              settings={settings}
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
            photos={photos}
            settings={settings}
            isLoading={isLoadingLibrary}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhotos={handleDeletePhotos}
            onClearAll={handleClearAll}
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        )}
      </main>

      <NavbarBottom
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAndroidView={isAndroidView}
        setIsAndroidView={setIsAndroidView}
        extractedCount={photos.length}
        openSettings={() => setIsSettingsOpen(true)}
        openCamera={() => setIsCameraOpen(true)}
        openOfflineModal={() => setIsOfflineModalOpen(true)}
        openSupportModal={() => setIsSupportModalOpen(true)}
      />

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
