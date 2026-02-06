// src/services/authService.ts
// Professional authentication service with complete error handling

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { STORAGE_KEYS } from '../constants/config';
import {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
  TouristProfile,
} from '../types';

class AuthService {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Call login endpoint
      const response = await apiClient.post<AuthTokens>('/login', credentials);

      // Store tokens
      await this.storeTokens(response);

      // Fetch user profile
      const user = await this.getProfile();

      return { user, tokens: response };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<User> {
    try {
      const response = await apiClient.post<User>('/register', {
        email: data.email,
        password: data.password,
        role: data.role || 'tourist',
      });

      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Optional: Call logout endpoint to invalidate token on server
      // await apiClient.post('/logout');

      // Clear local storage
      await this.clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local data even if API call fails
      await this.clearAuthData();
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    try {
      const profile = await apiClient.get<TouristProfile>('/tourists/me');
      
      // Store user data locally
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));

      return profile as User;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileData): Promise<User> {
    try {
      const updatedProfile = await apiClient.put<TouristProfile>('/tourists/me', data);

      // Update local storage
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedProfile));

      return updatedProfile as User;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      return token !== null;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  /**
   * Get stored user data
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Get stored user error:', error);
      return null;
    }
  }

  /**
   * Get stored token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

  /**
   * Store authentication tokens
   */
  private async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
      
      // Store refresh token if provided
      // if (tokens.refresh_token) {
      //   await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
      // }
    } catch (error) {
      console.error('Store tokens error:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Clear all authentication data
   */
  private async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);
    } catch (error) {
      console.error('Clear auth data error:', error);
    }
  }

  /**
   * Change password (if supported by backend)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Request password reset (if supported by backend)
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Verify email (if supported by backend)
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      await apiClient.post('/auth/verify-email', { token });
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;