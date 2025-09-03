import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger';

const execAsync = promisify(exec);

export interface PrintLabelRequest {
  orderId: string;
  bytes?: Buffer;
  zpl?: string;
  pdfUrl?: string;
  printerName: string;
  idempotencyKey: string;
  format: 'zpl' | 'pdf';
}

export interface LabelCacheEntry {
  orderId: string;
  format: 'zpl' | 'pdf';
  hash: string;
  printedAt: string;
  printerName: string;
  idempotencyKey: string;
}

export interface PrinterStatus {
  name: string;
  isOnline: boolean;
  lastHeartbeat: string;
  errorCount: number;
  lastError?: string;
}

export class PrinterManager {
  private logger: Logger;
  private labelCache: Map<string, LabelCacheEntry> = new Map();
  private printerStatuses: Map<string, PrinterStatus> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private mainWindow?: BrowserWindow;

  constructor() {
    this.logger = new Logger();
    this.setupIpcHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Load existing label cache from disk
      await this.loadLabelCache();
      
      // Start printer health monitoring
      this.startHeartbeat();
      
      // Discover available printers
      await this.discoverPrinters();
      
      this.logger.info('PrinterManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PrinterManager:', error);
      throw error;
    }
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('printer:print-label', async (_, request: PrintLabelRequest) => {
      return this.printLabel(request);
    });

    ipcMain.handle('printer:get-status', async () => {
      return Array.from(this.printerStatuses.values());
    });

    ipcMain.handle('printer:get-cache', async (_, orderId: string) => {
      return this.labelCache.get(orderId);
    });

