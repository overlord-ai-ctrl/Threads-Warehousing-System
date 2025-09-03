import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { join } from 'path';
import { app } from 'electron';
import { SecurityManager } from '../security/SecurityManager';
import { Logger } from '../utils/Logger';

export class DatabaseManager {
  private db: Database | null = null;
  private securityManager: SecurityManager;
  private logger: Logger;
  private dbPath: string;

  constructor() {
    this.securityManager = new SecurityManager();
    this.logger = new Logger();
    this.dbPath = join(app.getPath('userData'), 'threads-ops.db');
  }

  async initialize(): Promise<void> {
    try {
      // Get encryption key from OS keychain
      const encryptionKey = await this.securityManager.getDatabaseKey();
      if (!encryptionKey) {
        throw new Error('Failed to retrieve database encryption key');
      }

      // Open encrypted database
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      });

      // Enable WAL mode for better concurrency
      await this.db.exec('PRAGMA journal_mode = WAL');
      await this.db.exec('PRAGMA synchronous = NORMAL');
      await this.db.exec('PRAGMA cache_size = 10000');
      await this.db.exec('PRAGMA temp_store = MEMORY');

      // Create tables if they don't exist
      await this.createTables();

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Outbox jobs for offline queue
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        next_run_at INTEGER,
        correlation_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Seen webhooks to prevent duplicates
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS seen_webhooks (
        webhook_id TEXT PRIMARY KEY,
        seen_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Label cache for reprinting
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS label_cache (
        order_id TEXT PRIMARY KEY,
        label_format TEXT NOT NULL,
        bytes_hash TEXT NOT NULL,
        label_data BLOB NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Local order cache
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders_cache (
        shop_domain TEXT NOT NULL,
        order_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (shop_domain, order_id)
      )
    `);

    // Local inventory events
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_events (
        id TEXT PRIMARY KEY,
        ts INTEGER DEFAULT (strftime('%s', 'now')),
        actor_id TEXT NOT NULL,
        shop_domain TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        note TEXT,
        synced INTEGER DEFAULT 0
      )
    `);

    // Local bin locations
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS bin_locations (
        shop_domain TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        bin_code TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (shop_domain, variant_id, bin_code)
      )
    `);

    // Local issues/exceptions
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        shop_domain TEXT NOT NULL,
        order_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        state TEXT DEFAULT 'open',
        assignee_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes for performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_outbox_jobs_status ON outbox_jobs(status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_jobs_type ON outbox_jobs(type);
      CREATE INDEX IF NOT EXISTS idx_orders_cache_status ON orders_cache(status);
      CREATE INDEX IF NOT EXISTS idx_inventory_events_synced ON inventory_events(synced);
      CREATE INDEX IF NOT EXISTS idx_bin_locations_variant ON bin_locations(variant_id);
    `);

    this.logger.info('Database tables created successfully');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const result = await this.db.all(sql, params);
      return result;
    } catch (error) {
      this.logger.error('Database query failed:', { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const result = await this.db.run(sql, params);
      return result;
    } catch (error) {
      this.logger.error('Database execute failed:', { sql, params, error });
      throw error;
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.exec('BEGIN TRANSACTION');
      const result = await callback();
      await this.db.exec('COMMIT');
      return result;
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.logger.info('Database connection closed');
    }
  }

  // Helper methods for common operations
  async addOutboxJob(job: {
    type: string;
    payload: any;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await this.execute(
      'INSERT INTO outbox_jobs (id, type, payload_json, idempotency_key, correlation_id) VALUES (?, ?, ?, ?, ?)',
      [id, job.type, JSON.stringify(job.payload), job.idempotencyKey, job.correlationId]
    );
    return id;
  }

  async getPendingJobs(): Promise<any[]> {
    return await this.query(
      'SELECT * FROM outbox_jobs WHERE status = ? AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY created_at ASC',
      ['pending', Math.floor(Date.now() / 1000)]
    );
  }

  async markJobComplete(id: string): Promise<void> {
    await this.execute(
      'UPDATE outbox_jobs SET status = ?, updated_at = ? WHERE id = ?',
      ['completed', Math.floor(Date.now() / 1000), id]
    );
  }

  async markJobFailed(id: string, attempts: number, nextRunAt?: number): Promise<void> {
    await this.execute(
      'UPDATE outbox_jobs SET status = ?, attempts = ?, next_run_at = ?, updated_at = ? WHERE id = ?',
      ['failed', attempts, nextRunAt, Math.floor(Date.now() / 1000), id]
    );
  }

  async storeLabel(orderId: string, format: string, labelData: Buffer): Promise<void> {
    const bytesHash = await this.generateHash(labelData);
    await this.execute(
      'INSERT OR REPLACE INTO label_cache (order_id, label_format, bytes_hash, label_data) VALUES (?, ?, ?, ?)',
      [orderId, format, bytesHash, labelData]
    );
  }

  async getLabel(orderId: string): Promise<{ format: string; data: Buffer } | null> {
    const result = await this.query(
      'SELECT label_format, label_data FROM label_cache WHERE order_id = ?',
      [orderId]
    );
    
    if (result.length === 0) return null;
    
    return {
      format: result[0].label_format,
      data: result[0].label_data,
    };
  }

  private async generateHash(data: Buffer): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
