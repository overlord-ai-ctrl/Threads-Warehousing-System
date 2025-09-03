import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useElectron } from './hooks/useElectron';
import { Layout } from './components/Layout';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MasterDashboard } from './pages/MasterDashboard';
import { BrandDashboard } from './pages/BrandDashboard';
import { BenchView } from './pages/BenchView';
import { ReceivingView } from './pages/ReceivingView';
import { ReturnsView } from './pages/ReturnsView';
import { CycleCountView } from './pages/CycleCountView';
import { ExceptionsView } from './pages/ExceptionsView';
import { SettingsView } from './pages/SettingsView';
import { HardwareTest } from './components/HardwareTest';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';
import './App.css';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { isElectron, isReady: electronReady } = useElectron();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for Electron to be ready if running in Electron
        if (isElectron && !electronReady) {
          return;
        }

        // Check if user has completed onboarding
        if (isAuthenticated && user) {
          const onboardingStatus = await checkOnboardingStatus();
          setHasCompletedOnboarding(onboardingStatus);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [isElectron, electronReady, isAuthenticated, user]);

  // Show loading screen while initializing
  if (!isInitialized || authLoading) {
    return <LoadingScreen />;
  }

  // Show onboarding wizard if not completed
  if (isAuthenticated && !hasCompletedOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard onComplete={() => setHasCompletedOnboarding(true)} />
      </ErrorBoundary>
    );
  }

  // Show main app if authenticated and onboarding completed
  if (isAuthenticated && hasCompletedOnboarding) {
    return (
      <ErrorBoundary>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/master" replace />} />
            <Route path="/master" element={<MasterDashboard />} />
            <Route path="/brand/:brandId" element={<BrandDashboard />} />
            <Route path="/brand/:brandId/bench" element={<BenchView />} />
            <Route path="/brand/:brandId/receiving" element={<ReceivingView />} />
            <Route path="/brand/:brandId/returns" element={<ReturnsView />} />
            <Route path="/brand/:brandId/cycle-count" element={<CycleCountView />} />
            <Route path="/exceptions" element={<ExceptionsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/hardware-test" element={<HardwareTest />} />
            <Route path="*" element={<Navigate to="/master" replace />} />
          </Routes>
        </Layout>
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  // Show authentication screen
  return (
    <ErrorBoundary>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Threads Ops</h1>
            <p>Warehouse Management System</p>
          </div>
          <div className="auth-content">
            <p>Please sign in to continue</p>
            {/* Authentication component would go here */}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Helper function to check onboarding status
const checkOnboardingStatus = async (): Promise<boolean> => {
  try {
    // This would check if the user has completed the onboarding process
    // For now, we'll assume they have if they have any brands configured
    // Fallback for browser mode
    return localStorage.getItem('onboarding-completed') === 'true';
  } catch (error) {
    console.error('Failed to check onboarding status:', error);
    return false;
  }
};

export default App;
