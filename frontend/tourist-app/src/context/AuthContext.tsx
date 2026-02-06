// src/context/AuthContext.tsx
// Professional Authentication Context with complete state management

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import {
  User,
  AuthContextType,
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
} from '../types';
import { SUCCESS_MESSAGES } from '../constants/config';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Check if user is already authenticated
   */
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      const authenticated = await authService.isAuthenticated();
      
      if (authenticated) {
        // Load user data from storage
        const storedUser = await authService.getStoredUser();
        
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          // Token exists but no user data, fetch from server
          try {
            const fetchedUser = await authService.getProfile();
            setUser(fetchedUser);
            setIsAuthenticated(true);
          } catch (error) {
            // Token invalid, logout
            await authService.logout();
            setIsAuthenticated(false);
          }
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login user
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { user: loggedInUser } = await authService.login(credentials);
      
      setUser(loggedInUser);
      setIsAuthenticated(true);
      
      console.log(SUCCESS_MESSAGES.LOGIN_SUCCESS);
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.register(data);
      
      console.log(SUCCESS_MESSAGES.REGISTER_SUCCESS);
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.logout();
      
      setUser(null);
      setIsAuthenticated(false);
    } catch (err: any) {
      console.error('Logout error:', err);
      // Still clear local state even if API call fails
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (data: UpdateProfileData): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedUser = await authService.updateProfile(data);
      
      setUser(updatedUser);
      
      console.log(SUCCESS_MESSAGES.PROFILE_UPDATE_SUCCESS);
    } catch (err: any) {
      const errorMessage = err.message || 'Profile update failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh user data from server
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const refreshedUser = await authService.getProfile();
      setUser(refreshedUser);
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use Auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
};

export default AuthContext;