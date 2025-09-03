#!/usr/bin/env node

/**
 * Self-check script for Threads Ops
 * Verifies environment, dependencies, and basic connectivity
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Threads Ops Self-Check\n');

// Check Node version
const nodeVersion = process.version;
console.log(`📦 Node.js: ${nodeVersion}`);
if (!nodeVersion.startsWith('v20')) {
  console.warn('⚠️  Warning: Node 20+ recommended (see .nvmrc)');
}

// Check package manager
const packageManager = process.env.npm_config_user_agent?.split('/')[0] || 'npm';
console.log(`📦 Package Manager: ${packageManager}`);

// Load package.json
let packageJson;
try {
  const packagePath = join(projectRoot, 'package.json');
  packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  console.log(`📦 Project: ${packageJson.name} v${packageJson.version}`);
} catch (error) {
  console.error('❌ Failed to read package.json');
  process.exit(1);
}

// Check environment variables
console.log('\n🔐 Environment Check:');

const envChecks = [
  // Renderer environment
  { name: 'VITE_SUPABASE_URL', required: true, context: 'renderer' },
  { name: 'VITE_SUPABASE_ANON_KEY', required: true, context: 'renderer' },
  // Cloud environment  
  { name: 'SUPABASE_URL', required: true, context: 'cloud' },
  { name: 'SUPABASE_SERVICE_KEY', required: true, context: 'cloud' },
  // Optional
  { name: 'NODE_ENV', required: false, context: 'both' },
  { name: 'APP_URL', required: false, context: 'both' },
];

let envIssues = 0;
envChecks.forEach(({ name, required, context }) => {
  const value = process.env[name];
  if (value) {
    // Don't print secrets, just confirm presence
    const masked = name.includes('KEY') || name.includes('SECRET') 
      ? `${value.substring(0, 8)}...` 
      : value;
    console.log(`  ✅ ${name}: ${masked}`);
  } else if (required) {
    console.log(`  ❌ ${name}: Missing (required for ${context})`);
    envIssues++;
  } else {
    console.log(`  ⚠️  ${name}: Not set (optional)`);
  }
});

if (envIssues > 0) {
  console.log(`\n⚠️  ${envIssues} required environment variables missing`);
  console.log('   Copy .env.example to .env and fill in values');
}

// Test Supabase connectivity
console.log('\n🌐 Connectivity Check:');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/?select=`, {
      method: 'HEAD',
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || 'test',
      }
    });
    
    if (response.ok) {
      console.log('  ✅ Supabase: Connected');
    } else {
      console.log(`  ⚠️  Supabase: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`  ❌ Supabase: ${error.message}`);
  }
} else {
  console.log('  ⚠️  Supabase: No URL configured');
}

// Check key files
console.log('\n📁 File Structure:');
const keyFiles = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'eslint.config.js',
  '.prettierrc',
  '.editorconfig',
  '.nvmrc',
  'src/main.tsx',
  'electron/main.ts',
];

keyFiles.forEach(file => {
  const exists = existsSync(join(projectRoot, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Scripts summary
console.log('\n🚀 Available Scripts:');
const scripts = packageJson.scripts || {};
const importantScripts = [
  'dev', 'dev:full', 'build', 'test', 'lint', 'typecheck', 
  'check', 'selfcheck', 'deps:audit', 'gen:types'
];

importantScripts.forEach(script => {
  if (scripts[script]) {
    console.log(`  📜 ${script}: ${scripts[script]}`);
  }
});

console.log('\n✨ Self-check complete!');
if (envIssues === 0) {
  console.log('🎉 All checks passed - ready to develop!');
} else {
  console.log('🔧 Fix environment issues above, then run again');
  process.exit(1);
}
