import { useCallback } from 'react';

export const useElectron = () => {
  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  const invoke = useCallback(async (channel: string, ...args: any[]): Promise<any> => {
    if (!isElectron) {
      throw new Error('Electron API not available');
    }

    // Map channel names to the new API structure
    const [namespace, method] = channel.split(':');
    
    if (namespace === 'shell' && method === 'open-external') {
      return window.electronAPI.shell.openExternal(args[0]);
    }
    
    if (namespace === 'clipboard') {
      if (method === 'write-text') {
        return window.electronAPI.clipboard.writeText(args[0]);
      }
      if (method === 'read-text') {
        return window.electronAPI.clipboard.readText();
      }
    }
    
    if (namespace === 'app') {
      if (method === 'get-version') {
        return window.electronAPI.app.getVersion();
      }
      if (method === 'get-name') {
        return window.electronAPI.app.getName();
      }
      if (method === 'get-path') {
        return window.electronAPI.app.getPath(args[0]);
      }
    }
    
    if (namespace === 'system') {
      if (method === 'get-platform') {
        return window.electronAPI.system.getPlatform();
      }
      if (method === 'get-arch') {
        return window.electronAPI.system.getArch();
      }
      if (method === 'get-node-version') {
        return window.electronAPI.system.getNodeVersion();
      }
    }
    
    if (namespace === 'file') {
      if (method === 'show-open-dialog') {
        return window.electronAPI.file.showOpenDialog(args[0]);
      }
      if (method === 'show-save-dialog') {
        return window.electronAPI.file.showSaveDialog(args[0]);
      }
    }
    
    if (namespace === 'printer') {
      if (method === 'print-label') {
        return window.electronAPI.printer.printLabel(args[0]);
      }
      if (method === 'get-status') {
        return window.electronAPI.printer.getStatus();
      }
      if (method === 'get-cache') {
        return window.electronAPI.printer.getCache(args[0]);
      }
      if (method === 'reprint') {
        return window.electronAPI.printer.reprint(args[0], args[1]);
      }
    }
    
    if (namespace === 'scanner') {
      if (method === 'get-config') {
        return window.electronAPI.scanner.getConfig();
      }
      if (method === 'set-config') {
        return window.electronAPI.scanner.setConfig(args[0]);
      }
      if (method === 'start-capture') {
        return window.electronAPI.scanner.startCapture();
      }
      if (method === 'stop-capture') {
        return window.electronAPI.scanner.stopCapture();
      }
      if (method === 'get-history') {
        return window.electronAPI.scanner.getHistory();
      }
      if (method === 'clear-history') {
        return window.electronAPI.scanner.clearHistory();
      }
      if (method === 'test-scan') {
        return window.electronAPI.scanner.testScan(args[0], args[1]);
      }
      if (method === 'get-status') {
        return window.electronAPI.scanner.getStatus();
      }
    }
    
    if (namespace === 'queue') {
      if (method === 'add-job') {
        return window.electronAPI.queue.addJob(args[0]);
      }
      if (method === 'get-stats') {
        return window.electronAPI.queue.getStats();
      }
      if (method === 'get-jobs') {
        return window.electronAPI.queue.getJobs(args[0], args[1]);
      }
      if (method === 'retry-job') {
        return window.electronAPI.queue.retryJob(args[0]);
      }
      if (method === 'clear-dead-jobs') {
        return window.electronAPI.queue.clearDeadJobs();
      }
      if (method === 'get-job-history') {
        return window.electronAPI.queue.getJobHistory(args[0]);
      }
    }
    
    if (namespace === 'database') {
      if (method === 'query') {
        return window.electronAPI.database.query(args[0], args[1]);
      }
      if (method === 'execute') {
        return window.electronAPI.database.execute(args[0], args[1]);
      }
    }
    
    if (namespace === 'security') {
      if (method === 'store-token') {
        return window.electronAPI.security.storeToken(args[0], args[1]);
      }
      if (method === 'get-token') {
        return window.electronAPI.security.getToken(args[0]);
      }
    }

    throw new Error(`Unknown channel: ${channel}`);
  }, [isElectron]);

  const on = useCallback((channel: string, callback: Function) => {
    if (!isElectron) {
      console.warn('Electron API not available for event listening');
      return;
    }
    window.electronAPI.on(channel, callback);
  }, [isElectron]);

  const removeAllListeners = useCallback((channel: string) => {
    if (!isElectron) {
      return;
    }
    window.electronAPI.removeAllListeners(channel);
  }, [isElectron]);

  return {
    isElectron,
    invoke,
    on,
    removeAllListeners,
  };
};
