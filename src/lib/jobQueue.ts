/**
 * Job Queue System for Offline-First Operations
 * Handles queuing, retries, and idempotency for external API calls
 */

export interface Job {
  id: string;
  type: 'create_fulfillment' | 'create_label' | 'void_label' | 'inventory_adjust' | 'event_log';
  payload: Record<string, any>;
  idempotencyKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  correlationId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: any;
}

export interface JobStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  dead: number;
}

export interface JobQueueConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  jitterMs: number;
  concurrency: number;
}

export class JobQueue {
  private config: JobQueueConfig;
  private jobs: Map<string, Job> = new Map();
  private running: Set<string> = new Set();
  private isProcessing = false;

  constructor(config: Partial<JobQueueConfig> = {}) {
    this.config = {
      maxAttempts: 6,
      backoffMultiplier: 2,
      maxBackoffMs: 30 * 60 * 1000, // 30 minutes
      jitterMs: 1000, // 1 second
      concurrency: 2,
      ...config,
    };
  }

  /**
   * Add a new job to the queue
   */
  async addJob(
    type: Job['type'],
    payload: Record<string, any>,
    idempotencyKey: string,
    correlationId?: string
  ): Promise<string> {
    // Check if job with same idempotency key already exists
    const existingJob = this.findJobByIdempotencyKey(idempotencyKey);
    if (existingJob && existingJob.status === 'succeeded') {
      return existingJob.id; // Job already completed successfully
    }

    const jobId = this.generateJobId();
    const now = new Date().toISOString();

    const job: Job = {
      id: jobId,
      type,
      payload,
      idempotencyKey,
      status: 'queued',
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      nextRunAt: now,
      correlationId,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);
    this.scheduleProcessing();
    return jobId;
  }

  /**
   * Get job statistics
   */
  getStats(): JobStats {
    const stats: JobStats = {
      total: this.jobs.size,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      dead: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }

  /**
   * Get jobs by status and limit
   */
  getJobs(status?: Job['status'], limit: number = 100): Job[] {
    const jobs = Array.from(this.jobs.values());
    
    if (status) {
      return jobs.filter(job => job.status === status).slice(0, limit);
    }
    
    return jobs.slice(0, limit);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') {
      return false;
    }

    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead';
      job.updatedAt = new Date().toISOString();
      return false;
    }

    job.status = 'queued';
    job.attempts++;
    job.nextRunAt = this.calculateNextRunTime(job.attempts);
    job.updatedAt = new Date().toISOString();
    job.error = undefined;

    this.scheduleProcessing();
    return true;
  }

  /**
   * Clear all dead jobs
   */
  async clearDeadJobs(): Promise<number> {
    let cleared = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'dead') {
        this.jobs.delete(jobId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Get job history for a specific job
   */
  getJobHistory(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.running.size >= this.config.concurrency) {
      return;
    }

    this.isProcessing = true;

    try {
      const queuedJobs = this.getJobs('queued');
      const now = new Date();

      for (const job of queuedJobs) {
        if (this.running.size >= this.config.concurrency) {
          break;
        }

        const nextRunTime = new Date(job.nextRunAt);
        if (nextRunTime > now) {
          continue; // Job not ready to run yet
        }

        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
      
      // Schedule next processing if there are still queued jobs
      if (this.getJobs('queued').length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    if (this.running.has(job.id)) {
      return;
    }

    this.running.add(job.id);
    job.status = 'running';
    job.updatedAt = new Date().toISOString();

    try {
      const result = await this.executeJob(job);
      
      job.status = 'succeeded';
      job.result = result;
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.attempts++;
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.updatedAt = new Date().toISOString();

      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead';
      } else {
        job.status = 'failed';
        job.nextRunAt = this.calculateNextRunTime(job.attempts);
      }
    } finally {
      this.running.delete(job.id);
    }
  }

  /**
   * Execute a job based on its type
   */
  private async executeJob(job: Job): Promise<any> {
    switch (job.type) {
      case 'create_fulfillment':
        return this.executeCreateFulfillment(job);
      case 'create_label':
        return this.executeCreateLabel(job);
      case 'void_label':
        return this.executeVoidLabel(job);
      case 'inventory_adjust':
        return this.executeInventoryAdjust(job);
      case 'event_log':
        return this.executeEventLog(job);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Execute create fulfillment job
   */
  private async executeCreateFulfillment(job: Job): Promise<any> {
    // This would integrate with Shopify API
    // For now, simulate the operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { fulfillmentId: `fulfillment_${Date.now()}` };
  }

  /**
   * Execute create label job
   */
  private async executeCreateLabel(job: Job): Promise<any> {
    // This would integrate with label service
    // For now, simulate the operation
    await new Promise(resolve => setTimeout(resolve, 200));
    return { labelId: `label_${Date.now()}`, trackingNumber: `TRK${Date.now()}` };
  }

  /**
   * Execute void label job
   */
  private async executeVoidLabel(job: Job): Promise<any> {
    // This would integrate with label service
    // For now, simulate the operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  /**
   * Execute inventory adjust job
   */
  private async executeInventoryAdjust(job: Job): Promise<any> {
    // This would integrate with Shopify API
    // For now, simulate the operation
    await new Promise(resolve => setTimeout(resolve, 150));
    return { adjusted: true };
  }

  /**
   * Execute event log job
   */
  private async executeEventLog(job: Job): Promise<any> {
    // This would log events to external systems
    // For now, simulate the operation
    await new Promise(resolve => setTimeout(resolve, 50));
    return { logged: true };
  }

  /**
   * Calculate next run time with exponential backoff and jitter
   */
  private calculateNextRunTime(attempts: number): string {
    const baseDelay = Math.min(
      this.config.maxBackoffMs,
      Math.pow(this.config.backoffMultiplier, attempts) * 1000
    );
    
    const jitter = Math.random() * this.config.jitterMs;
    const delay = baseDelay + jitter;
    
    return new Date(Date.now() + delay).toISOString();
  }

  /**
   * Find job by idempotency key
   */
  private findJobByIdempotencyKey(idempotencyKey: string): Job | undefined {
    for (const job of this.jobs.values()) {
      if (job.idempotencyKey === idempotencyKey) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule queue processing
   */
  private scheduleProcessing(): void {
    if (!this.isProcessing) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Export jobs for persistence
   */
  exportJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Import jobs from persistence
   */
  importJobs(jobs: Job[]): void {
    this.jobs.clear();
    for (const job of jobs) {
      this.jobs.set(job.id, job);
    }
    this.scheduleProcessing();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();
