import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { Logger } from '../utils/Logger';
import { DatabaseManager } from '../database/DatabaseManager';

export interface OutboxJob {
  id: string;
  type: 'create_fulfillment' | 'create_label' | 'void_label' | 'inventory_adjust' | 'event_log';
  payload_json: Record<string, any>;
  idempotency_key: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';
  attempts: number;
  next_run_at: string;
  correlation_id?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
  last_attempt_at?: string;
}

export interface JobResult {
  success: boolean;
  jobId: string;
  error?: string;
  retryable: boolean;
  correlationId?: string;
}

export interface QueueStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  dead: number;
  oldestJob?: string;
  averageProcessingTime?: number;
}

export class JobQueue {
  private logger: Logger;
  private databaseManager: DatabaseManager;
  private mainWindow?: BrowserWindow;
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private maxConcurrency: number = 2;
  private activeJobs: Set<string> = new Set();
  private backoffSchedule: number[] = [60, 300, 900, 1800, 3600, 7200]; // 1m, 5m, 15m, 30m, 1h, 2h

  constructor() {
    this.logger = new Logger();
    this.databaseManager = new DatabaseManager();
    this.setupIpcHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database tables
      await this.initializeTables();
      
      // Start processing queue
      this.startProcessing();
      
      this.logger.info('JobQueue initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize JobQueue:', error);
      throw error;
    }
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('queue:add-job', async (_, jobData: Omit<OutboxJob, 'id' | 'created_at' | 'updated_at'>) => {
      return this.addJob(jobData);
    });

    ipcMain.handle('queue:get-stats', async () => {
      return this.getStats();
    });

    ipcMain.handle('queue:get-jobs', async (_, status?: string, limit?: number) => {
      return this.getJobs(status, limit);
    });

    ipcMain.handle('queue:retry-job', async (_, jobId: string) => {
      return this.retryJob(jobId);
    });

    ipcMain.handle('queue:clear-dead-jobs', async () => {
      return this.clearDeadJobs();
    });

