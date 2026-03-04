// src/services/touristService.js

import apiClient from "./apiClient";

class TouristService {
  async getAllTourists() {
    return await apiClient.get("/tourists/");
  }

  async getTouristById(id) {
    return await apiClient.get(`/tourists/${id}`);
  }

  getStatistics(tourists = []) {
    const active = tourists.filter(
      (t) => t.activity_status === "active"
    ).length;

    const delayed = tourists.filter(
      (t) => t.activity_status === "delayed"
    ).length;

    const offline = tourists.filter(
      (t) => t.activity_status === "offline"
    ).length;

    return {
      total: tourists.length,
      active,
      delayed,
      offline,
    };
  }
}

export default new TouristService();
