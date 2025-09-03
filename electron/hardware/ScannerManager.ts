import { BrowserWindow, ipcMain, globalShortcut } from 'electron';
import { Logger } from '../utils/Logger';

export interface ScanEvent {
  id: string;
  barcode: string;
  type: 'order_qr' | 'sku' | 'bin' | 'unknown';
  timestamp: string;
  source: 'scanner' | 'manual' | 'test';
  confidence?: number;
}

export interface ScannerConfig {
  debounceMs: number;
  enableGlobalCapture: boolean;
  testMode: boolean;
  supportedTypes: string[];
}

export class ScannerManager {
  private logger: Logger;
  private mainWindow?: BrowserWindow;
  private scanBuffer: string = '';
  private debounceTimer?: NodeJS.Timeout;
  private config: ScannerConfig;
  private isCapturing: boolean = false;
  private scanHistory: ScanEvent[] = [];
  private testMode: boolean = false;

  constructor() {
    this.logger = new Logger();
    this.config = {
      debounceMs: 300, // 300ms debounce for most scanners
      enableGlobalCapture: true,
      testMode: false,
      supportedTypes: ['order_qr', 'sku', 'bin'],
    };
    
    this.setupIpcHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Start global keyboard capture for scanner input
      if (this.config.enableGlobalCapture) {
        this.startGlobalCapture();
      }
      
      this.logger.info('ScannerManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ScannerManager:', error);
      throw error;
    }
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('scanner:get-config', async () => {
      return this.config;
    });

    ipcMain.handle('scanner:set-config', async (_, config: Partial<ScannerConfig>) => {
      this.updateConfig(config);
      return this.config;
    });

    ipcMain.handle('scanner:start-capture', async () => {
      this.startGlobalCapture();
      return { success: true };
    });

    ipcMain.handle('scanner:stop-capture', async () => {
      this.stopGlobalCapture();
      return { success: true };
    });

    ipcMain.handle('scanner:get-history', async () => {
      return this.scanHistory.slice(-100); // Last 100 scans
    });

    ipcMain.handle('scanner:clear-history', async () => {
      this.scanHistory = [];
      return { success: true };
    });

    ipcMain.handle('scanner:test-scan', async (_, barcode: string, type: string) => {
      return this.simulateScan(barcode, type as any);
    });

