import React, { createContext, useContext, useEffect, useState } from 'react';
import authService from '../services/authService';
import { STORAGE_KEYS } from '../constants/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Run once on app load
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (token && userData) {
        setIsAuthenticated(true);
        setUser(JSON.parse(userData));
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.clear();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authService.login(email, password);

    // Authority-only frontend
    const userPayload = {
      email,
      role: 'authority',
    };

    localStorage.setItem(
      STORAGE_KEYS.USER_DATA,
      JSON.stringify(userPayload)
    );

    setUser(userPayload);
    setIsAuthenticated(true);
  };

  const logout = () => {
    authService.logout();
    localStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
