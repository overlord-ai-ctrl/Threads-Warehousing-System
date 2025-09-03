import { useState, useEffect, useCallback } from 'react';
import { useElectron } from './useElectron';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'lead' | 'admin';
  brandId?: string;
  shopDomain?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export const useAuth = () => {
  const { isElectron } = useElectron();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [isElectron]);

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      if (isElectron) {
        // Check for stored authentication in Electron
        const token = localStorage.getItem('supabase_token');
        if (token) {
          // Validate token and get user info
          const user = await validateToken(token);
          if (user) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user,
              error: null,
            });
            return;
          }
        }
      } else {
        // Browser mode - check localStorage
        const token = localStorage.getItem('supabase_token');
        if (token) {
          const user = await validateToken(token);
          if (user) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user,
              error: null,
            });
            return;
          }
        }
      }

      // No valid authentication found
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error instanceof Error ? error.message : 'Authentication check failed',
      });
    }
  }, [isElectron]);

  const validateToken = async (token: string): Promise<User | null> => {
    try {
      // In a real app, this would validate the token with Supabase
      // For now, we'll simulate token validation
      
      // Decode token (in real app, verify with Supabase)
      const decoded = decodeToken(token);
      if (!decoded) return null;

      // Check if token is expired
      if (decoded.exp && Date.now() > decoded.exp * 1000) {
        return null;
      }

      // Return user info
      return {
        id: decoded.sub || 'user_123',
        email: decoded.email || 'user@example.com',
        name: decoded.name || 'User',
        role: decoded.role || 'operator',
        brandId: decoded.brandId,
        shopDomain: decoded.shopDomain,
        createdAt: new Date(decoded.iat * 1000),
        lastLoginAt: new Date(),
      };
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  };

  const decodeToken = (token: string): any => {
    try {
      // Simple token decoding (in real app, use proper JWT library)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Token decode failed:', error);
      return null;
    }
  };

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // In a real app, this would authenticate with Supabase
      // For now, we'll simulate authentication
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock authentication response
      const mockToken = generateMockToken(email);
      const user: User = {
        id: 'user_123',
        email,
        name: email.split('@')[0],
        role: 'operator',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      // Store token
      localStorage.setItem('supabase_token', mockToken);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return false;
    }
  }, [isElectron]);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // In a real app, this would create an account with Supabase
      // For now, we'll simulate account creation
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock account creation response
      const mockToken = generateMockToken(email);
      const user: User = {
        id: 'user_' + Date.now(),
        email,
        name,
        role: 'operator',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      // Store token
      localStorage.setItem('supabase_token', mockToken);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return false;
    }
  }, [isElectron]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Clear stored tokens
      localStorage.removeItem('supabase_token');

      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, [isElectron]);

  const updateUser = useCallback((updates: Partial<User>): void => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  }, []);

  const clearError = useCallback((): void => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Generate mock token for development
  const generateMockToken = (email: string): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: 'user_123',
      email,
      name: email.split('@')[0],
      role: 'operator',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    }));
    const signature = 'mock_signature';
    
    return `${header}.${payload}.${signature}`;
  };

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    updateUser,
    clearError,
    checkAuthStatus,
  };
};
