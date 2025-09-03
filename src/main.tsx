import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { App } from './App';
import './index.css';

// Type assertion for Electron API
declare global {
  interface Window {
    electronAPI: any;
  }
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

// Initialize Electron-specific features
if (isElectron) {
  console.log('Initializing Electron features...');
  
  // Set up global error handler for Electron
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Report crash to Electron
      window.electronAPI.app.reportCrash?.();
    }
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
  
  // Prevent page refresh in Electron
  window.addEventListener('beforeunload', (event) => {
    if (isElectron) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

// Export for potential use in other modules
export { queryClient };
