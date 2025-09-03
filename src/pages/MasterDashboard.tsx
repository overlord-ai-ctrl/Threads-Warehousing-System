import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useElectron } from '../hooks/useElectron';
import { toast } from '../components/ToastContainer';

export const MasterDashboard: React.FC = () => {
  const { isElectron, printer, database } = useElectron();
  const [brands, setBrands] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load mock data for now
      const mockBrands = [
        {
          id: 'brand_1',
          name: 'Crooks & Co',
          logo: '🏪',
          shopDomain: 'crooks-co.myshopify.com',
          ordersWaiting: 12,
          slaRisk: 3,
          printerHealth: 'online',
          lastSync: '2 minutes ago',
        },
        {
          id: 'brand_2',
          name: 'Garta',
          logo: '🛍️',
          shopDomain: 'garta.myshopify.com',
          ordersWaiting: 8,
          slaRisk: 1,
          printerHealth: 'warning',
          lastSync: '5 minutes ago',
        },
        {
          id: 'brand_3',
          name: 'Threads Collective',
          logo: '🧵',
          shopDomain: 'threads-collective.myshopify.com',
          ordersWaiting: 25,
          slaRisk: 7,
          printerHealth: 'offline',
          lastSync: '15 minutes ago',
        },
      ];

      setBrands(mockBrands);

      // Load system health if in Electron
      if (isElectron) {
        try {
          const printerStatus = await printer.health();
          setSystemHealth({
            printers: printerStatus,
            lastUpdated: new Date().toLocaleTimeString(),
          });
        } catch (error) {
          console.error('Failed to load printer health:', error);
        }
      }

    } catch (error) {
      toast.error('Failed to load dashboard', 'Please refresh the page and try again.');
      console.error('Dashboard load failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPrinterHealthColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'offline':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSlaRiskColor = (count: number) => {
    if (count === 0) return 'text-green-600 bg-green-100';
    if (count <= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Threads Alliance Ops</h1>
          <p className="mt-2 text-gray-600">
            Master dashboard for all warehouse operations
          </p>
        </div>

        {/* System Health Overview */}
        {isElectron && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-sm">🖨️</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Printers</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {systemHealth.printers?.printers?.length || 0} Connected
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm">📡</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Network</p>
                    <p className="text-lg font-semibold text-gray-900">Online</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-sm">💾</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Database</p>
                    <p className="text-lg font-semibold text-gray-900">Healthy</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brand Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Brand Overview</h2>
            <button
              onClick={loadDashboardData}
              className="btn btn-secondary btn-sm"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <div key={brand.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Brand Header */}
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-lg flex items-center justify-center text-2xl">
                      {brand.logo}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{brand.name}</h3>
                      <p className="text-sm text-gray-500">{brand.shopDomain}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Orders Waiting</span>
                      <span className="text-lg font-semibold text-primary-600">
                        {brand.ordersWaiting}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">SLA Risk</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSlaRiskColor(brand.slaRisk)}`}>
                        {brand.slaRisk} orders
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Printer Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPrinterHealthColor(brand.printerHealth)}`}>
                        {brand.printerHealth}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Last Sync</span>
                      <span className="text-sm text-gray-500">{brand.lastSync}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <Link
                      to={`/brand/${brand.id}`}
                      className="btn btn-primary w-full"
                    >
                      Open Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              to="/exceptions"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-center"
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h3 className="font-medium text-gray-900">View Exceptions</h3>
              <p className="text-sm text-gray-500 mt-1">Handle issues across all brands</p>
            </Link>

            <Link
              to="/settings"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-center"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-gray-600 text-xl">⚙️</span>
              </div>
              <h3 className="font-medium text-gray-900">Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Configure system preferences</p>
            </Link>

            <button
              onClick={loadDashboardData}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-center"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 text-xl">🔄</span>
              </div>
              <h3 className="font-medium text-gray-900">Sync All</h3>
              <p className="text-sm text-gray-500 mt-1">Update all brand data</p>
            </button>

            <button
              onClick={() => toast.info('Support', 'Contact Threads Alliance support team.')}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-center"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">💬</span>
              </div>
              <h3 className="font-medium text-gray-900">Support</h3>
              <p className="text-sm text-gray-500 mt-1">Get help when needed</p>
            </button>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span>Threads Ops v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterDashboard;
