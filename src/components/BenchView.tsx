import React, { useState, useEffect } from 'react';
import { ShopifyOrder, ShopifyLineItem } from '../lib/shopify';
import { useElectron } from '../hooks/useElectron';
import { getOrderAdminUrl, getShippingSettingsUrl } from '../lib/shopifyLinks';

interface BenchViewProps {
  order: ShopifyOrder | null;
  onComplete: (order: ShopifyOrder, pickedItems: PickedItem[]) => void;
  onIssue: (order: ShopifyOrder, reason: string) => void;
  onSkip: (order: ShopifyOrder) => void;
  onReprint: (order: ShopifyOrder) => void;
  shopDomain?: string;
  labelProvider?: 'shopify' | 'shippo' | 'easypost';
  shopifyLabelsSupported?: boolean;
}

interface PickedItem {
  lineItemId: string;
  variantId: string;
  sku: string;
  quantity: number;
  pickedQuantity: number;
  binLocation?: string;
  scannedBarcode?: string;
  isComplete: boolean;
}

interface PrinterStatus {
  name: string;
  isOnline: boolean;
  lastHeartbeat: string;
  errorCount: number;
  lastError?: string;
}

interface QueueStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  dead: number;
}

export const BenchView: React.FC<BenchViewProps> = ({
  order,
  onComplete,
  onIssue,
  onSkip,
  onReprint,
  shopDomain,
  labelProvider = 'shippo',
  shopifyLabelsSupported = false,
}) => {
  const { isElectron, invoke } = useElectron();
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [currentScan, setCurrentScan] = useState<string>('');
  const [scanMode, setScanMode] = useState<'item' | 'bin'>('item');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueReason, setIssueReason] = useState<string>('');
  const [activeLineItem, setActiveLineItem] = useState<string | null>(null);
  const [printerStatuses, setPrinterStatuses] = useState<PrinterStatus[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showPrinterBanner, setShowPrinterBanner] = useState(false);
  const [copiedText, setCopiedText] = useState<string>('');

  // Initialize picked items when order changes
  useEffect(() => {
    if (order) {
      const initialPickedItems: PickedItem[] = order.lineItems.map(item => ({
        lineItemId: item.id,
        variantId: item.variant.id,
        sku: item.variant.sku,
        quantity: item.quantity,
        pickedQuantity: 0,
        binLocation: undefined,
        scannedBarcode: undefined,
        isComplete: false,
      }));
      setPickedItems(initialPickedItems);
      setActiveLineItem(initialPickedItems[0]?.lineItemId || null);
    }
  }, [order]);

  // Load printer statuses and queue stats
  useEffect(() => {
    if (isElectron) {
      loadPrinterStatus();
      loadQueueStats();
      
      // Set up periodic updates
      const interval = setInterval(() => {
        loadPrinterStatus();
        loadQueueStats();
      }, 10000); // Every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [isElectron]);

  const loadPrinterStatus = async () => {
    try {
      const statuses = await invoke('printer:get-status');
      setPrinterStatuses(statuses);
      
      // Check if any printers are offline
      const hasOfflinePrinters = statuses.some((p: any) => !p.isOnline);
      setShowPrinterBanner(hasOfflinePrinters);
    } catch (error) {
      console.error('Failed to load printer status:', error);
    }
  };

  const loadQueueStats = async () => {
    try {
      const stats = await invoke('queue:get-stats');
      setQueueStats(stats);
      
      // Check if we're offline (no successful jobs recently)
      const hasRecentSuccess = stats.succeeded > 0;
      setIsOffline(!hasRecentSuccess && stats.queued > 0);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  // Handle barcode scanning
  const handleScan = (barcode: string) => {
    if (!order || !activeLineItem) return;

    const currentItem = pickedItems.find(item => item.lineItemId === activeLineItem);
    if (!currentItem) return;

    if (scanMode === 'item') {
      // Scan item barcode
      if (barcode === currentItem.sku || barcode === currentItem.variantId) {
        // Correct item scanned
        const updatedItems = pickedItems.map(item =>
          item.lineItemId === activeLineItem
            ? { ...item, pickedQuantity: item.pickedQuantity + 1 }
            : item
        );
        setPickedItems(updatedItems);
        
        // Check if item is complete
        const updatedItem = updatedItems.find(item => item.lineItemId === activeLineItem);
        if (updatedItem && updatedItem.pickedQuantity >= updatedItem.quantity) {
          // Move to next incomplete item
          const nextIncompleteIndex = updatedItems.findIndex(item => 
            !item.isComplete && item.pickedQuantity < item.quantity
          );
          if (nextIncompleteIndex !== -1) {
            setActiveLineItem(updatedItems[nextIncompleteIndex].lineItemId);
          }
        }
      } else {
        // Wrong item scanned - show error
        console.error('Wrong item scanned:', barcode, 'Expected:', currentItem.sku);
      }
    } else if (scanMode === 'bin') {
      // Scan bin location
      const updatedItems = pickedItems.map(item =>
        item.lineItemId === activeLineItem
          ? { ...item, binLocation: barcode }
          : item
      );
      setPickedItems(updatedItems);
      setScanMode('item'); // Switch back to item scanning
    }

    setCurrentScan('');
  };

  // Handle manual quantity input
  const handleQuantityChange = (lineItemId: string, quantity: number) => {
    const updatedItems = pickedItems.map(item =>
      item.lineItemId === lineItemId
        ? { ...item, pickedQuantity: Math.max(0, Math.min(quantity, item.quantity)) }
        : item
    );
    setPickedItems(updatedItems);
  };

  // Handle bin location input
  const handleBinLocationChange = (lineItemId: string, binLocation: string) => {
    const updatedItems = pickedItems.map(item =>
      item.lineItemId === lineItemId
        ? { ...item, binLocation }
        : item
    );
    setPickedItems(updatedItems);
  };

  // Check if order is ready for completion
  const isOrderComplete = () => {
    return pickedItems.every(item => 
      item.pickedQuantity >= item.quantity && item.binLocation
    );
  };

  // Handle order completion
  const handleComplete = async () => {
    if (order && isOrderComplete()) {
      try {
        // Mark items as complete
        const completedItems = pickedItems.map(item => ({
          ...item,
          isComplete: true,
        }));
        setPickedItems(completedItems);

        // Add jobs to queue for offline processing
        if (isElectron) {
          // Create label job
          await invoke('queue:add-job', {
            type: 'create_label',
            payload_json: {
              orderId: order.id,
              fromAddress: {
                name: 'Threads Alliance',
                company: 'Threads Alliance',
                street1: '123 Warehouse St',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90210',
                country: 'US',
              },
              toAddress: order.shippingAddress,
              packages: [{
                length: 12,
                width: 8,
                height: 4,
                weight: 1.5,
                distanceUnit: 'in',
                massUnit: 'lb',
              }],
              carrierAccount: 'default',
              serviceLevelToken: 'ground',
              labelFileType: 'zpl',
              metadata: { orderName: order.name },
            },
            idempotency_key: `label_${order.id}_${Date.now()}`,
            status: 'queued',
            attempts: 0,
            next_run_at: new Date().toISOString(),
            correlation_id: order.id,
          });

          // Create fulfillment job
          await invoke('queue:add-job', {
            type: 'create_fulfillment',
            payload_json: {
              orderId: order.id,
              lineItems: completedItems.map(item => ({
                id: item.lineItemId,
                quantity: item.pickedQuantity,
              })),
              trackingInfo: [],
              notifyCustomer: true,
            },
            idempotency_key: `fulfillment_${order.id}_${Date.now()}`,
            status: 'queued',
            attempts: 0,
            next_run_at: new Date().toISOString(),
            correlation_id: order.id,
          });
        }
        
        onComplete(order, pickedItems);
      } catch (error) {
        console.error('Failed to queue completion jobs:', error);
        // Still call onComplete even if queueing fails
        onComplete(order, pickedItems);
      }
    }
  };

  // Handle issue reporting
  const handleIssue = () => {
    setShowIssueModal(true);
  };

  // Submit issue
  const submitIssue = () => {
    if (order && issueReason.trim()) {
      onIssue(order, issueReason.trim());
      setShowIssueModal(false);
      setIssueReason('');
    }
  };

  // Handle skip
  const handleSkip = () => {
    if (order) {
      onSkip(order);
    }
  };

  // Handle reprint
  const handleReprint = () => {
    if (order) {
      onReprint(order);
    }
  };

  // Handle deep link actions
  const handleOpenInShopify = () => {
    if (order && shopDomain) {
      const url = getOrderAdminUrl(shopDomain, order.name);
      if (isElectron) {
        invoke('shell:open-external', url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  const handleShippingSettings = () => {
    if (shopDomain) {
      const url = getShippingSettingsUrl(shopDomain);
      if (isElectron) {
        invoke('shell:open-external', url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  // Copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (isElectron) {
        await invoke('clipboard:write-text', text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedText(label);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Copy shipping address
  const copyAddress = () => {
    if (order?.shippingAddress) {
      const address = order.shippingAddress;
      const addressText = `${address.firstName} ${address.lastName}\n${address.address1}\n${address.address2 ? address.address2 + '\n' : ''}${address.city}, ${address.province} ${address.zip}\n${address.country}`;
      copyToClipboard(addressText, 'Address copied');
    }
  };

  if (!order) {
    return (
      <div className="bench-view-empty flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <h3 className="text-lg font-medium mb-2">No Order Selected</h3>
          <p>Select an order from the queue to begin picking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bench-view bg-white rounded-lg shadow-lg">
      {/* Status Banners */}
      {showPrinterBanner && (
        <div className="printer-offline-banner bg-red-100 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Printer Offline:</strong> Some printers are not responding. Labels will be queued until printers are back online.
              </p>
            </div>
          </div>
        </div>
      )}

      {isOffline && (
        <div className="offline-banner bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Offline Mode:</strong> Network connection lost. Changes are being queued locally and will sync when connection is restored.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Header */}
      <div className="order-header bg-blue-600 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{order.name}</h1>
            <p className="text-blue-100">{order.email}</p>
            <p className="text-blue-100">
              {order.lineItems.length} items • 
              {order.shippingAddress && (
                <span> {order.shippingAddress.city}, {order.shippingAddress.province}</span>
              )}
            </p>
            
            {/* Provider Badge */}
            <div className="mt-2 flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Provider: {labelProvider === 'shopify' ? 'Shopify' : labelProvider === 'shippo' ? 'Shippo' : 'EasyPost'}
              </span>
              {labelProvider === 'shopify' && !shopifyLabelsSupported && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Shopify labels not available
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            {/* Deep Link Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={handleOpenInShopify}
                className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm"
              >
                Open in Shopify
              </button>
              {labelProvider === 'shopify' && !shopifyLabelsSupported && (
                <button
                  onClick={handleShippingSettings}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  Shipping Settings
                </button>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleReprint}
                className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
              >
                Reprint
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Skip
              </button>
              <button
                onClick={handleIssue}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Issue
              </button>
              <button
                onClick={handleComplete}
                disabled={!isOrderComplete()}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Order
              </button>
            </div>
          </div>
        </div>

        {/* Printer Status and Queue Info */}
        <div className="mt-4 flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-blue-200">Printers:</span>
            {printerStatuses.map(printer => (
              <span
                key={printer.name}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  printer.isOnline 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full mr-1 ${
                  printer.isOnline ? 'bg-green-400' : 'bg-red-400'
                }`}></span>
                {printer.name}
              </span>
            ))}
          </div>
          
          {queueStats && (
            <div className="flex items-center space-x-2">
              <span className="text-blue-200">Queue:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {queueStats.queued} queued
              </span>
              {queueStats.failed > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  {queueStats.failed} failed
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shipping Address with Copy Button */}
      {order.shippingAddress && (
        <div className="shipping-address bg-gray-50 p-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Shipping Address</h3>
              <div className="text-sm text-gray-600">
                <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                <p>{order.shippingAddress.address1}</p>
                {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
            <button
              onClick={copyAddress}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              {copiedText === 'Address copied' ? '✓ Copied' : 'Copy Address'}
            </button>
          </div>
        </div>
      )}

      {/* Scan Input */}
      <div className="scan-input p-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {scanMode === 'item' ? 'Scan Item' : 'Scan Bin Location'}
            </label>
            <input
              type="text"
              value={currentScan}
              onChange={(e) => setCurrentScan(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && currentScan.trim()) {
                  handleScan(currentScan.trim());
                }
              }}
              placeholder={scanMode === 'item' ? 'Scan item barcode...' : 'Scan bin location...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            onClick={() => setScanMode(scanMode === 'item' ? 'bin' : 'item')}
            className={`px-4 py-2 rounded-md font-medium ${
              scanMode === 'item' 
                ? 'bg-blue-600 text-white' 
                : 'bg-green-600 text-white'
            }`}
          >
            {scanMode === 'item' ? 'Switch to Bin' : 'Switch to Item'}
          </button>
        </div>
      </div>

      {/* Line Items */}
      <div className="line-items p-4">
        <h2 className="text-xl font-semibold mb-4">Items to Pick</h2>
        <div className="space-y-4">
          {pickedItems.map((item, index) => {
            const lineItem = order.lineItems.find(li => li.id === item.lineItemId);
            if (!lineItem) return null;

            const isActive = activeLineItem === item.lineItemId;
            const isComplete = item.pickedQuantity >= item.quantity && item.binLocation;

            return (
              <div
                key={item.lineItemId}
                className={`line-item p-4 border-2 rounded-lg transition-all ${
                  isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                } ${isComplete ? 'bg-green-50 border-green-500' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  {/* Item Image */}
                  <div className="flex-shrink-0">
                    {lineItem.variant.product.images[0] ? (
                      <img
                        src={lineItem.variant.product.images[0].url}
                        alt={lineItem.variant.product.title}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No Image</span>
                      </div>
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {lineItem.variant.product.title}
                      </h3>
                      {isComplete && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Complete
                        </span>
                      )}
                      {isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <p><strong>SKU:</strong> {lineItem.variant.sku}</p>
                        <p><strong>Variant:</strong> {lineItem.variant.title}</p>
                        <p><strong>Barcode:</strong> {lineItem.variant.barcode || 'None'}</p>
                      </div>
                      <div>
                        <p><strong>Quantity:</strong> {item.quantity}</p>
                        <p><strong>Picked:</strong> {item.pickedQuantity}</p>
                        <p><strong>Remaining:</strong> {item.quantity - item.pickedQuantity}</p>
                      </div>
                    </div>

                    {/* Quantity and Bin Controls */}
                    <div className="mt-4 flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">Quantity:</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.pickedQuantity}
                          onChange={(e) => handleQuantityChange(item.lineItemId, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <span className="text-sm text-gray-500">/ {item.quantity}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">Bin Location:</label>
                        <input
                          type="text"
                          value={item.binLocation || ''}
                          onChange={(e) => handleBinLocationChange(item.lineItemId, e.target.value)}
                          placeholder="Scan or enter bin"
                          className="w-32 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Report Issue</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order: {order.name}
            </p>
            <textarea
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full p-3 border border-gray-300 rounded mb-4 h-24 resize-none"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={submitIssue}
                disabled={!issueReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Submit Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
