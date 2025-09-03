import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Hardware operations
  printer: {
    printLabel: (request: any) => ipcRenderer.invoke('printer:print-label', request),
    getStatus: () => ipcRenderer.invoke('printer:get-status'),
    getCache: (orderId: string) => ipcRenderer.invoke('printer:get-cache', orderId),
    reprint: (orderId: string, printerName: string) => ipcRenderer.invoke('printer:reprint', orderId, printerName),
  },
  
  scanner: {
    getConfig: () => ipcRenderer.invoke('scanner:get-config'),
    setConfig: (config: any) => ipcRenderer.invoke('scanner:set-config', config),
    startCapture: () => ipcRenderer.invoke('scanner:start-capture'),
    stopCapture: () => ipcRenderer.invoke('scanner:stop-capture'),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
    clearHistory: () => ipcRenderer.invoke('scanner:clear-history'),
    testScan: (barcode: string, type: string) => ipcRenderer.invoke('scanner:test-scan', barcode, type),
    getStatus: () => ipcRenderer.invoke('scanner:get-status'),
  },
  
  queue: {
    addJob: (jobData: any) => ipcRenderer.invoke('queue:add-job', jobData),
    getStats: () => ipcRenderer.invoke('queue:get-stats'),
    getJobs: (status?: string, limit?: number) => ipcRenderer.invoke('queue:get-jobs', status, limit),
    retryJob: (jobId: string) => ipcRenderer.invoke('queue:retry-job', jobId),
    clearDeadJobs: () => ipcRenderer.invoke('queue:clear-dead-jobs'),
    getJobHistory: (jobId: string) => ipcRenderer.invoke('queue:get-job-history', jobId),
  },
  
  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  
  // Clipboard operations
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
  },
  
  // App information
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getName: () => ipcRenderer.invoke('app:get-name'),
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
  },
  
  // System information
  system: {
    getPlatform: () => ipcRenderer.invoke('system:get-platform'),
    getArch: () => ipcRenderer.invoke('system:get-arch'),
    getNodeVersion: () => ipcRenderer.invoke('system:get-node-version'),
  },
  
  // File operations
  file: {
    showOpenDialog: (options: any) => ipcRenderer.invoke('file:show-open-dialog', options),
    showSaveDialog: (options: any) => ipcRenderer.invoke('file:show-save-dialog', options),
  },
  
  // Database operations (if needed)
  database: {
    query: (query: string, params: any[]) => ipcRenderer.invoke('database:query', query, params),
    execute: (query: string, params: any[]) => ipcRenderer.invoke('database:execute', query, params),
  },
  
  // Security operations (if needed)
  security: {
    storeToken: (key: string, value: string) => ipcRenderer.invoke('security:store-token', key, value),
    getToken: (key: string) => ipcRenderer.invoke('security:get-token', key),
  },
  
  // Event listeners
  on: (channel: string, callback: Function) => {
    // Whitelist channels
    const validChannels = [
      'printer:status-update',
      'scanner:scan-event',
      'queue:job-added',
      'queue:job-processed',
    ];
    
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // Remove event listeners
  removeAllListeners: (channel: string) => {
    const validChannels = [
      'printer:status-update',
      'scanner:scan-event',
      'queue:job-added',
      'queue:job-processed',
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      printer: {
        printLabel: (request: any) => Promise<any>;
        getStatus: () => Promise<any>;
        getCache: (orderId: string) => Promise<any>;
        reprint: (orderId: string, printerName: string) => Promise<any>;
      };
      scanner: {
        getConfig: () => Promise<any>;
        setConfig: (config: any) => Promise<any>;
        startCapture: () => Promise<any>;
        stopCapture: () => Promise<any>;
        getHistory: () => Promise<any>;
        clearHistory: () => Promise<any>;
        testScan: (barcode: string, type: string) => Promise<any>;
        getStatus: () => Promise<any>;
      };
      queue: {
        addJob: (jobData: any) => Promise<any>;
        getStats: () => Promise<any>;
        getJobs: (status?: string, limit?: number) => Promise<any>;
        retryJob: (jobId: string) => Promise<any>;
        clearDeadJobs: () => Promise<any>;
        getJobHistory: (jobId: string) => Promise<any>;
      };
      shell: {
        openExternal: (url: string) => Promise<any>;
      };
      clipboard: {
        writeText: (text: string) => Promise<any>;
        readText: () => Promise<any>;
      };
      app: {
        getVersion: () => Promise<string>;
        getName: () => Promise<string>;
        getPath: (name: string) => Promise<string | null>;
      };
      system: {
        getPlatform: () => Promise<string>;
        getArch: () => Promise<string>;
        getNodeVersion: () => Promise<string>;
      };
      file: {
        showOpenDialog: (options: any) => Promise<any>;
        showSaveDialog: (options: any) => Promise<any>;
      };
      database: {
        query: (query: string, params: any[]) => Promise<any>;
        execute: (query: string, params: any[]) => Promise<any>;
      };
      security: {
        storeToken: (key: string, value: string) => Promise<any>;
        getToken: (key: string) => Promise<any>;
      };
      on: (channel: string, callback: Function) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
