// src/services/authService.js
// Authentication Service

import apiClient from './apiClient';
import { STORAGE_KEYS } from '../constants/config';

class AuthService {
  async login(email, password) {
    const data = await apiClient.post('/login', { email, password });
    
    // Store token
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    
    return data;
  }

  async logout() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  isAuthenticated() {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
}

export const authService = new AuthService();
export default authService;