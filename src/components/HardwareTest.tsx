import React, { useState, useEffect } from 'react';
import { useElectron } from '../hooks/useElectron';

interface ScanEvent {
  id: string;
  barcode: string;
  type: 'order_qr' | 'sku' | 'bin' | 'unknown';
  timestamp: string;
  source: 'scanner' | 'manual' | 'test';
  confidence?: number;
}

interface PrinterStatus {
  name: string;
  isOnline: boolean;
  lastHeartbeat: string;
  errorCount: number;
  lastError?: string;
}

export const HardwareTest: React.FC = () => {
  const { isElectron } = useElectron();
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [printerStatuses, setPrinterStatuses] = useState<PrinterStatus[]>([]);
  const [testBarcode, setTestBarcode] = useState('');
  const [testType, setTestType] = useState<'order_qr' | 'sku' | 'bin' | 'unknown'>('sku');
  const [scannerConfig, setScannerConfig] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (isElectron) {
      // Load initial data
      loadScannerConfig();
      loadPrinterStatus();
      loadScanHistory();

      // Set up event listeners
      window.electronAPI.on('scanner:scan-event', (scanEvent: ScanEvent) => {
        setScanEvents(prev => [scanEvent, ...prev.slice(0, 9)]); // Keep last 10
      });

      window.electronAPI.on('printer:status-update', () => {
        loadPrinterStatus();
      });
    }
  }, [isElectron]);

  const loadScannerConfig = async () => {
    if (isElectron) {
      try {
        const config = await window.electronAPI.scanner.getConfig();
        setScannerConfig(config);
      } catch (error) {
        console.error('Failed to load scanner config:', error);
      }
    }
  };

  const loadPrinterStatus = async () => {
    if (isElectron) {
      try {
        const status = await window.electronAPI.printer.getStatus();
        setPrinterStatuses(status);
      } catch (error) {
        console.error('Failed to load printer status:', error);
      }
    }
  };

  const loadScanHistory = async () => {
    if (isElectron) {
      try {
        const history = await window.electronAPI.scanner.getHistory();
        setScanEvents(history.slice(0, 10)); // Last 10 scans
      } catch (error) {
        console.error('Failed to load scan history:', error);
      }
    }
  };

  const startScannerCapture = async () => {
    if (isElectron) {
      try {
        await window.electronAPI.scanner.startCapture();
        setIsCapturing(true);
      } catch (error) {
        console.error('Failed to start scanner capture:', error);
      }
    }
  };

  const stopScannerCapture = async () => {
    if (isElectron) {
      try {
        await window.electronAPI.scanner.stopCapture();
        setIsCapturing(false);
      } catch (error) {
        console.error('Failed to stop scanner capture:', error);
      }
    }
  };

  const simulateScan = async () => {
    if (isElectron && testBarcode.trim()) {
      try {
        const scanEvent = await window.electronAPI.scanner.testScan(testBarcode.trim(), testType);
        setScanEvents(prev => [scanEvent, ...prev.slice(0, 9)]);
        setTestBarcode('');
      } catch (error) {
        console.error('Failed to simulate scan:', error);
      }
    }
  };

  const testPrint = async () => {
    if (isElectron && printerStatuses.length > 0) {
      try {
        const printerName = printerStatuses[0].name;
        const testZPL = `^XA^FO50,50^A0N,50,50^FDTest Label^FS^XZ`;
        
        const result = await window.electronAPI.printer.printLabel({
          orderId: 'TEST_ORDER',
          zpl: testZPL,
          printerName,
          idempotencyKey: `test_${Date.now()}`,
          format: 'zpl'
        });

        if (result.success) {
          alert('Test label sent to printer successfully!');
        } else {
          alert(`Print failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Failed to test print:', error);
        alert('Print test failed');
      }
    }
  };

  if (!isElectron) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Hardware Test</h1>
        <p className="text-gray-600">This component requires Electron to test hardware functionality.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Hardware Test Interface</h1>
      
      {/* Scanner Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Barcode Scanner</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scanner Controls */}
          <div>
            <h3 className="text-lg font-medium mb-3">Scanner Controls</h3>
            <div className="space-y-3">
              <button
                onClick={startScannerCapture}
                disabled={isCapturing}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {isCapturing ? 'Capturing...' : 'Start Scanner Capture'}
              </button>
              
              <button
                onClick={stopScannerCapture}
                disabled={!isCapturing}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                Stop Scanner Capture
              </button>
            </div>

            {/* Test Scan */}
            <div className="mt-4">
              <h4 className="text-md font-medium mb-2">Test Scan</h4>
              <input
                type="text"
                value={testBarcode}
                onChange={(e) => setTestBarcode(e.target.value)}
                placeholder="Enter test barcode"
                className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
              />
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
              >
                <option value="sku">SKU</option>
                <option value="order_qr">Order QR</option>
                <option value="bin">Bin</option>
                <option value="unknown">Unknown</option>
              </select>
              <button
                onClick={simulateScan}
                disabled={!testBarcode.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                Simulate Scan
              </button>
            </div>
          </div>

          {/* Scanner Status */}
          <div>
            <h3 className="text-lg font-medium mb-3">Scanner Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-medium ${isCapturing ? 'text-green-600' : 'text-red-600'}`}>
                  {isCapturing ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Debounce:</span>
                <span>{scannerConfig?.debounceMs || 'N/A'}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Total Scans:</span>
                <span>{scanEvents.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Recent Scans</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {scanEvents.map((scan) => (
              <div key={scan.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{scan.barcode}</span>
                  <span className="ml-2 text-sm text-gray-500">({scan.type})</span>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(scan.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {scanEvents.length === 0 && (
              <p className="text-gray-500 text-center py-4">No scans yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Printer Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Label Printer</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Printer Controls */}
          <div>
            <h3 className="text-lg font-medium mb-3">Printer Controls</h3>
            <button
              onClick={testPrint}
              disabled={printerStatuses.length === 0}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
            >
              Print Test Label
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Sends a test ZPL label to the first available printer
            </p>
          </div>

          {/* Printer Status */}
          <div>
            <h3 className="text-lg font-medium mb-3">Printer Status</h3>
            <div className="space-y-2">
              {printerStatuses.map((printer) => (
                <div key={printer.name} className="p-3 border rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{printer.name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      printer.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {printer.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Errors: {printer.errorCount}</div>
                    <div>Last Heartbeat: {new Date(printer.lastHeartbeat).toLocaleTimeString()}</div>
                    {printer.lastError && (
                      <div className="text-red-600">Last Error: {printer.lastError}</div>
                    )}
                  </div>
                </div>
              ))}
              {printerStatuses.length === 0 && (
                <p className="text-gray-500 text-center py-4">No printers detected</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
