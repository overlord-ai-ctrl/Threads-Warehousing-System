#!/usr/bin/env node

/**
 * Packaging Scripts for Threads Ops
 * Builds signed installers for Windows and macOS
 */

const { execSync } = require('child_process');
const { platform } = require('os');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  appName: 'Threads Ops',
  appId: 'com.threadsalliance.threadsops',
  version: process.env.npm_package_version || '1.0.0',
  buildDir: 'dist',
  electronVersion: '28.0.0',
  iconPath: {
    win: 'assets/icon.ico',
    mac: 'assets/icon.icns',
  },
  certificate: {
    win: process.env.WINDOWS_CERT_PATH,
    mac: process.env.MACOS_CERT_IDENTITY,
  },
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${colors.bright}${colors.blue}=== ${step} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

// Utility functions
function runCommand(command, options = {}) {
  try {
    logInfo(`Running: ${command}`);
    execSync(command, { 
      stdio: 'inherit', 
      cwd: process.cwd(),
      ...options 
    });
    return true;
  } catch (error) {
    logError(`Command failed: ${command}`);
    return false;
  }
}

function checkPrerequisites() {
  logStep('Checking Prerequisites');
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    logError('package.json not found. Please run this script from the project root.');
    process.exit(1);
  }

  // Check if electron-builder is installed
  try {
    require('electron-builder');
    logSuccess('electron-builder is available');
  } catch (error) {
    logError('electron-builder not found. Please install it first: npm install --save-dev electron-builder');
    process.exit(1);
  }

  // Check platform-specific requirements
  if (platform() === 'win32') {
    if (!config.certificate.win) {
      logWarning('Windows certificate path not set. Installer will not be signed.');
      logInfo('Set WINDOWS_CERT_PATH environment variable to sign the installer.');
    }
  } else if (platform() === 'darwin') {
    if (!config.certificate.mac) {
      logWarning('macOS certificate identity not set. Installer will not be signed.');
      logInfo('Set MACOS_CERT_IDENTITY environment variable to sign the installer.');
    }
  }

  logSuccess('Prerequisites check completed');
}

function buildApp() {
  logStep('Building Application');
  
  // Clean previous builds
  if (fs.existsSync(config.buildDir)) {
    logInfo('Cleaning previous builds...');
    fs.rmSync(config.buildDir, { recursive: true, force: true });
  }

  // Build the React app
  logInfo('Building React app...');
  if (!runCommand('npm run build')) {
    logError('Failed to build React app');
    process.exit(1);
  }

  // Build Electron app
  logInfo('Building Electron app...');
  if (!runCommand('npm run build:electron')) {
    logError('Failed to build Electron app');
    process.exit(1);
  }

  logSuccess('Application build completed');
}

function packageWindows() {
  logStep('Packaging for Windows');
  
  const buildConfig = {
    appId: config.appId,
    productName: config.appName,
    directories: {
      output: path.join(config.buildDir, 'win'),
      buildResources: 'build',
    },
    files: [
      'dist/**/*',
      'electron/**/*',
      'node_modules/**/*',
      'package.json',
    ],
    win: {
      target: [
        {
          target: 'nsis',
          arch: ['x64'],
        },
        {
          target: 'portable',
          arch: ['x64'],
        },
      ],
      icon: config.iconPath.win,
      certificateFile: config.certificate.win,
      certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      signAndEditExecutable: !!config.certificate.win,
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: config.appName,
      installerIcon: config.iconPath.win,
      uninstallerIcon: config.iconPath.win,
    },
  };

  // Write build configuration
  const configPath = path.join(config.buildDir, 'electron-builder-win.json');
  fs.writeFileSync(configPath, JSON.stringify(buildConfig, null, 2));

  // Build Windows installer
  if (runCommand(`npx electron-builder --config ${configPath}`)) {
    logSuccess('Windows packaging completed');
  } else {
    logError('Windows packaging failed');
    process.exit(1);
  }
}

