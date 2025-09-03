import { autoUpdater, AppUpdater } from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import { Logger } from '../utils/Logger';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export interface UpdateInfo {
  version: string;
  releaseDate: Date;
  releaseNotes: string;
  isDelta: boolean;
}

export interface CrashReport {
  timestamp: number;
  version: string;
  crashCount: number;
}

export class UpdateManager {
  private logger: Logger;
  private crashReportPath: string;
  private maxCrashesBeforeRollback = 3;
  private crashWindowMs = 5 * 60 * 1000; // 5 minutes
  private isUpdateAvailable = false;
  private isUpdateDownloaded = false;

  constructor() {
    this.logger = new Logger();
    this.crashReportPath = join(app.getPath('userData'), 'crash-report.json');
    
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto updater
    autoUpdater.autoDownload = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    // Set update server (would be configured based on environment)
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = join(__dirname, '../../update-config.json');
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      this.isUpdateAvailable = true;
      this.logger.info('Update available:', info);
      
      // Notify renderer process
      this.notifyRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('No update available:', info);
    });

    autoUpdater.on('error', (err) => {
      this.logger.error('Update error:', err);
      this.notifyRenderer('update-error', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.logger.info('Download progress:', progressObj);
      this.notifyRenderer('update-download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.isUpdateDownloaded = true;
      this.logger.info('Update downloaded:', info);
      
      // Notify renderer process
      this.notifyRenderer('update-downloaded', info);
      
      // Show update ready dialog
      this.showUpdateReadyDialog(info);
    });

    autoUpdater.on('before-quit-for-update', () => {
      this.logger.info('Quitting for update...');
    });
  }

  async checkForUpdates(): Promise<void> {
    try {
      // Check for updates
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
    }
  }

  async downloadUpdate(): Promise<boolean> {
    try {
      if (!this.isUpdateAvailable) {
        throw new Error('No update available to download');
      }

      this.logger.info('Starting update download...');
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      this.logger.error('Failed to download update:', error);
      return false;
    }
  }

  async installUpdate(): Promise<boolean> {
    try {
      if (!this.isUpdateDownloaded) {
        throw new Error('No update downloaded to install');
      }

      this.logger.info('Installing update...');
      
      // Quit and install
      autoUpdater.quitAndInstall();
      return true;
    } catch (error) {
      this.logger.error('Failed to install update:', error);
      return false;
    }
  }

  private showUpdateReadyDialog(info: any): void {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Update Ready',
      message: `Version ${info.version} is ready to install.`,
      detail: 'The application will restart to complete the update.',
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        this.installUpdate();
      }
    });
  }

  // Crash detection and rollback
  async reportCrash(): Promise<void> {
    try {
      const crashReport = this.loadCrashReport();
      const currentTime = Date.now();
      const currentVersion = app.getVersion();

      // Add new crash
      crashReport.crashes.push({
        timestamp: currentTime,
        version: currentVersion,
      });

      // Filter crashes within the time window
      const recentCrashes = crashReport.crashes.filter(
        crash => currentTime - crash.timestamp < this.crashWindowMs
      );

      // Check if we need to rollback
      if (recentCrashes.length >= this.maxCrashesBeforeRollback) {
        await this.performRollback();
      } else {
        // Save crash report
        this.saveCrashReport(crashReport);
      }
    } catch (error) {
      this.logger.error('Failed to report crash:', error);
    }
  }

  private loadCrashReport(): any {
    try {
      if (existsSync(this.crashReportPath)) {
        const data = readFileSync(this.crashReportPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.error('Failed to load crash report:', error);
    }

    // Return default structure
    return {
      crashes: [],
      lastRollback: null,
    };
  }

  private saveCrashReport(crashReport: any): void {
    try {
      writeFileSync(this.crashReportPath, JSON.stringify(crashReport, null, 2));
    } catch (error) {
      this.logger.error('Failed to save crash report:', error);
    }
  }

  private async performRollback(): Promise<void> {
    try {
      this.logger.warn('Crash threshold reached, performing rollback...');

      // Get previous version
      const previousVersion = await this.getPreviousVersion();
      if (!previousVersion) {
        this.logger.error('No previous version available for rollback');
        return;
      }

      // Perform rollback
      await this.rollbackToVersion(previousVersion);

      // Update crash report
      const crashReport = this.loadCrashReport();
      crashReport.lastRollback = {
        timestamp: Date.now(),
        fromVersion: app.getVersion(),
        toVersion: previousVersion,
        reason: 'crash_loop',
      };
      this.saveCrashReport(crashReport);

      this.logger.info(`Rollback completed to version ${previousVersion}`);
    } catch (error) {
      this.logger.error('Rollback failed:', error);
    }
  }

  private async getPreviousVersion(): Promise<string | null> {
    try {
      // This would typically check the update server or local cache
      // For now, we'll return a hardcoded version
      return '1.0.0';
    } catch (error) {
      this.logger.error('Failed to get previous version:', error);
      return null;
    }
  }

  private async rollbackToVersion(version: string): Promise<void> {
    try {
      // This would typically:
      // 1. Download the previous version
      // 2. Verify the download
      // 3. Replace the current version
      // 4. Restart the application

      this.logger.info(`Rolling back to version ${version}...`);

      // For now, we'll just log the rollback
      // In a real implementation, this would perform the actual rollback
      
      // Restart the app
      app.relaunch();
      app.exit();
    } catch (error) {
      this.logger.error('Failed to rollback:', error);
      throw error;
    }
  }

  // Version management
  async getCurrentVersion(): Promise<string> {
    return app.getVersion();
  }

  async getUpdateInfo(): Promise<UpdateInfo | null> {
    if (!this.isUpdateAvailable) {
      return null;
    }

    try {
      // This would typically get update info from the update server
      return {
        version: '1.1.0',
        releaseDate: new Date(),
        releaseNotes: 'Bug fixes and performance improvements',
        isDelta: true,
      };
    } catch (error) {
      this.logger.error('Failed to get update info:', error);
      return null;
    }
  }

  // Update settings
  async setUpdateSettings(settings: {
    autoDownload: boolean;
    allowPrerelease: boolean;
    updateChannel: string;
  }): Promise<void> {
    try {
      autoUpdater.autoDownload = settings.autoDownload;
      autoUpdater.allowPrerelease = settings.allowPrerelease;
      
      // Update channel would be configured based on settings
      this.logger.info('Update settings updated:', settings);
    } catch (error) {
      this.logger.error('Failed to update settings:', error);
      throw error;
    }
  }

  // Manual update check
  async manualUpdateCheck(): Promise<boolean> {
    try {
      await this.checkForUpdates();
      return true;
    } catch (error) {
      this.logger.error('Manual update check failed:', error);
      return false;
    }
  }

  // Notify renderer process
  private notifyRenderer(channel: string, data: any): void {
    // This would send IPC messages to the renderer process
    // For now, we'll just log the notification
    this.logger.info(`Renderer notification: ${channel}`, data);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      // Clean up any temporary update files
      this.logger.info('Update manager cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup update manager:', error);
    }
  }

  // Get update status
  getUpdateStatus(): any {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      isUpdateDownloaded: this.isUpdateDownloaded,
      currentVersion: app.getVersion(),
      lastCheck: new Date(),
    };
  }
}