    ipcMain.handle('scanner:get-status', async () => {
      return {
        isCapturing: this.isCapturing,
        scanCount: this.scanHistory.length,
        lastScan: this.scanHistory[this.scanHistory.length - 1],
        config: this.config,
      };
    });
  }

  private startGlobalCapture(): void {
    if (this.isCapturing) return;

    try {
      // Register global shortcuts for common scanner prefixes
      globalShortcut.register('CommandOrControl+Shift+S', () => {
        this.logger.info('Scanner test mode activated via global shortcut');
        this.testMode = !this.testMode;
      });

      // Start listening for all key events
      this.isCapturing = true;
      this.logger.info('Global scanner capture started');
    } catch (error) {
      this.logger.error('Failed to start global capture:', error);
      this.isCapturing = false;
    }
  }

  private stopGlobalCapture(): void {
    if (!this.isCapturing) return;

    try {
      globalShortcut.unregisterAll();
      this.isCapturing = false;
      this.logger.info('Global scanner capture stopped');
    } catch (error) {
      this.logger.error('Failed to stop global capture:', error);
    }
  }

  private updateConfig(newConfig: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update debounce if changed
    if (newConfig.debounceMs !== undefined) {
      this.config.debounceMs = newConfig.debounceMs;
    }
    
    // Update capture mode if changed
    if (newConfig.enableGlobalCapture !== undefined) {
      if (newConfig.enableGlobalCapture && !this.isCapturing) {
        this.startGlobalCapture();
      } else if (!newConfig.enableGlobalCapture && this.isCapturing) {
        this.stopGlobalCapture();
      }
    }
    
    this.logger.info('Scanner configuration updated:', this.config);
  }

  // Handle key input from scanner (called by main process)
  handleKeyInput(key: string): void {
    if (!this.isCapturing) return;

    // Most barcode scanners send a return/enter key after the barcode
    if (key === 'Enter' || key === 'Return') {
      this.processScannedBarcode();
    } else if (key === 'Escape') {
      // Clear buffer on escape
      this.scanBuffer = '';
      this.clearDebounceTimer();
    } else if (key.length === 1) {
      // Add character to buffer
      this.scanBuffer += key;
      this.startDebounceTimer();
    }
  }

  private startDebounceTimer(): void {
    this.clearDebounceTimer();
    
    this.debounceTimer = setTimeout(() => {
      // If no enter key received within debounce time, process as complete scan
      if (this.scanBuffer.length > 0) {
        this.processScannedBarcode();
      }
    }, this.config.debounceMs);
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  private processScannedBarcode(): void {
    if (this.scanBuffer.length === 0) return;

    const barcode = this.scanBuffer.trim();
    this.scanBuffer = '';
    this.clearDebounceTimer();

    // Determine scan type
    const scanType = this.determineScanType(barcode);
    
    // Create scan event
    const scanEvent: ScanEvent = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      barcode,
      type: scanType,
      timestamp: new Date().toISOString(),
      source: 'scanner',
      confidence: this.calculateConfidence(barcode, scanType),
    };

    // Add to history
    this.scanHistory.push(scanEvent);
    
    // Keep only last 1000 scans
    if (this.scanHistory.length > 1000) {
      this.scanHistory = this.scanHistory.slice(-1000);
    }

    // Emit scan event to renderer
    if (this.mainWindow) {
      this.mainWindow.webContents.send('scanner:scan-event', scanEvent);
    }

    this.logger.info(`Barcode scanned: ${barcode} (${scanType})`);
  }

  private determineScanType(barcode: string): 'order_qr' | 'sku' | 'bin' | 'unknown' {
    // Order QR codes typically start with specific prefixes
    if (barcode.startsWith('ORDER_') || barcode.startsWith('THREADS_')) {
      return 'order_qr';
    }
    
    // SKUs are typically alphanumeric with specific patterns
    if (/^[A-Z0-9]{6,12}$/.test(barcode)) {
      return 'sku';
    }
    
    // Bin locations are typically shorter and may contain letters
    if (/^[A-Z0-9]{2,6}$/.test(barcode)) {
      return 'bin';
    }
    
    // Check if it's a Shopify order number
    if (/^#\d{4,6}$/.test(barcode)) {
      return 'order_qr';
    }
    
    // Check if it's a standard barcode format
    if (/^\d{8,13}$/.test(barcode)) {
      return 'sku';
    }
    
    return 'unknown';
  }

  private calculateConfidence(barcode: string, type: string): number {
    let confidence = 0.5; // Base confidence
    
    switch (type) {
      case 'order_qr':
        if (barcode.startsWith('ORDER_') || barcode.startsWith('THREADS_')) {
          confidence = 0.95;
        } else if (barcode.startsWith('#')) {
          confidence = 0.9;
        }
        break;
        
      case 'sku':
        if (/^[A-Z0-9]{8,12}$/.test(barcode)) {
          confidence = 0.9;
        } else if (/^\d{12,13}$/.test(barcode)) {
          confidence = 0.85; // UPC/EAN
        }
        break;
        
      case 'bin':
        if (/^[A-Z]\d{2}[A-Z]?$/.test(barcode)) {
          confidence = 0.95; // A01B format
        } else if (/^[A-Z]{2}\d{2}$/.test(barcode)) {
          confidence = 0.9; // AA01 format
        }
        break;
        
      default:
        confidence = 0.3;
    }
    
    return Math.min(confidence, 0.95);
  }

  // Test harness for simulating scans
  simulateScan(barcode: string, type: 'order_qr' | 'sku' | 'bin' | 'unknown'): ScanEvent {
    const scanEvent: ScanEvent = {
      id: `test_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      barcode,
      type,
      timestamp: new Date().toISOString(),
      source: 'test',
      confidence: this.calculateConfidence(barcode, type),
    };

    // Add to history
    this.scanHistory.push(scanEvent);
    
    // Emit scan event to renderer
    if (this.mainWindow) {
      this.mainWindow.webContents.send('scanner:scan-event', scanEvent);
    }

    this.logger.info(`Test scan simulated: ${barcode} (${type})`);
    return scanEvent;
  }

  // Manual scan entry (for testing/debugging)
  manualScan(barcode: string, type?: 'order_qr' | 'sku' | 'bin' | 'unknown'): ScanEvent {
    const scanType = type || this.determineScanType(barcode);
    
    const scanEvent: ScanEvent = {
      id: `manual_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      barcode,
      type: scanType,
      timestamp: new Date().toISOString(),
      source: 'manual',
      confidence: this.calculateConfidence(barcode, scanType),
    };

    // Add to history
    this.scanHistory.push(scanEvent);
    
    // Emit scan event to renderer
    if (this.mainWindow) {
      this.mainWindow.webContents.send('scanner:scan-event', scanEvent);
    }

    this.logger.info(`Manual scan entered: ${barcode} (${scanType})`);
    return scanEvent;
  }

  // Get scan statistics
  getScanStats(): {
    totalScans: number;
    scansByType: Record<string, number>;
    scansBySource: Record<string, number>;
    averageConfidence: number;
    last24Hours: number;
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const scansByType: Record<string, number> = {};
    const scansBySource: Record<string, number> = {};
    let totalConfidence = 0;
    let last24Hours = 0;
    
    this.scanHistory.forEach(scan => {
      // Count by type
      scansByType[scan.type] = (scansByType[scan.type] || 0) + 1;
      
      // Count by source
      scansBySource[scan.source] = (scansBySource[scan.source] || 0) + 1;
      
      // Sum confidence
      totalConfidence += scan.confidence || 0;
      
      // Count last 24 hours
      if (new Date(scan.timestamp) > oneDayAgo) {
        last24Hours++;
      }
    });
    
    return {
      totalScans: this.scanHistory.length,
      scansByType,
      scansBySource,
      averageConfidence: this.scanHistory.length > 0 ? totalConfidence / this.scanHistory.length : 0,
      last24Hours,
    };
  }

  // Search scan history
  searchScans(query: string, type?: string, source?: string): ScanEvent[] {
    return this.scanHistory.filter(scan => {
      const matchesQuery = scan.barcode.toLowerCase().includes(query.toLowerCase());
      const matchesType = !type || scan.type === type;
      const matchesSource = !source || scan.source === source;
      
      return matchesQuery && matchesType && matchesSource;
    });
  }

  // Export scan history
  exportScanHistory(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.scanHistory, null, 2);
    } else {
      // CSV format
      const headers = ['ID', 'Barcode', 'Type', 'Timestamp', 'Source', 'Confidence'];
      const rows = this.scanHistory.map(scan => [
        scan.id,
        scan.barcode,
        scan.type,
        scan.timestamp,
        scan.source,
        scan.confidence || '',
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  getScanHistory(): ScanEvent[] {
    return [...this.scanHistory];
  }

  cleanup(): void {
    this.stopGlobalCapture();
    this.clearDebounceTimer();
    this.logger.info('ScannerManager cleaned up');
  }
}
