import { useState, useEffect, useCallback } from 'react';
import { useElectron } from './useElectron';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  isDelta: boolean;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export const useUpdater = () => {
  const { isElectron, invoke } = useElectron();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crashCount, setCrashCount] = useState(0);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!isElectron) return;

    try {
      setIsChecking(true);
      setError(null);
      
      await invoke('updater:check-for-updates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  }, [isElectron, invoke]);

  // Download update
  const downloadUpdate = useCallback(async () => {
    if (!isElectron || !updateInfo) return;

    try {
      setIsDownloading(true);
      setError(null);
      
      await invoke('updater:download-update');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download update');
      setIsDownloading(false);
    }
  }, [isElectron, invoke, updateInfo]);

  // Install update
  const installUpdate = useCallback(async () => {
    if (!isElectron || !isUpdateReady) return;

    try {
      await invoke('updater:install-update');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install update');
    }
  }, [isElectron, invoke, isUpdateReady]);

  // Get crash count
  const getCrashCount = useCallback(async () => {
    if (!isElectron) return;

    try {
      const count = await invoke('updater:get-crash-count');
      setCrashCount(count || 0);
    } catch (err) {
      console.error('Failed to get crash count:', err);
    }
  }, [isElectron, invoke]);

  // Reset crash count
  const resetCrashCount = useCallback(async () => {
    if (!isElectron) return;

    try {
      await invoke('updater:reset-crash-count');
      setCrashCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset crash count');
    }
  }, [isElectron, invoke]);

  // Set up event listeners
  useEffect(() => {
    if (!isElectron) return;

    const handleUpdateAvailable = (info: UpdateInfo) => {
      setUpdateInfo(info);
      setError(null);
    };

    const handleUpdateDownloadProgress = (progress: UpdateProgress) => {
      setDownloadProgress(progress);
    };

    const handleUpdateDownloaded = (info: any) => {
      setIsUpdateReady(true);
      setIsDownloading(false);
      setDownloadProgress(null);
    };

    const handleUpdateError = (err: any) => {
      setError(err.message || 'Update error occurred');
      setIsChecking(false);
      setIsDownloading(false);
    };

    const handleCrashThreshold = (data: any) => {
      setCrashCount(data.crashCount);
      setError(`Application has crashed ${data.crashCount} times. Consider rolling back.`);
    };

    // Listen for updater events
    window.electronAPI?.on('updater:update-available', handleUpdateAvailable);
    window.electronAPI?.on('updater:download-progress', handleUpdateDownloadProgress);
    window.electronAPI?.on('updater:update-downloaded', handleUpdateDownloaded);
    window.electronAPI?.on('updater:error', handleUpdateError);
    window.electronAPI?.on('updater:crash-threshold', handleCrashThreshold);

    // Get initial crash count
    getCrashCount();

    return () => {
      // Clean up event listeners
      window.electronAPI?.removeAllListeners('updater:update-available');
      window.electronAPI?.removeAllListeners('updater:download-progress');
      window.electronAPI?.removeAllListeners('updater:update-downloaded');
      window.electronAPI?.removeAllListeners('updater:error');
      window.electronAPI?.removeAllListeners('updater:crash-threshold');
    };
  }, [isElectron, getCrashCount]);

  // Auto-check for updates on mount
  useEffect(() => {
    if (isElectron) {
      // Check for updates after a short delay
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isElectron, checkForUpdates]);

  return {
    // State
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    isUpdateReady,
    error,
    crashCount,
    
    // Actions
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    resetCrashCount,
    
    // Computed
    hasUpdate: !!updateInfo,
    canDownload: !!updateInfo && !isDownloading,
    canInstall: isUpdateReady,
    isUnstable: crashCount >= 3,
  };
};
