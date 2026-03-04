// src/api/client.ts
// Professional Axios client with interceptors, error handling, and retry logic

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS, ERROR_MESSAGES, HTTP_STATUS } from '../constants/config';
import { ApiError } from '../types';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request Interceptor
    this.client.interceptors.request.use(
      this.handleRequest,
      this.handleRequestError
    );

    // Response Interceptor
    this.client.interceptors.response.use(
      this.handleResponse,
      this.handleResponseError
    );
  }

  /**
   * Handle outgoing requests - Add auth token
   */
  private handleRequest = async (config: AxiosRequestConfig): Promise<any> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request in development
      if (__DEV__) {
        console.log('📤 API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data,
        });
      }

      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  };

  /**
   * Handle request errors
   */
  private handleRequestError = (error: AxiosError): Promise<AxiosError> => {
    if (__DEV__) {
      console.error('❌ Request Error:', error);
    }
    return Promise.reject(error);
  };

  /**
   * Handle successful responses
   */
  private handleResponse = (response: AxiosResponse): AxiosResponse => {
    if (__DEV__) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }
    return response;
  };

  /**
   * Handle response errors with retry logic and token refresh
   */
  private handleResponseError = async (error: AxiosError<ApiError>): Promise<any> => {
    const originalRequest = error.config as any;

    // Network Error
    if (!error.response) {
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }

    const { status, data } = error.response;

    if (__DEV__) {
      console.error('❌ Response Error:', {
        status,
        url: originalRequest?.url,
        message: data?.detail || data?.message,
      });
    }

    // Handle specific status codes
    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        return this.handle401Error(originalRequest);

      case HTTP_STATUS.FORBIDDEN:
        throw new Error(ERROR_MESSAGES.FORBIDDEN);

      case HTTP_STATUS.NOT_FOUND:
        throw new Error(ERROR_MESSAGES.NOT_FOUND);

      case HTTP_STATUS.VALIDATION_ERROR:
        throw this.formatValidationError(data);

      case HTTP_STATUS.SERVER_ERROR:
        throw new Error(ERROR_MESSAGES.SERVER_ERROR);

      default:
        throw this.formatError(error);
    }
  };

  /**
   * Handle 401 Unauthorized - Token refresh logic
   */
  private async handle401Error(originalRequest: any): Promise<any> {
    if (originalRequest._retry) {
      // Already tried to refresh, logout user
      await this.clearAuthData();
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    originalRequest._retry = true;

    if (!this.isRefreshing) {
      this.isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Attempt to refresh token
        const response = await this.client.post('/auth/refresh', {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data;

        // Save new token
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);

        // Notify all waiting requests
        this.onTokenRefreshed(access_token);
        this.refreshSubscribers = [];
        this.isRefreshing = false;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return this.client(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        this.isRefreshing = false;
        this.refreshSubscribers = [];
        await this.clearAuthData();
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      }
    }

    // Queue request while token is being refreshed
    return new Promise((resolve) => {
      this.subscribeToTokenRefresh((token: string) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        resolve(this.client(originalRequest));
      });
    });
  }

  /**
   * Subscribe to token refresh event
   */
  private subscribeToTokenRefresh(callback: (token: string) => void): void {
    this.refreshSubscribers.push(callback);
  }

  /**
   * Notify all subscribers about token refresh
   */
  private onTokenRefreshed(token: string): void {
    this.refreshSubscribers.forEach((callback) => callback(token));
  }

  /**
   * Clear authentication data
   */
  private async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  }

  /**
   * Format validation errors
   */
  private formatValidationError(data: ApiError): Error {
    if (data.errors) {
      const errorMessages = Object.entries(data.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('\n');
      return new Error(errorMessages);
    }
    return new Error(data.detail || data.message || ERROR_MESSAGES.VALIDATION_ERROR);
  }

  /**
   * Format generic errors
   */
  private formatError(error: AxiosError<ApiError>): Error {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      ERROR_MESSAGES.UNKNOWN_ERROR;

    return new Error(message);
  }

  /**
   * Generic GET request
   */
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  public async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Upload file with progress
   */
  public async uploadFile<T = any>(
    url: string,
    formData: FormData,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  }

  /**
   * Get raw axios instance (use with caution)
   */
  public getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;