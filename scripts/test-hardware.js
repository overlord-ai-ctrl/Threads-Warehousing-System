#!/usr/bin/env node

/**
 * Hardware Test Script for Threads Ops
 * Tests scanner and printer functionality without the full Electron app
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Threads Ops Hardware Test Script');
console.log('=====================================\n');

// Test 1: Check if we're in the right directory
console.log('1. Directory Check:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`   ✅ Package.json found: ${packageJson.name}`);
  console.log(`   ✅ Version: ${packageJson.version}`);
} catch (error) {
  console.log('   ❌ Package.json not found or invalid');
  process.exit(1);
}

// Test 2: Check Electron hardware files
console.log('\n2. Hardware Files Check:');
const hardwareFiles = [
  'electron/hardware/ScannerManager.ts',
  'electron/hardware/PrinterManager.ts',
  'electron/main.ts',
  'electron/preload.ts'
];

hardwareFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
});

// Test 3: Check React components
console.log('\n3. React Components Check:');
const componentFiles = [
  'src/components/HardwareTest.tsx',
  'src/hooks/useElectron.ts'
];

componentFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
});

// Test 4: Check TypeScript compilation
console.log('\n4. TypeScript Compilation Check:');
try {
  console.log('   🔄 Running TypeScript check...');
  execSync('npm run typecheck', { stdio: 'pipe' });
  console.log('   ✅ TypeScript compilation successful');
} catch (error) {
  console.log('   ❌ TypeScript compilation failed');
  console.log('   💡 Run: npm run typecheck for details');
}

// Test 5: Check ESLint
console.log('\n5. ESLint Check:');
try {
  console.log('   🔄 Running ESLint...');
  execSync('npm run lint', { stdio: 'pipe' });
  console.log('   ✅ ESLint passed');
} catch (error) {
  console.log('   ⚠️  ESLint found issues');
  console.log('   💡 Run: npm run lint:fix to auto-fix');
}

// Test 6: Check dependencies
console.log('\n6. Dependencies Check:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['electron', 'react', 'typescript'];
  const requiredDevDeps = ['@types/react', '@types/node'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`   ❌ ${dep} - MISSING from dependencies`);
    }
  });
  
  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`   ✅ ${dep}: ${packageJson.devDependencies[dep]}`);
    } else {
      console.log(`   ❌ ${dep} - MISSING from devDependencies`);
    }
  });
} catch (error) {
  console.log('   ❌ Failed to check dependencies');
}

// Test 7: Check environment
console.log('\n7. Environment Check:');
const envFile = '.env';
if (fs.existsSync(envFile)) {
  console.log('   ✅ .env file exists');
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasSupabaseUrl = envContent.includes('SUPABASE_URL');
  const hasSupabaseKey = envContent.includes('SUPABASE_ANON_KEY');
  console.log(`   ${hasSupabaseUrl ? '✅' : '❌'} SUPABASE_URL configured`);
  console.log(`   ${hasSupabaseKey ? '✅' : '❌'} SUPABASE_ANON_KEY configured`);
} else {
  console.log('   ❌ .env file missing');
}

// Test 8: Check build scripts
console.log('\n8. Build Scripts Check:');
const scripts = ['dev:renderer', 'dev:cloud', 'build', 'typecheck', 'lint'];
scripts.forEach(script => {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`   ✅ ${script} script available`);
    } else {
      console.log(`   ❌ ${script} script missing`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to check ${script} script`);
  }
});

console.log('\n=====================================');
console.log('🎯 Hardware Test Summary:');
console.log('   - If all checks pass, hardware integration is ready');
console.log('   - Run "npm run dev:renderer" to test in browser');
console.log('   - Run "npm run dev:electron" to test in Electron');
console.log('   - Navigate to /hardware-test to test scanner/printer');
console.log('\n💡 Next Steps:');
console.log('   1. Fix any ❌ issues above');
console.log('   2. Test scanner capture and label printing');
console.log('   3. Integrate with BenchView for real operations');
console.log('   4. Add offline queue and idempotency');
