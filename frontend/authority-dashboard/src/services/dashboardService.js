// src/services/dashboardService.js

import incidentService from './incidentService';
import touristService from './touristService';

class DashboardService {
  async getDashboardData() {
    const [incidents, tourists] = await Promise.all([
      incidentService.getAllIncidents(),
      touristService.getAllTourists(),
    ]);

    return {
      incidents,
      tourists,
      statistics: this.calculateStatistics(incidents, tourists),
    };
  }

  calculateStatistics(incidents, tourists) {
    const incidentStats = incidentService.getStatistics(incidents);
    const touristStats = touristService.getStatistics(tourists);

    return {
      incidents: incidentStats,
      tourists: touristStats,
      resolvedToday: this.getResolvedToday(incidents),
    };
  }

  getResolvedToday(incidents) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return incidents.filter(i => {
      if (i.status !== 'resolved') return false;
      return new Date(i.updated_at || i.created_at) >= today;
    }).length;
  }

  /**
   * Trend calculation
   * mode: 'daily' | 'cumulative'
   */
  getTrendData(incidents, startDate, endDate, mode) {
    const result = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let cumulative = {
      open: 0,
      in_progress: 0,
      resolved: 0,
    };

    while (cursor <= end) {
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayIncidents = incidents.filter(i => {
        const d = new Date(i.created_at);
        return d >= cursor && d < nextDay;
      });

      const daily = {
        open: dayIncidents.filter(i => i.status === 'open').length,
        in_progress: dayIncidents.filter(i => i.status === 'in_progress').length,
        resolved: dayIncidents.filter(i => i.status === 'resolved').length,
      };

      if (mode === 'cumulative') {
        cumulative.open += daily.open;
        cumulative.in_progress += daily.in_progress;
        cumulative.resolved += daily.resolved;
      }

      result.push({
        date: cursor.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        open: mode === 'daily' ? daily.open : cumulative.open,
        in_progress: mode === 'daily' ? daily.in_progress : cumulative.in_progress,
        resolved: mode === 'daily' ? daily.resolved : cumulative.resolved,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
