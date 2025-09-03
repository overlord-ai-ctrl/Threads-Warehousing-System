import React from 'react';

interface LoadingScreenProps {
  message?: string;
  showSpinner?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading warehouse management system...',
  showSpinner = true 
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
      <div className="text-center">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg 
              className="w-12 h-12 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4 tracking-tight">
          Threads Ops
        </h1>
        
        {/* Subtitle */}
        <p className="text-xl font-light mb-8 opacity-90">
          Warehouse Management System
        </p>

        {/* Loading Message */}
        <div className="mb-8">
          <p className="text-lg opacity-80">{message}</p>
        </div>

        {/* Loading Spinner */}
        {showSpinner && (
          <div className="flex justify-center">
            <div className="relative">
              {/* Outer ring */}
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              
              {/* Inner ring */}
              <div className="absolute top-2 left-2 w-12 h-12 border-4 border-white/20 border-b-white rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
          </div>
        )}

        {/* Version Info */}
        <div className="mt-12 text-sm opacity-60">
          <p>Version 1.0.0</p>
          <p className="mt-1">Threads Alliance</p>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full"></div>
      </div>
    </div>
  );
};

export default LoadingScreen;
