import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useElectron } from '../hooks/useElectron';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const { isElectron, app } = useElectron();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleKioskMode = () => {
    setIsKioskMode(!isKioskMode);
    if (isElectron) {
      // In a real Electron app, this would toggle fullscreen mode
      console.log('Toggling kiosk mode');
    }
  };

  const navigation = [
    { name: 'Master Dashboard', href: '/master', icon: '🏢' },
    { name: 'Brand Dashboard', href: '/brand', icon: '🏪' },
    { name: 'Bench View', href: '/bench', icon: '📦' },
    { name: 'Receiving', href: '/receiving', icon: '📥' },
    { name: 'Returns', href: '/returns', icon: '↩️' },
    { name: 'Cycle Count', href: '/cycle-count', icon: '🔢' },
    { name: 'Exceptions', href: '/exceptions', icon: '⚠️' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    { name: 'Hardware Test', href: '/hardware-test', icon: '🔧' },
  ];

  const isActiveRoute = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href);
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${isKioskMode ? 'kiosk-mode' : ''}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <Link to="/master" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">Threads Ops</h1>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    isActiveRoute(item.href)
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* Kiosk Mode Toggle */}
              {isElectron && (
                <button
                  onClick={toggleKioskMode}
                  className={`p-2 rounded-md text-sm font-medium transition-colors ${
                    isKioskMode
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Toggle Kiosk Mode"
                >
                  {isKioskMode ? '🖥️' : '📱'}
                </button>
              )}

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="hidden md:block">{user?.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    <div className="font-medium">{user?.name}</div>
                    <div className="text-gray-500">{user?.email}</div>
                    <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
                  </div>
                  
                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Settings
                  </Link>
                  
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Toggle */}
      <div className="md:hidden">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 right-4 z-50 p-2 bg-white rounded-md shadow-lg border border-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsSidebarOpen(false)} />
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                      isActiveRoute(item.href)
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Kiosk Mode Banner */}
      {isKioskMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium z-50">
          🖥️ Kiosk Mode Active - Press ESC to exit
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {isKioskMode && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-lg text-xs z-50">
          <div className="font-medium mb-2">Keyboard Shortcuts:</div>
          <div className="space-y-1">
            <div>N - Next Order</div>
            <div>D - Done</div>
            <div>I - Issue</div>
            <div>S - Skip</div>
            <div>P - Reprint</div>
            <div>1-9 - Line Ticks</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