function packageMacOS() {
  logStep('Packaging for macOS');
  
  const buildConfig = {
    appId: config.appId,
    productName: config.appName,
    directories: {
      output: path.join(config.buildDir, 'mac'),
      buildResources: 'build',
    },
    files: [
      'dist/**/*',
      'electron/**/*',
      'node_modules/**/*',
      'package.json',
    ],
    mac: {
      target: [
        {
          target: 'dmg',
          arch: ['x64', 'arm64'],
        },
        {
          target: 'zip',
          arch: ['x64', 'arm64'],
        },
      ],
      icon: config.iconPath.mac,
      category: 'public.app-category.business',
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist',
      identity: config.certificate.mac,
    },
    dmg: {
      title: `${config.appName} ${config.version}`,
      icon: config.iconPath.mac,
      background: 'build/background.png',
      window: {
        width: 540,
        height: 380,
      },
      contents: [
        {
          x: 130,
          y: 220,
        },
        {
          x: 410,
          y: 220,
          type: 'link',
          path: '/Applications',
        },
      ],
    },
  };

  // Write build configuration
  const configPath = path.join(config.buildDir, 'electron-builder-mac.json');
  fs.writeFileSync(configPath, JSON.stringify(buildConfig, null, 2));

  // Build macOS installer
  if (runCommand(`npx electron-builder --config ${configPath}`)) {
    logSuccess('macOS packaging completed');
  } else {
    logError('macOS packaging failed');
    process.exit(1);
  }
}

function packageLinux() {
  logStep('Packaging for Linux');
  
  const buildConfig = {
    appId: config.appId,
    productName: config.appName,
    directories: {
      output: path.join(config.buildDir, 'linux'),
      buildResources: 'build',
    },
    files: [
      'dist/**/*',
      'electron/**/*',
      'node_modules/**/*',
      'package.json',
    ],
    linux: {
      target: [
        {
          target: 'AppImage',
          arch: ['x64'],
        },
        {
          target: 'deb',
          arch: ['x64'],
        },
        {
          target: 'rpm',
          arch: ['x64'],
        },
      ],
      icon: 'assets/icon.png',
      category: 'Office',
    },
  };

  // Write build configuration
  const configPath = path.join(config.buildDir, 'electron-builder-linux.json');
  fs.writeFileSync(configPath, JSON.stringify(buildConfig, null, 2));

  // Build Linux packages
  if (runCommand(`npx electron-builder --config ${configPath}`)) {
    logSuccess('Linux packaging completed');
  } else {
    logError('Linux packaging failed');
    process.exit(1);
  }
}

function createReleaseNotes() {
  logStep('Creating Release Notes');
  
  const releaseNotes = `# ${config.appName} ${config.version}

## Release Date
${new Date().toISOString().split('T')[0]}

## What's New
- Offline-first job queue system
- Auto-updater with crash recovery
- Hardware integration (scanner & printer)
- Shopify integration improvements

## Installation
1. Download the appropriate installer for your platform
2. Run the installer and follow the setup wizard
3. Launch the application

## System Requirements
- Windows 10/11 or macOS 13+
- 4GB RAM minimum
- 2GB free disk space
- Internet connection for initial setup

## Support
For support, visit: https://support.threadsops.com
`;

  const notesPath = path.join(config.buildDir, 'RELEASE_NOTES.md');
  fs.writeFileSync(notesPath, releaseNotes);
  logSuccess('Release notes created');
}

function main() {
  const target = process.argv[2] || 'all';
  
  logStep(`Starting Packaging Process for ${target.toUpperCase()}`);
  logInfo(`Version: ${config.version}`);
  logInfo(`Platform: ${platform()}`);
  
  try {
    checkPrerequisites();
    buildApp();
    
    switch (target.toLowerCase()) {
      case 'win':
      case 'windows':
        packageWindows();
        break;
      case 'mac':
      case 'macos':
        packageMacOS();
        break;
      case 'linux':
        packageLinux();
        break;
      case 'all':
        if (platform() === 'win32') {
          packageWindows();
        } else if (platform() === 'darwin') {
          packageMacOS();
        } else {
          packageLinux();
        }
        break;
      default:
        logError(`Unknown target: ${target}`);
        logInfo('Available targets: win, mac, linux, all');
        process.exit(1);
    }
    
    createReleaseNotes();
    
    logStep('Packaging Complete');
    logSuccess(`Installers created in ${config.buildDir}/ directory`);
    logInfo('Next steps:');
    logInfo('1. Test the installers on target platforms');
    logInfo('2. Sign the installers if not already signed');
    logInfo('3. Upload to your distribution platform');
    
  } catch (error) {
    logError('Packaging failed');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  config,
  packageWindows,
  packageMacOS,
  packageLinux,
  buildApp,
};
