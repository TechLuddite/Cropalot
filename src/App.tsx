/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

  // Save extracted photos locally
  const savePhotosLocally = (photos: ExtractedPhoto[]) => {
    setExtractedPhotos(photos);
    try {
      localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
    } catch (err) {
      console.warn('LocalStorage limit reached for photo cache:', err);
    }
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
      try {
        localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(newList));
      } catch (err) {
        console.warn('LocalStorage limit reached for photo cache:', err);
      }
      return newList;
    });
  };

  const handleDeleteBatchPhotos = (ids: string[]) => {
    const idSet = new Set(ids);
    setExtractedPhotos(prev => {
      const newList = prev.filter(p => !idSet.has(p.id));
      try {
        localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(newList));
      } catch (err) {
        console.warn('LocalStorage limit reached for photo cache:', err);
      }
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
