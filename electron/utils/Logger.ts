import { app } from 'electron';
import { join } from 'path';
import { createWriteStream, WriteStream } from 'fs';
import { format } from 'date-fns';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  correlationId?: string;
  profile?: string;
  event?: string;
}

export class Logger {
  private logStream: WriteStream | null = null;
  private logPath: string;
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private maxFiles = 10;
  private currentFileSize = 0;

  constructor() {
    this.logPath = join(app.getPath('userData'), 'logs', 'threads-ops.log');
    this.initializeLogStream();
  }

  private initializeLogStream(): void {
    try {
      // Ensure logs directory exists
      const logsDir = join(app.getPath('userData'), 'logs');
      const fs = require('fs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Create write stream
      this.logStream = createWriteStream(this.logPath, { flags: 'a' });
      
      // Get current file size
      const stats = fs.statSync(this.logPath);
      this.currentFileSize = stats.size;

      // Check if rotation is needed
      if (this.currentFileSize >= this.maxFileSize) {
        this.rotateLogs();
      }
    } catch (error) {
      console.error('Failed to initialize log stream:', error);
    }
  }

  private rotateLogs(): void {
    try {
      if (!this.logStream) return;

      // Close current stream
      this.logStream.end();
      this.logStream = null;

      const fs = require('fs');
      const path = require('path');

      // Rotate existing log files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = `${this.logPath}.${i}`;
        const newFile = `${this.logPath}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            // Remove oldest file
            fs.unlinkSync(oldFile);
          } else {
            // Move file
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log to .1
      if (fs.existsSync(this.logPath)) {
        fs.renameSync(this.logPath, `${this.logPath}.1`);
      }

      // Reinitialize stream
      this.initializeLogStream();
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private writeLog(entry: LogEntry): void {
    try {
      if (!this.logStream) {
        this.initializeLogStream();
      }

      if (this.logStream) {
        const logLine = JSON.stringify(entry) + '\n';
        this.logStream.write(logLine);
        
        // Update file size
        this.currentFileSize += Buffer.byteLength(logLine, 'utf8');
        
        // Check if rotation is needed
        if (this.currentFileSize >= this.maxFileSize) {
          this.rotateLogs();
        }
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    data?: any,
    correlationId?: string,
    profile?: string,
    event?: string
  ): LogEntry {
    return {
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level,
      message: this.redactPII(message),
      data: data ? this.redactPII(data) : undefined,
      correlationId,
      profile,
      event,
    };
  }

  private redactPII(data: any): any {
    if (typeof data === 'string') {
      return this.redactString(data);
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.redactPII(item));
      } else {
        const redacted: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (this.isPIIField(key)) {
            redacted[key] = this.redactValue(value);
          } else {
            redacted[key] = this.redactPII(value);
          }
        }
        return redacted;
      }
    }
    return data;
  }

  private isPIIField(fieldName: string): boolean {
    const piiFields = [
      'name', 'firstName', 'lastName', 'fullName',
      'email', 'emailAddress',
      'phone', 'phoneNumber', 'mobile', 'telephone',
      'address', 'street', 'city', 'state', 'zipCode', 'postalCode',
      'ssn', 'socialSecurityNumber',
      'creditCard', 'cardNumber', 'cvv',
      'password', 'token', 'secret', 'key',
      'customer', 'client', 'user'
    ];

    return piiFields.some(field => 
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  private redactValue(value: any): string {
    if (typeof value === 'string') {
      if (value.includes('@')) {
        // Email address
        const [local, domain] = value.split('@');
        return `${local.charAt(0)}***@${domain}`;
      } else if (value.match(/^\d{10,}$/)) {
        // Phone number
        return value.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2');
      } else if (value.length > 4) {
        // General text
        return value.charAt(0) + '*'.repeat(value.length - 2) + value.charAt(value.length - 1);
      } else {
        return '***';
      }
    }
    return '***';
  }

  private redactString(text: string): string {
    // Redact email addresses
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    
    // Redact phone numbers
    text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // Redact credit card numbers
    text = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]');
    
    // Redact SSN
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
    
    return text;
  }

  // Public logging methods
  debug(message: string, data?: any, correlationId?: string, profile?: string, event?: string): void {
    const entry = this.createLogEntry('debug', message, data, correlationId, profile, event);
    this.writeLog(entry);
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: any, correlationId?: string, profile?: string, event?: string): void {
    const entry = this.createLogEntry('info', message, data, correlationId, profile, event);
    this.writeLog(entry);
    console.info(`[INFO] ${message}`, data);
  }

  warn(message: string, data?: any, correlationId?: string, profile?: string, event?: string): void {
    const entry = this.createLogEntry('warn', message, data, correlationId, profile, event);
    this.writeLog(entry);
    console.warn(`[WARN] ${message}`, data);
  }

  error(message: string, data?: any, correlationId?: string, profile?: string, event?: string): void {
    const entry = this.createLogEntry('error', message, data, correlationId, profile, event);
    this.writeLog(entry);
    console.error(`[ERROR] ${message}`, data);
  }

  // Specialized logging methods
  logOrderEvent(event: string, orderId: string, data?: any, correlationId?: string, profile?: string): void {
    this.info(`Order event: ${event}`, { orderId, ...data }, correlationId, profile, event);
  }

  logInventoryEvent(event: string, variantId: string, locationId: string, data?: any, correlationId?: string, profile?: string): void {
    this.info(`Inventory event: ${event}`, { variantId, locationId, ...data }, correlationId, profile, event);
  }

  logPrinterEvent(event: string, printerName: string, data?: any, correlationId?: string, profile?: string): void {
    this.info(`Printer event: ${event}`, { printerName, ...data }, correlationId, profile, event);
  }

  logScannerEvent(event: string, data?: any, correlationId?: string, profile?: string): void {
    this.info(`Scanner event: ${event}`, data, correlationId, profile, event);
  }

  logSecurityEvent(event: string, data?: any, correlationId?: string, profile?: string): void {
    this.warn(`Security event: ${event}`, data, correlationId, profile, event);
  }

  logPerformanceEvent(operation: string, duration: number, data?: any, correlationId?: string, profile?: string): void {
    this.info(`Performance: ${operation}`, { duration, ...data }, correlationId, profile, 'performance');
  }

  // Method to get recent logs for support bundle
  async getRecentLogs(limit: number = 1000): Promise<LogEntry[]> {
    try {
      const fs = require('fs');
      const readline = require('readline');
      
      if (!fs.existsSync(this.logPath)) {
        return [];
      }

      const fileStream = fs.createReadStream(this.logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const logs: LogEntry[] = [];
      
      for await (const line of rl) {
        try {
          const entry = JSON.parse(line);
          logs.push(entry);
          
          if (logs.length >= limit) {
            break;
          }
        } catch (error) {
          // Skip invalid JSON lines
          continue;
        }
      }

      return logs.reverse(); // Most recent first
    } catch (error) {
      this.error('Failed to get recent logs:', error);
      return [];
    }
  }

  // Method to export logs for support bundle
  async exportLogs(outputPath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const logs = await this.getRecentLogs();
      
      // Create support bundle with redacted logs
      const supportBundle = {
        exportTime: new Date().toISOString(),
        appVersion: app.getVersion(),
        platform: process.platform,
        logs: logs.map(log => ({
          ...log,
          data: this.redactPII(log.data)
        }))
      };

      fs.writeFileSync(outputPath, JSON.stringify(supportBundle, null, 2));
      this.info(`Logs exported to: ${outputPath}`);
      
      return true;
    } catch (error) {
      this.error('Failed to export logs:', error);
      return false;
    }
  }

  // Cleanup method
  cleanup(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}
