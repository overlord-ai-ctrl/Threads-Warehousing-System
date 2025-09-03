import React from 'react';
import { useUpdater } from '../hooks/useUpdater';

export const UpdateStatus: React.FC = () => {
  const {
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    isUpdateReady,
    error,
    crashCount,
    hasUpdate,
    canDownload,
    canInstall,
    isUnstable,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    resetCrashCount,
  } = useUpdater();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  if (!hasUpdate && !isDownloading && !isUpdateReady && !error && crashCount === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">System Updates</h3>
            <p className="text-sm text-gray-500">No updates available</p>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={isChecking}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Update Available */}
      {hasUpdate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Update Available: Version {updateInfo?.version}
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>{updateInfo?.releaseNotes}</p>
                <p className="mt-1 text-xs">
                  Released: {updateInfo?.releaseDate ? new Date(updateInfo.releaseDate).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <div className="mt-3">
                {canDownload && (
                  <button
                    onClick={downloadUpdate}
                    disabled={isDownloading}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? 'Downloading...' : 'Download Update'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress */}
      {isDownloading && downloadProgress && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Downloading Update</h3>
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm text-yellow-700">
                  <span>{formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}</span>
                  <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
                </div>
                <div className="mt-1 w-full bg-yellow-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-yellow-600">
                  {downloadProgress.percent.toFixed(1)}% complete
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Ready */}
      {isUpdateReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800">Update Ready to Install</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>The update has been downloaded and is ready to install.</p>
                <p className="mt-1 text-xs">
                  The application will restart to complete the installation.
                </p>
              </div>
              <div className="mt-3">
                <button
                  onClick={installUpdate}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Install Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crash Warning */}
      {isUnstable && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Application Unstable</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>The application has crashed {crashCount} times recently.</p>
                <p className="mt-1 text-xs">
                  Consider rolling back to a previous version or checking for updates.
                </p>
              </div>
              <div className="mt-3 space-x-2">
                <button
                  onClick={resetCrashCount}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Reset Crash Count
                </button>
                <button
                  onClick={checkForUpdates}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Check for Updates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Update Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-3">
                <button
                  onClick={checkForUpdates}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Check Button */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">System Updates</h3>
            <p className="text-sm text-gray-500">
              {isChecking ? 'Checking for updates...' : 'Check for available updates'}
            </p>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={isChecking}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>
      </div>
    </div>
  );
};
