// src/services/incidentService.js - FIXED VERSION

import apiClient from './apiClient';

class IncidentService {
  // Get all incidents
  async getAllIncidents() {
    return await apiClient.get('/incidents/');
  }

  // Get incident by ID
  async getIncidentById(id) {
    return await apiClient.get(`/incidents/${id}`);
  }

  // ✅ FIXED: Update incident status with correct backend values
  async updateStatus(id, status) {
    // Ensure status is one of: open, in_progress, resolved
    const validStatuses = ['open', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    return await apiClient.patch(`/incidents/${id}/status`, { status });
  }

  // ✅ FIXED: Get incidents by status (using backend values)
  getIncidentsByStatus(incidents, status) {
    return incidents.filter(incident => incident.status === status);
  }

  // Get incident statistics
  getStatistics(incidents) {
    return {
      total: incidents.length,
      open: this.getIncidentsByStatus(incidents, 'open').length,
      in_progress: this.getIncidentsByStatus(incidents, 'in_progress').length,
      resolved: this.getIncidentsByStatus(incidents, 'resolved').length,
    };
  }

  // Get recent incidents (last 24 hours)
  getRecentIncidents(incidents, hours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    return incidents.filter(incident => {
      const incidentTime = new Date(incident.created_at);
      return incidentTime >= cutoffTime;
    });
  }
}

export const incidentService = new IncidentService();
export default incidentService;