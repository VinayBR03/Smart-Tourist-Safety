// src/services/locationService.js

import apiClient from "./apiClient";

class LocationService {
  // Authority: get all current snapshot locations
  async getAllCurrentLocations() {
    return await apiClient.get("/location/current");
  }

  // Authority: get single tourist current location
  async getTouristCurrentLocation(touristId) {
    return await apiClient.get(`/location/current/${touristId}`);
  }

  // Authority: get tourist history
  async getTouristLocationHistory(touristId) {
    return await apiClient.get(`/location/history/${touristId}`);
  }

  // Utility: distance calculation (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatCoordinates(lat, lng) {
    return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
  }
}

export default new LocationService();