    ipcMain.handle('queue:get-job-history', async (_, jobId: string) => {
      return this.getJobHistory(jobId);
    });
  }

  private async initializeTables(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS outbox_jobs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'queued',
          attempts INTEGER NOT NULL DEFAULT 0,
          next_run_at TEXT NOT NULL,
          correlation_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          error_message TEXT,
          last_attempt_at TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_outbox_jobs_status ON outbox_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_outbox_jobs_next_run ON outbox_jobs(next_run_at);
        CREATE INDEX IF NOT EXISTS idx_outbox_jobs_idempotency ON outbox_jobs(idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_outbox_jobs_correlation ON outbox_jobs(correlation_id);
      `;

      await this.databaseManager.execute(createTableSQL);
      this.logger.info('JobQueue tables initialized');
    } catch (error) {
      this.logger.error('Failed to initialize JobQueue tables:', error);
      throw error;
    }
  }

  async addJob(jobData: Omit<OutboxJob, 'id' | 'created_at' | 'updated_at'>): Promise<JobResult> {
    try {
      // Check for existing job with same idempotency key
      const existingJob = await this.getJobByIdempotencyKey(jobData.idempotency_key);
      if (existingJob) {
        this.logger.info(`Job with idempotency key ${jobData.idempotency_key} already exists`);
        return {
          success: true,
          jobId: existingJob.id,
          correlationId: existingJob.correlation_id,
        };
      }

      const job: OutboxJob = {
        ...jobData,
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const insertSQL = `
        INSERT INTO outbox_jobs (
          id, type, payload_json, idempotency_key, status, attempts,
          next_run_at, correlation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.databaseManager.execute(insertSQL, [
        job.id,
        job.type,
        JSON.stringify(job.payload_json),
        job.idempotency_key,
        job.status,
        job.attempts,
        job.next_run_at,
        job.correlation_id,
        job.created_at,
        job.updated_at,
      ]);

      this.logger.info(`Job added to queue: ${job.id} (${job.type})`);
      
      // Notify renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('queue:job-added', job);
      }

      return {
        success: true,
        jobId: job.id,
        correlationId: job.correlation_id,
      };
    } catch (error) {
      this.logger.error('Failed to add job to queue:', error);
      return {
        success: false,
        jobId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      };
    }
  }

  private startProcessing(): void {
    // Process queue every 10 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.activeJobs.size < this.maxConcurrency) {
        await this.processNextJob();
      }
    }, 10000);
  }

  private async processNextJob(): Promise<void> {
    try {
      // Get next job to process
      const nextJob = await this.getNextJobToProcess();
      if (!nextJob) return;

      this.isProcessing = true;
      this.activeJobs.add(nextJob.id);

      // Update job status to running
      await this.updateJobStatus(nextJob.id, 'running');

      // Process the job
      const result = await this.processJob(nextJob);

      if (result.success) {
        // Job succeeded
        await this.updateJobStatus(nextJob.id, 'succeeded');
        this.logger.info(`Job ${nextJob.id} completed successfully`);
      } else if (result.retryable && nextJob.attempts < this.backoffSchedule.length) {
        // Job failed but can be retried
        const nextAttempt = nextJob.attempts + 1;
        const backoffSeconds = this.backoffSchedule[nextAttempt - 1];
        const nextRunAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await this.updateJobForRetry(nextJob.id, nextAttempt, nextRunAt, result.error);
        this.logger.info(`Job ${nextJob.id} scheduled for retry ${nextAttempt} at ${nextRunAt}`);
      } else {
        // Job failed and cannot be retried
        await this.updateJobStatus(nextJob.id, 'dead', result.error);
        this.logger.error(`Job ${nextJob.id} marked as dead after ${nextJob.attempts} attempts`);
      }

      this.activeJobs.delete(nextJob.id);
      this.isProcessing = false;

      // Notify renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('queue:job-processed', {
          jobId: nextJob.id,
          success: result.success,
          status: result.success ? 'succeeded' : (result.retryable ? 'retrying' : 'dead'),
        });
      }
    } catch (error) {
      this.logger.error('Error processing job:', error);
      this.isProcessing = false;
    }
  }

  private async getNextJobToProcess(): Promise<OutboxJob | null> {
    try {
      const now = new Date().toISOString();
      const selectSQL = `
        SELECT * FROM outbox_jobs 
        WHERE status = 'queued' 
        AND next_run_at <= ? 
        ORDER BY created_at ASC 
        LIMIT 1
      `;

      const rows = await this.databaseManager.query(selectSQL, [now]);
      if (rows.length === 0) return null;

      const row = rows[0];
      return this.rowToJob(row);
    } catch (error) {
      this.logger.error('Failed to get next job to process:', error);
      return null;
    }
  }

  private async processJob(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      this.logger.info(`Processing job ${job.id}: ${job.type}`);

      switch (job.type) {
        case 'create_fulfillment':
          return await this.processCreateFulfillment(job);
        case 'create_label':
          return await this.processCreateLabel(job);
        case 'void_label':
          return await this.processVoidLabel(job);
        case 'inventory_adjust':
          return await this.processInventoryAdjust(job);
        case 'event_log':
          return await this.processEventLog(job);
        default:
          return {
            success: false,
            error: `Unknown job type: ${job.type}`,
            retryable: false,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Job ${job.id} processing failed:`, error);
      
      return {
        success: false,
        error: errorMessage,
        retryable: this.isRetryableError(error),
      };
    }
  }

  private async processCreateFulfillment(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      // This would integrate with Shopify API
      // For now, simulate the process
      const { orderId, lineItems, trackingInfo } = job.payload_json;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success
      this.logger.info(`Fulfillment created for order ${orderId}`);
      
      return { success: true, retryable: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  private async processCreateLabel(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      // This would integrate with label service
      // For now, simulate the process
      const { orderId, fromAddress, toAddress, packages } = job.payload_json;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate success
      this.logger.info(`Label created for order ${orderId}`);
      
      return { success: true, retryable: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  private async processVoidLabel(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      // This would integrate with label service
      const { labelId } = job.payload_json;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.logger.info(`Label ${labelId} voided successfully`);
      
      return { success: true, retryable: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  private async processInventoryAdjust(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      // This would integrate with Shopify API
      const { inventoryItemId, locationId, delta } = job.payload_json;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      this.logger.info(`Inventory adjusted: ${inventoryItemId} at ${locationId} by ${delta}`);
      
      return { success: true, retryable: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  private async processEventLog(job: OutboxJob): Promise<{ success: boolean; error?: string; retryable: boolean }> {
    try {
      // This would integrate with logging/analytics service
      const { eventType, data } = job.payload_json;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.logger.info(`Event logged: ${eventType}`);
      
      return { success: true, retryable: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    
    // Network errors are retryable
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return true;
    }
    
    // Rate limiting errors are retryable
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return true;
    }
    
    // Server errors (5xx) are retryable
    if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
      return true;
    }
    
    // Authentication errors are not retryable
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return false;
    }
    
    // Client errors (4xx) are generally not retryable
    if (errorMessage.includes('400') || errorMessage.includes('404')) {
      return false;
    }
    
    // Default to retryable for unknown errors
    return true;
  }

  async retryJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const job = await this.getJobById(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      if (job.status === 'dead') {
        // Reset dead job for retry
        const nextRunAt = new Date().toISOString();
        await this.updateJobForRetry(jobId, 0, nextRunAt);
        
        this.logger.info(`Dead job ${jobId} reset for retry`);
        return { success: true };
      }

      return { success: false, error: 'Job is not in a retryable state' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async clearDeadJobs(): Promise<{ success: boolean; count: number }> {
    try {
      const deleteSQL = `DELETE FROM outbox_jobs WHERE status = 'dead'`;
      const result = await this.databaseManager.execute(deleteSQL);
      
      const count = result.changes || 0;
      this.logger.info(`Cleared ${count} dead jobs`);
      
      return { success: true, count };
    } catch (error) {
      this.logger.error('Failed to clear dead jobs:', error);
      return { success: false, count: 0 };
    }
  }

  async getStats(): Promise<QueueStats> {
    try {
      const statsSQL = `
        SELECT 
          status,
          COUNT(*) as count,
          MIN(created_at) as oldest,
          AVG(CAST((julianday(updated_at) - julianday(created_at)) * 86400 AS INTEGER)) as avg_processing_time
        FROM outbox_jobs 
        GROUP BY status
      `;

      const rows = await this.databaseManager.query(statsSQL);
      
      const stats: QueueStats = {
        total: 0,
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        dead: 0,
      };

      rows.forEach(row => {
        const count = row.count;
        const status = row.status;
        
        stats.total += count;
        stats[status as keyof QueueStats] = count;
        
        if (status === 'queued' && row.oldest) {
          stats.oldestJob = row.oldest;
        }
        
        if (row.avg_processing_time) {
          stats.averageProcessingTime = row.avg_processing_time;
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      return {
        total: 0,
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        dead: 0,
      };
    }
  }

  async getJobs(status?: string, limit: number = 100): Promise<OutboxJob[]> {
    try {
      let selectSQL = `SELECT * FROM outbox_jobs`;
      const params: any[] = [];

      if (status) {
        selectSQL += ` WHERE status = ?`;
        params.push(status);
      }

      selectSQL += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = await this.databaseManager.query(selectSQL, params);
      return rows.map(row => this.rowToJob(row));
    } catch (error) {
      this.logger.error('Failed to get jobs:', error);
      return [];
    }
  }

  async getJobHistory(jobId: string): Promise<OutboxJob | null> {
    try {
      const selectSQL = `SELECT * FROM outbox_jobs WHERE id = ?`;
      const rows = await this.databaseManager.query(selectSQL, [jobId]);
      
      if (rows.length === 0) return null;
      
      return this.rowToJob(rows[0]);
    } catch (error) {
      this.logger.error('Failed to get job history:', error);
      return null;
    }
  }

  private async getJobById(jobId: string): Promise<OutboxJob | null> {
    return this.getJobHistory(jobId);
  }

  private async getJobByIdempotencyKey(idempotencyKey: string): Promise<OutboxJob | null> {
    try {
      const selectSQL = `SELECT * FROM outbox_jobs WHERE idempotency_key = ?`;
      const rows = await this.databaseManager.query(selectSQL, [idempotencyKey]);
      
      if (rows.length === 0) return null;
      
      return this.rowToJob(rows[0]);
    } catch (error) {
      this.logger.error('Failed to get job by idempotency key:', error);
      return null;
    }
  }

  private async updateJobStatus(jobId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const updateSQL = `
        UPDATE outbox_jobs 
        SET status = ?, updated_at = ?, error_message = ?, last_attempt_at = ?
        WHERE id = ?
      `;

      await this.databaseManager.execute(updateSQL, [
        status,
        new Date().toISOString(),
        errorMessage || null,
        new Date().toISOString(),
        jobId,
      ]);
    } catch (error) {
      this.logger.error('Failed to update job status:', error);
    }
  }

  private async updateJobForRetry(jobId: string, attempts: number, nextRunAt: string, errorMessage?: string): Promise<void> {
    try {
      const updateSQL = `
        UPDATE outbox_jobs 
        SET status = 'queued', attempts = ?, next_run_at = ?, updated_at = ?, 
            error_message = ?, last_attempt_at = ?
        WHERE id = ?
      `;

      await this.databaseManager.execute(updateSQL, [
        attempts,
        nextRunAt,
        new Date().toISOString(),
        errorMessage || null,
        new Date().toISOString(),
        jobId,
      ]);
    } catch (error) {
      this.logger.error('Failed to update job for retry:', error);
    }
  }

  private rowToJob(row: any): OutboxJob {
    return {
      id: row.id,
      type: row.type,
      payload_json: JSON.parse(row.payload_json),
      idempotency_key: row.idempotency_key,
      status: row.status,
      attempts: row.attempts,
      next_run_at: row.next_run_at,
      correlation_id: row.correlation_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      error_message: row.error_message,
      last_attempt_at: row.last_attempt_at,
    };
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // Method to manually trigger queue processing (for testing)
  async processQueue(): Promise<void> {
    while (this.activeJobs.size < this.maxConcurrency) {
      const nextJob = await this.getNextJobToProcess();
      if (!nextJob) break;
      
      await this.processNextJob();
    }
  }

  cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.logger.info('JobQueue cleaned up');
  }
}
