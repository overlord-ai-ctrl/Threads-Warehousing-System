import { app, BrowserWindow, ipcMain, session, shell, dialog } from 'electron';
import { join } from 'path';
import { DatabaseManager } from './database/DatabaseManager';
import { PrinterManager } from './hardware/PrinterManager';
import { ScannerManager } from './hardware/ScannerManager';
import { UpdateManager } from './updates/UpdateManager';
import { SecurityManager } from './security/SecurityManager';
import { JobQueue } from './queue/JobQueue';
import { Logger } from './utils/Logger';

class ThreadsOpsApp {
  private mainWindow: BrowserWindow | null = null;
  private databaseManager: DatabaseManager;
  private printerManager: PrinterManager;
  private scannerManager: ScannerManager;
  private updateManager: UpdateManager;
  private securityManager: SecurityManager;
  private jobQueue: JobQueue;
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
    this.databaseManager = new DatabaseManager();
    this.printerManager = new PrinterManager();
    this.scannerManager = new ScannerManager();
    this.updateManager = new UpdateManager();
    this.securityManager = new SecurityManager();
    this.jobQueue = new JobQueue();
  }

  async initialize() {
    try {
      // Security: Block unsigned code
      if (process.platform === 'win32') {
        app.setAsDefaultProtocolClient('threads-ops');
      }

      // Security: Prevent new window creation
      app.on('web-contents-created', (event, contents) => {
        contents.on('new-window', (event, navigationUrl) => {
          event.preventDefault();
          shell.openExternal(navigationUrl);
        });
      });

      // Security: Disable navigation
      app.on('web-contents-created', (event, contents) => {
        contents.on('will-navigate', (event, navigationUrl) => {
          const parsedUrl = new URL(navigationUrl);
          if (parsedUrl.origin !== 'http://localhost:3000') {
            event.preventDefault();
          }
        });
      });

      // Initialize core services
      await this.databaseManager.initialize();
      await this.printerManager.initialize();
      await this.scannerManager.initialize();
      await this.jobQueue.initialize();

      // Check for updates
      await this.updateManager.checkForUpdates();

      this.logger.info('Threads Ops initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize app:', error);
      dialog.showErrorBox('Initialization Error', 'Failed to initialize Threads Ops. Please restart the application.');
      app.quit();
    }
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      autoHideMenuBar: true,
      icon: join(__dirname, '../assets/icon.png'),
    });

    // Set main window reference in managers
    this.printerManager.setMainWindow(this.mainWindow);
    this.scannerManager.setMainWindow(this.mainWindow);
    this.jobQueue.setMainWindow(this.mainWindow);

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // Focus the window
      if (this.mainWindow) {
        this.mainWindow.focus();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window focus
    this.mainWindow.on('focus', () => {
      // Refresh hardware status when window gains focus
      this.refreshHardwareStatus();
    });

    // Handle app activation (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      } else if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
  }

  private setupIpcHandlers(): void {
    // Shell operations
    ipcMain.handle('shell:open-external', async (_, url: string) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to open external URL:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Clipboard operations
    ipcMain.handle('clipboard:write-text', async (_, text: string) => {
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to write to clipboard:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('clipboard:read-text', async () => {
      try {
        const { clipboard } = require('electron');
        const text = clipboard.readText();
        return { success: true, text };
      } catch (error) {
        this.logger.error('Failed to read from clipboard:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // App information
    ipcMain.handle('app:get-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('app:get-name', () => {
      return app.getName();
    });

    ipcMain.handle('app:get-path', (_, name: string) => {
      try {
        return app.getPath(name as any);
      } catch (error) {
        return null;
      }
    });

    // System information
    ipcMain.handle('system:get-platform', () => {
      return process.platform;
    });

    ipcMain.handle('system:get-arch', () => {
      return process.arch;
    });

    ipcMain.handle('system:get-node-version', () => {
      return process.version;
    });

    // File operations
    ipcMain.handle('file:show-open-dialog', async (_, options: any) => {
      try {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(this.mainWindow!, options);
        return result;
      } catch (error) {
        this.logger.error('Failed to show open dialog:', error);
        return { canceled: true, filePaths: [] };
      }
    });

    ipcMain.handle('file:show-save-dialog', async (_, options: any) => {
      try {
        const { dialog } = require('electron');
        const result = await dialog.showSaveDialog(this.mainWindow!, options);
        return result;
      } catch (error) {
        this.logger.error('Failed to show save dialog:', error);
        return { canceled: true, filePath: '' };
      }
    });
  }

  private refreshHardwareStatus(): void {
    try {
      // Refresh printer status
      this.printerManager.getPrinterStatuses();
      
      // Refresh scanner status
      this.scannerManager.getScanStats();
      
      // Refresh queue stats
      this.jobQueue.getStats();
      
      this.logger.info('Hardware status refreshed');
    } catch (error) {
      this.logger.error('Error refreshing hardware status:', error);
    }
  }

  private setupGlobalShortcuts(): void {
    // Global shortcuts for kiosk mode
    if (process.platform === 'darwin') {
      // macOS shortcuts
      // These would be registered in the ScannerManager
    } else if (process.platform === 'win32') {
      // Windows shortcuts
      // These would be registered in the ScannerManager
    }
  }

  private handleAppEvents(): void {
    // Handle app ready
    app.whenReady().then(async () => {
      await this.initialize();
      this.createWindow();
      this.setupIpcHandlers();
      this.setupGlobalShortcuts();
    });

    // Handle all windows closed (macOS)
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app before quit
    app.on('before-quit', async (event) => {
      event.preventDefault();
      await this.cleanup();
      app.quit();
    });

    // Handle app quit
    app.on('quit', () => {
      this.logger.info('Threads Ops shutting down');
    });

    // Handle app second instance (Windows)
    if (process.platform === 'win32') {
      const gotTheLock = app.requestSingleInstanceLock();
      if (!gotTheLock) {
        app.quit();
        return;
      }

      app.on('second-instance', () => {
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.focus();
        }
      });
    }
  }

  private async cleanup(): Promise<void> {
    try {
      this.logger.info('Starting cleanup...');
      
      // Cleanup managers
      this.printerManager.cleanup();
      this.scannerManager.cleanup();
      this.jobQueue.cleanup();
      
      // Close database connections
      await this.databaseManager.cleanup();
      
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  // Public method to start the app
  start(): void {
    this.handleAppEvents();
  }
}

// Create and start the app
const app = new ThreadsOpsApp();
app.start();
