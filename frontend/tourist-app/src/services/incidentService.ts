// src/services/incidentService.ts
// Professional incident management service (Backend-aligned)

import apiClient from '../api/client';
import tzlookup from 'tz-lookup';
import {
  Incident,
  CreateIncidentData,
  UpdateIncidentStatus,
  PaginatedResponse,
} from '../types';

class IncidentService {
  /**
   * Create a new incident / SOS alert
   */
  async createIncident(data: CreateIncidentData): Promise<Incident> {
    try {
      const res = await apiClient.post<Incident>('/incidents/', {
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
      });

      return res;
    } catch (error) {
      console.error('Create incident error:', error);
      throw error;
    }
  }

  /**
   * Send SOS alert
   */
  async sendSOS(
    latitude: number,
    longitude: number,
    additionalInfo?: string
  ): Promise<Incident> {
    const description = additionalInfo
      ? `EMERGENCY SOS - ${additionalInfo}`
      : 'EMERGENCY SOS ALERT';

    return this.createIncident({
      description,
      latitude,
      longitude,
    });
  }

  /**
   * ✅ Get incidents for logged-in tourist
   * Backend automatically filters by JWT user
   */
  async getMyIncidents(): Promise<Incident[]> {
    try {
      const res = await apiClient.get<Incident[]>('/incidents/my');
      return res;
    } catch (error) {
      console.error('Get my incidents error:', error);
      throw error;
    }
  }

  /**
   * Get all incidents (authority use)
   */
  async getAllIncidents(
    page: number = 1,
    limit: number = 20
  ): Promise<Incident[]> {
    try {
      const res = await apiClient.get<Incident[]>('/incidents/', {
        params: { page, limit },
      });
      return res;
    } catch (error) {
      console.error('Get incidents error:', error);
      throw error;
    }
  }

  /**
   * Get incident by ID
   */
  async getIncidentById(id: number): Promise<Incident> {
    try {
      const res = await apiClient.get<Incident>(`/incidents/${id}`);
      return res;
    } catch (error) {
      console.error('Get incident by ID error:', error);
      throw error;
    }
  }

  /**
   * Update incident status (authority only)
   */
  async updateIncidentStatus(
    id: number,
    status: UpdateIncidentStatus['status']
  ): Promise<Incident> {
    try {
      const res = await apiClient.patch<Incident>(
        `/incidents/${id}/status`,
        { status }
      );
      return res;
    } catch (error) {
      console.error('Update incident status error:', error);
      throw error;
    }
  }

  /**
   * Get recent incidents (last 24h)
   */
  async getRecentIncidents(): Promise<Incident[]> {
    const incidents = await this.getAllIncidents();
    const since = new Date();
    since.setHours(since.getHours() - 24);

    return incidents.filter(
      (i) => new Date(i.created_at) >= since
    );
  }

  /**
   * Count pending incidents
   */
  async getPendingIncidentsCount(): Promise<number> {
    try {
      const incidents = await this.getAllIncidents();
      return incidents.filter((i) => i.status === 'pending').length;
    } catch {
      return 0;
    }
  }

  /**
   * Helpers
   */
  formatIncidentDate(incident: Incident): string {
  const utcDate = new Date(incident.created_at);
  const timeZone = tzlookup(incident.latitude, incident.longitude);


  return utcDate.toLocaleString('en-US', {
    timeZone: timeZone,
    timeZoneName: 'short',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}


  getStatusColor(status: Incident['status']): string {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'investigating':
        return '#3B82F6';
      case 'resolved':
        return '#10B981';
      default:
        return '#6B7280';
    }
  }

  getStatusText(status: Incident['status']): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'investigating':
        return 'Under Investigation';
      case 'resolved':
        return 'Resolved';
      default:
        return status;
    }
  }
}

// Singleton export
export const incidentService = new IncidentService();
export default incidentService;
