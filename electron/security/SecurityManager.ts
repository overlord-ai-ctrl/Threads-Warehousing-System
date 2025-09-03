import * as keytar from 'node-keytar';
import { app } from 'electron';
import { Logger } from '../utils/Logger';
import { randomBytes, createCipher, createDecipher } from 'crypto';

export class SecurityManager {
  private logger: Logger;
  private serviceName: string;
  private accountName: string;

  constructor() {
    this.logger = new Logger();
    this.serviceName = 'ThreadsOps';
    this.accountName = app.getName();
  }

  async storeToken(key: string, value: string): Promise<boolean> {
    try {
      await keytar.setPassword(this.serviceName, `${this.accountName}:${key}`, value);
      this.logger.info(`Token stored successfully for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store token for key: ${key}`, error);
      return false;
    }
  }

  async getToken(key: string): Promise<string | null> {
    try {
      const token = await keytar.getPassword(this.serviceName, `${this.accountName}:${key}`);
      return token;
    } catch (error) {
      this.logger.error(`Failed to retrieve token for key: ${key}`, error);
      return null;
    }
  }

  async deleteToken(key: string): Promise<boolean> {
    try {
      await keytar.deletePassword(this.serviceName, `${this.accountName}:${key}`);
      this.logger.info(`Token deleted successfully for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete token for key: ${key}`, error);
      return false;
    }
  }

  async getDatabaseKey(): Promise<string> {
    try {
      // Try to get existing database key
      let dbKey = await this.getToken('database_key');
      
      if (!dbKey) {
        // Generate new database key if none exists
        dbKey = this.generateSecureKey();
        await this.storeToken('database_key', dbKey);
        this.logger.info('Generated new database encryption key');
      }
      
      return dbKey;
    } catch (error) {
      this.logger.error('Failed to get database key:', error);
      throw error;
    }
  }

  async storeShopifyToken(shopDomain: string, token: string): Promise<boolean> {
    try {
      const key = `shopify:${shopDomain}`;
      await this.storeToken(key, token);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store Shopify token for ${shopDomain}:`, error);
      return false;
    }
  }

  async getShopifyToken(shopDomain: string): Promise<string | null> {
    try {
      const key = `shopify:${shopDomain}`;
      return await this.getToken(key);
    } catch (error) {
      this.logger.error(`Failed to get Shopify token for ${shopDomain}:`, error);
      return null;
    }
  }

  async storeLabelServiceToken(service: string, token: string): Promise<boolean> {
    try {
      const key = `label_service:${service}`;
      await this.storeToken(key, token);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store label service token for ${service}:`, error);
      return false;
    }
  }

  async getLabelServiceToken(service: string): Promise<string | null> {
    try {
      const key = `label_service:${service}`;
      return await this.getToken(key);
    } catch (error) {
      this.logger.error(`Failed to get label service token for ${service}:`, error);
      return null;
    }
  }

  async storeSupabaseToken(token: string): Promise<boolean> {
    try {
      await this.storeToken('supabase_token', token);
      return true;
    } catch (error) {
      this.logger.error('Failed to store Supabase token:', error);
      return false;
    }
  }

  async getSupabaseToken(): Promise<string | null> {
    try {
      return await this.getToken('supabase_token');
    } catch (error) {
      this.logger.error('Failed to get Supabase token:', error);
      return null;
    }
  }

  async storeUserCredentials(userId: string, credentials: any): Promise<boolean> {
    try {
      const key = `user_credentials:${userId}`;
      const encryptedCredentials = this.encryptData(JSON.stringify(credentials));
      await this.storeToken(key, encryptedCredentials);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store user credentials for ${userId}:`, error);
      return false;
    }
  }

  async getUserCredentials(userId: string): Promise<any | null> {
    try {
      const key = `user_credentials:${userId}`;
      const encryptedCredentials = await this.getToken(key);
      
      if (!encryptedCredentials) return null;
      
      const decryptedData = this.decryptData(encryptedCredentials);
      return JSON.parse(decryptedData);
    } catch (error) {
      this.logger.error(`Failed to get user credentials for ${userId}:`, error);
      return null;
    }
  }

  async clearAllTokens(): Promise<boolean> {
    try {
      // Get all stored keys
      const credentials = await keytar.findCredentials(this.serviceName);
      
      // Delete each credential
      for (const credential of credentials) {
        if (credential.account.startsWith(this.accountName)) {
          await keytar.deletePassword(this.serviceName, credential.account);
        }
      }
      
      this.logger.info('All tokens cleared successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear all tokens:', error);
      return false;
    }
  }

  private generateSecureKey(): string {
    return randomBytes(32).toString('hex');
  }

  private encryptData(data: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long', 'utf8');
    const iv = randomBytes(16);
    
    const cipher = createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptData(encryptedData: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long', 'utf8');
    
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Method to verify keychain accessibility
  async testKeychainAccess(): Promise<boolean> {
    try {
      const testKey = 'test_key';
      const testValue = 'test_value';
      
      await this.storeToken(testKey, testValue);
      const retrieved = await this.getToken(testKey);
      await this.deleteToken(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      this.logger.error('Keychain access test failed:', error);
      return false;
    }
  }
}
