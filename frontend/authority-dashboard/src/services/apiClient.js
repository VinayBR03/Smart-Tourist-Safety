// src/services/apiClient.js
// Professional API Client with Authentication

import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request Interceptor - Add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('📤 API Request:', config.method.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response Interceptor - Handle errors
    this.client.interceptors.response.use(
      (response) => {
        console.log('📥 API Response:', response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error('❌ Response Error:', error.response?.status, error.config?.url);
        
        // Handle unauthorized
        if (error.response?.status === 401) {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          window.location.href = '/login';
        }

        // Format error message
        const errorMessage = 
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          'An error occurred';

        return Promise.reject(new Error(errorMessage));
      }
    );
  }

  // GET request
  async get(url, config = {}) {
    const response = await this.client.get(url, config);
    return response.data;
  }

  // POST request
  async post(url, data, config = {}) {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  // PUT request
  async put(url, data, config = {}) {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  // PATCH request
  async patch(url, data, config = {}) {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  // DELETE request
  async delete(url, config = {}) {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;