    ipcMain.handle('printer:reprint', async (_, orderId: string, printerName: string) => {
      return this.reprintLabel(orderId, printerName);
    });
  }

  async printLabel(request: PrintLabelRequest): Promise<{ success: boolean; labelId?: string; error?: string }> {
    try {
      // Check idempotency - don't re-print if same hash+key in last 24h
      const cacheKey = `${request.orderId}_${request.idempotencyKey}`;
      const existingEntry = this.labelCache.get(cacheKey);
      
      if (existingEntry) {
        const hoursSincePrint = (Date.now() - new Date(existingEntry.printedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSincePrint < 24) {
          this.logger.info(`Label already printed for ${request.orderId} with key ${request.idempotencyKey}`);
          return { success: true, labelId: existingEntry.hash };
        }
      }

      // Generate hash for this print job
      const content = request.zpl || request.bytes || request.pdfUrl || '';
      const hash = this.generateHash(content);
      
      // Attempt to print
      const printResult = await this.sendToPrinter(request);
      
      if (printResult.success) {
        // Cache successful print
        const cacheEntry: LabelCacheEntry = {
          orderId: request.orderId,
          format: request.format,
          hash,
          printedAt: new Date().toISOString(),
          printerName: request.printerName,
          idempotencyKey: request.idempotencyKey,
        };
        
        this.labelCache.set(cacheKey, cacheEntry);
        await this.saveLabelCache();
        
        // Update printer status
        this.updatePrinterStatus(request.printerName, true);
        
        this.logger.info(`Label printed successfully for ${request.orderId} on ${request.printerName}`);
        return { success: true, labelId: hash };
      } else {
        // Update printer status with error
        this.updatePrinterStatus(request.printerName, false, printResult.error);
        throw new Error(printResult.error);
      }
    } catch (error) {
      this.logger.error(`Failed to print label for ${request.orderId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async sendToPrinter(request: PrintLabelRequest): Promise<{ success: boolean; error?: string }> {
    try {
      if (request.format === 'zpl' && request.zpl) {
        return await this.printZPL(request.zpl, request.printerName);
      } else if (request.format === 'pdf' && request.pdfUrl) {
        return await this.printPDF(request.pdfUrl, request.printerName);
      } else if (request.bytes) {
        // Try ZPL first, fall back to PDF
        try {
          return await this.printZPL(request.bytes.toString(), request.printerName);
        } catch (zplError) {
          this.logger.warn(`ZPL print failed, falling back to PDF: ${zplError}`);
          return await this.printPDFFromBytes(request.bytes, request.printerName);
        }
      } else {
        throw new Error('No valid print content provided');
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async printZPL(zpl: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (process.platform === 'win32') {
        // Windows: Use raw printing to USB/network printers
        return await this.printZPLWindows(zpl, printerName);
      } else if (process.platform === 'darwin') {
        // macOS: Use CUPS with ZPL support
        return await this.printZPLMacOS(zpl, printerName);
      } else {
        // Linux: Use CUPS
        return await this.printZPLLinux(zpl, printerName);
      }
    } catch (error) {
      return { success: false, error: `ZPL print failed: ${error}` };
    }
  }

  private async printZPLWindows(zpl: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create temporary ZPL file
      const tempFile = join(process.cwd(), 'temp', `label_${Date.now()}.zpl`);
      writeFileSync(tempFile, zpl, 'utf8');
      
      // Use Windows print command
      const command = `copy "${tempFile}" "\\\\localhost\\${printerName}"`;
      await execAsync(command);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Windows ZPL print failed: ${error}` };
    }
  }

  private async printZPLMacOS(zpl: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create temporary ZPL file
      const tempFile = join(process.cwd(), 'temp', `label_${Date.now()}.zpl`);
      writeFileSync(tempFile, zpl, 'utf8');
      
      // Use CUPS with ZPL support
      const command = `lpr -P "${printerName}" "${tempFile}"`;
      await execAsync(command);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `macOS ZPL print failed: ${error}` };
    }
  }

  private async printZPLLinux(zpl: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create temporary ZPL file
      const tempFile = join(process.cwd(), 'temp', `label_${Date.now()}.zpl`);
      writeFileSync(tempFile, zpl, 'utf8');
      
      // Use CUPS
      const command = `lpr -P "${printerName}" "${tempFile}"`;
      await execAsync(command);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Linux ZPL print failed: ${error}` };
    }
  }

  private async printPDF(pdfUrl: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (process.platform === 'win32') {
        const command = `start /min "${pdfUrl}" /print "${printerName}"`;
        await execAsync(command);
      } else if (process.platform === 'darwin') {
        const command = `lpr -P "${printerName}" "${pdfUrl}"`;
        await execAsync(command);
      } else {
        const command = `lpr -P "${printerName}" "${pdfUrl}"`;
        await execAsync(command);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `PDF print failed: ${error}` };
    }
  }

  private async printPDFFromBytes(bytes: Buffer, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Save bytes to temporary PDF file
      const tempFile = join(process.cwd(), 'temp', `label_${Date.now()}.pdf`);
      writeFileSync(tempFile, bytes);
      
      return await this.printPDF(tempFile, printerName);
    } catch (error) {
      return { success: false, error: `PDF from bytes print failed: ${error}` };
    }
  }

  async reprintLabel(orderId: string, printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the label in cache
      const cacheEntry = Array.from(this.labelCache.values()).find(entry => entry.orderId === orderId);
      
      if (!cacheEntry) {
        return { success: false, error: 'Label not found in cache' };
      }

      // Reprint with new idempotency key
      const reprintRequest: PrintLabelRequest = {
        orderId,
        format: cacheEntry.format,
        printerName,
        idempotencyKey: `reprint_${Date.now()}`,
        zpl: cacheEntry.format === 'zpl' ? cacheEntry.hash : undefined,
        bytes: cacheEntry.format === 'pdf' ? Buffer.from(cacheEntry.hash, 'base64') : undefined,
      };

      return await this.printLabel(reprintRequest);
    } catch (error) {
      return { success: false, error: `Reprint failed: ${error}` };
    }
  }

  private async discoverPrinters(): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Windows: Use wmic to discover printers
        const { stdout } = await execAsync('wmic printer get name,portname,drivername /format:csv');
        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Node'));
        
        lines.forEach(line => {
          const [name, port, driver] = line.split(',').map(s => s.trim());
          if (name && name !== 'Name') {
            this.printerStatuses.set(name, {
              name,
              isOnline: true,
              lastHeartbeat: new Date().toISOString(),
              errorCount: 0,
            });
          }
        });
      } else if (process.platform === 'darwin') {
        // macOS: Use CUPS to discover printers
        const { stdout } = await execAsync('lpstat -p');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const match = line.match(/^printer\s+(\S+)/);
          if (match) {
            const name = match[1];
            this.printerStatuses.set(name, {
              name,
              isOnline: true,
              lastHeartbeat: new Date().toISOString(),
              errorCount: 0,
            });
          }
        });
      } else {
        // Linux: Use CUPS to discover printers
        const { stdout } = await execAsync('lpstat -p');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const match = line.match(/^printer\s+(\S+)/);
          if (match) {
            const name = match[1];
            this.printerStatuses.set(name, {
              name,
              isOnline: true,
              lastHeartbeat: new Date().toISOString(),
              errorCount: 0,
            });
          }
        });
      }
      
      this.logger.info(`Discovered ${this.printerStatuses.size} printers`);
    } catch (error) {
      this.logger.error('Failed to discover printers:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.checkPrinterHealth();
    }, 30000); // Every 30 seconds
  }

  private async checkPrinterHealth(): Promise<void> {
    for (const [printerName, status] of this.printerStatuses) {
      try {
        const isOnline = await this.testPrinterConnection(printerName);
        this.updatePrinterStatus(printerName, isOnline);
      } catch (error) {
        this.updatePrinterStatus(printerName, false, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Publish status to renderer
    if (this.mainWindow) {
      this.mainWindow.webContents.send('printer:status-update', Array.from(this.printerStatuses.values()));
    }
  }

  private async testPrinterConnection(printerName: string): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`wmic printer where name="${printerName}" get workoffline`);
        return !stdout.includes('TRUE');
      } else {
        const { stdout } = await execAsync(`lpstat -p "${printerName}"`);
        return !stdout.includes('idle') || !stdout.includes('offline');
      }
    } catch (error) {
      return false;
    }
  }

  private updatePrinterStatus(printerName: string, isOnline: boolean, error?: string): void {
    const currentStatus = this.printerStatuses.get(printerName);
    
    if (currentStatus) {
      currentStatus.isOnline = isOnline;
      currentStatus.lastHeartbeat = new Date().toISOString();
      
      if (!isOnline) {
        currentStatus.errorCount++;
        currentStatus.lastError = error;
      } else {
        currentStatus.errorCount = 0;
        currentStatus.lastError = undefined;
      }
    } else {
      // New printer
      this.printerStatuses.set(printerName, {
        name: printerName,
        isOnline,
        lastHeartbeat: new Date().toISOString(),
        errorCount: isOnline ? 0 : 1,
        lastError: error,
      });
    }
  }

  private generateHash(content: string | Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async loadLabelCache(): Promise<void> {
    try {
      const cacheFile = join(process.cwd(), 'data', 'label_cache.json');
      if (existsSync(cacheFile)) {
        const cacheData = readFileSync(cacheFile, 'utf8');
        const cache = JSON.parse(cacheData);
        
        // Convert array back to Map
        this.labelCache.clear();
        cache.forEach((entry: LabelCacheEntry) => {
          const key = `${entry.orderId}_${entry.idempotencyKey}`;
          this.labelCache.set(key, entry);
        });
        
        this.logger.info(`Loaded ${this.labelCache.size} cached labels`);
      }
    } catch (error) {
      this.logger.warn('Failed to load label cache:', error);
    }
  }

  private async saveLabelCache(): Promise<void> {
    try {
      const cacheFile = join(process.cwd(), 'data', 'label_cache.json');
      const cacheArray = Array.from(this.labelCache.values());
      writeFileSync(cacheFile, JSON.stringify(cacheArray, null, 2));
    } catch (error) {
      this.logger.error('Failed to save label cache:', error);
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  getPrinterStatuses(): PrinterStatus[] {
    return Array.from(this.printerStatuses.values());
  }

  getLabelCache(): Map<string, LabelCacheEntry> {
    return this.labelCache;
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
