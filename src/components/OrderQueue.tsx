import React, { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ShopifyOrder } from '../lib/shopify';

interface OrderQueueProps {
  orders: ShopifyOrder[];
  onOrderSelect: (order: ShopifyOrder) => void;
  onOrderComplete: (order: ShopifyOrder) => void;
  onOrderIssue: (order: ShopifyOrder, reason: string) => void;
  onOrderSkip: (order: ShopifyOrder) => void;
  sortBy: 'promise' | 'express' | 'zone' | 'sku' | 'numeric' | 'age';
  filterStatus?: string;
}

interface OrderWithMetadata extends ShopifyOrder {
  age: number; // minutes since creation
  slaRisk: 'low' | 'medium' | 'high';
  zone?: string;
  skuCluster?: string;
}

export const OrderQueue: React.FC<OrderQueueProps> = ({
  orders,
  onOrderSelect,
  onOrderComplete,
  onOrderIssue,
  onOrderSkip,
  sortBy,
  filterStatus,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [issueReason, setIssueReason] = useState<string>('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [pendingIssueOrder, setPendingIssueOrder] = useState<ShopifyOrder | null>(null);

  // Calculate order metadata for display and sorting
  const ordersWithMetadata = useMemo((): OrderWithMetadata[] => {
    return orders.map(order => {
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      const age = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
      
      // Calculate SLA risk based on age
      let slaRisk: 'low' | 'medium' | 'high' = 'low';
      if (age > 15) slaRisk = 'high';
      else if (age > 5) slaRisk = 'medium';

      // Extract zone from tags or custom attributes
      const zone = order.tags.find(tag => tag.startsWith('zone:'))?.split(':')[1];
      
      // Create SKU cluster based on first few characters
      const skuCluster = order.lineItems[0]?.variant.sku?.substring(0, 3) || '';

      return {
        ...order,
        age,
        slaRisk,
        zone,
        skuCluster,
      };
    });
  }, [orders]);

  // Sort orders based on selected criteria
  const sortedOrders = useMemo(() => {
    const sorted = [...ordersWithMetadata];
    
    switch (sortBy) {
      case 'promise':
        // Sort by promise time (extracted from tags or custom attributes)
        sorted.sort((a, b) => {
          const aPromise = a.tags.find(tag => tag.startsWith('promise:'))?.split(':')[1];
          const bPromise = b.tags.find(tag => tag.startsWith('promise:'))?.split(':')[1];
          if (!aPromise && !bPromise) return 0;
          if (!aPromise) return 1;
          if (!bPromise) return -1;
          return new Date(aPromise).getTime() - new Date(bPromise).getTime();
        });
        break;
      
      case 'express':
        // Express orders first (based on tags or shipping method)
        sorted.sort((a, b) => {
          const aExpress = a.tags.includes('express') || a.tags.includes('rush');
          const bExpress = b.tags.includes('express') || b.tags.includes('rush');
          if (aExpress && !bExpress) return -1;
          if (!aExpress && bExpress) return 1;
          return 0;
        });
        break;
      
      case 'zone':
        // Sort by zone, then by age
        sorted.sort((a, b) => {
          if (a.zone && b.zone) {
            if (a.zone === b.zone) {
              return a.age - b.age;
            }
            return a.zone.localeCompare(b.zone);
          }
          return a.age - b.age;
        });
        break;
      
      case 'sku':
        // Sort by SKU cluster, then by age
        sorted.sort((a, b) => {
          if (a.skuCluster && b.skuCluster) {
            if (a.skuCluster === b.skuCluster) {
              return a.age - b.age;
            }
            return a.skuCluster.localeCompare(b.skuCluster);
          }
          return a.age - b.age;
        });
        break;
      
      case 'numeric':
        // Sort by order number (extract numeric part)
        sorted.sort((a, b) => {
          const aNum = parseInt(a.name.replace(/\D/g, ''));
          const bNum = parseInt(b.name.replace(/\D/g, ''));
          return aNum - bNum;
        });
        break;
      
      case 'age':
      default:
        // Sort by age (oldest first)
        sorted.sort((a, b) => b.age - a.age);
        break;
    }
    
    return sorted;
  }, [ordersWithMetadata, sortBy]);

  // Filter orders by status if specified
  const filteredOrders = useMemo(() => {
    if (!filterStatus) return sortedOrders;
    return sortedOrders.filter(order => order.fulfillmentStatus === filterStatus);
  }, [sortedOrders, filterStatus]);

  // Handle order selection
  const handleOrderClick = (order: ShopifyOrder) => {
    setSelectedOrderId(order.id);
    onOrderSelect(order);
  };

  // Handle order completion
  const handleComplete = (order: ShopifyOrder) => {
    onOrderComplete(order);
    if (selectedOrderId === order.id) {
      setSelectedOrderId(null);
    }
  };

  // Handle order issue
  const handleIssue = (order: ShopifyOrder) => {
    setPendingIssueOrder(order);
    setShowIssueModal(true);
  };

  // Submit issue with reason
  const submitIssue = () => {
    if (pendingIssueOrder && issueReason.trim()) {
      onOrderIssue(pendingIssueOrder, issueReason.trim());
      setShowIssueModal(false);
      setIssueReason('');
      setPendingIssueOrder(null);
      if (selectedOrderId === pendingIssueOrder.id) {
        setSelectedOrderId(null);
      }
    }
  };

  // Handle order skip
  const handleSkip = (order: ShopifyOrder) => {
    onOrderSkip(order);
    if (selectedOrderId === order.id) {
      setSelectedOrderId(null);
    }
  };

  // Get color class based on SLA risk
  const getSlaColorClass = (slaRisk: string) => {
    switch (slaRisk) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-green-500 bg-green-50';
    }
  };

  // Get age display text
  const getAgeText = (age: number) => {
    if (age < 1) return 'Just now';
    if (age < 60) return `${age}m ago`;
    if (age < 1440) return `${Math.floor(age / 60)}h ago`;
    return `${Math.floor(age / 1440)}d ago`;
  };

  return (
    <div className="order-queue">
      {/* Queue Header */}
      <div className="queue-header bg-gray-100 p-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            Order Queue ({filteredOrders.length})
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => onOrderSelect(filteredOrders[0])}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next Order
            </button>
          </div>
        </div>
      </div>

      {/* Order List */}
      <div className="order-list max-h-96 overflow-y-auto">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className={`order-item border-l-4 p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedOrderId === order.id ? 'ring-2 ring-blue-500' : ''
            } ${getSlaColorClass(order.slaRisk)}`}
            onClick={() => handleOrderClick(order)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {order.name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    order.slaRisk === 'high' ? 'bg-red-100 text-red-800' :
                    order.slaRisk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {order.slaRisk.toUpperCase()}
                  </span>
                  {order.zone && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      Zone {order.zone}
                    </span>
                  )}
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  <p>{order.lineItems.length} items • {order.email}</p>
                  <p className="text-xs text-gray-500">
                    Created {getAgeText(order.age)} • 
                    {order.shippingAddress && (
                      <span> {order.shippingAddress.city}, {order.shippingAddress.state}</span>
                    )}
                  </p>
                </div>

                {/* Line Items Preview */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.lineItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                    >
                      {item.variant.sku} × {item.quantity}
                    </span>
                  ))}
                  {order.lineItems.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-gray-300 text-gray-600 rounded">
                      +{order.lineItems.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-2 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete(order);
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Complete
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIssue(order);
                  }}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Issue
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSkip(order);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Report Issue</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order: {pendingIssueOrder?.name}
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
