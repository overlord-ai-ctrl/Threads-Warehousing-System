// Environment variable guards for Threads Ops
// This file ensures required environment variables are present at runtime

// Type assertion for Vite environment variables
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_SUPABASE_URL: string;
      readonly VITE_SUPABASE_ANON_KEY: string;
      readonly VITE_APP_URL: string;
      readonly MODE: string;
    };
  }
}

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY?: string;
  NODE_ENV: string;
  APP_URL?: string;
}

// Check if we're in a browser environment
const isRenderer = typeof window !== 'undefined';

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Get environment variables based on context
function getEnvVars(): EnvConfig {
  if (isRenderer) {
    // In renderer (browser), use VITE_ prefixed vars
    const config: EnvConfig = {
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
      SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      NODE_ENV: import.meta.env.MODE || 'development',
      APP_URL: import.meta.env.VITE_APP_URL || 'http://localhost:3000'
    };

    // Warn once if required vars are missing
    if (!config.SUPABASE_URL) {
      console.warn('⚠️ VITE_SUPABASE_URL is not set. Supabase features may not work.');
    }
    if (!config.SUPABASE_ANON_KEY) {
      console.warn('⚠️ VITE_SUPABASE_ANON_KEY is not set. Supabase features may not work.');
    }

    return config;
  } else if (isNode) {
    // In Node.js (cloud), use regular env vars
    const config: EnvConfig = {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development',
      APP_URL: process.env.APP_URL || 'http://localhost:3000'
    };

    // Throw on boot if required vars are missing in cloud
    if (!config.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required in cloud environment');
    }
    if (!config.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_KEY is required in cloud environment');
    }

    return config;
  }

  // Fallback for unknown environment
  return {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    NODE_ENV: 'development'
  };
}

// Export the validated config
export const env = getEnvVars();

// Export individual vars for convenience
export const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  NODE_ENV,
  APP_URL
} = env;

// Export environment check helpers
export const isDevelopment = NODE_ENV === 'development';
export const isProduction = NODE_ENV === 'production';
export const isTest = NODE_ENV === 'test';
