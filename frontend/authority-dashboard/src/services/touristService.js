// src/services/touristService.js
// Tourist Management Service

import apiClient from './apiClient';

class TouristService {
  // Get all tourists
  async getAllTourists() {
    return await apiClient.get('/tourists/');
  }

  // Get tourist by ID
  async getTouristById(id) {
    return await apiClient.get(`/tourists/${id}`);
  }

  // Get tourist statistics
  getStatistics(tourists) {
    return {
      total: tourists.length,
      active: tourists.filter(t => t.phone || t.full_name).length,
      withEmergencyContact: tourists.filter(t => t.emergency_contact).length,
    };
  }
}

export const touristService = new TouristService();
export default touristService;