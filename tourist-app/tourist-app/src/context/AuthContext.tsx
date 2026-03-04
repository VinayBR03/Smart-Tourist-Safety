// src/context/AuthContext.tsx

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

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);

      const authenticated = await authService.isAuthenticated();

      if (authenticated) {
        const storedUser = await authService.getStoredUser();

        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          try {
            const fetchedUser = await authService.getProfile();
            setUser(fetchedUser);
            setIsAuthenticated(true);
          } catch {
            await authService.logout();
            setIsAuthenticated(false);
            setUser(null);
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

  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.logout();

      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const clearError = useCallback(() => {
    setError(null);
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

export default AuthContext;
