import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Users,
  Clock,
  CheckCircle,
  CalendarCheck,
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import dashboardService from '../services/dashboardService';

const RANGE_DAYS = {
  week: 7,
  month: 30,
  year: 365,
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [trendData, setTrendData] = useState([]);

  const [mode, setMode] = useState('daily'); // daily | cumulative
  const [range, setRange] = useState('week'); // week | month | year | custom
  const [customRange, setCustomRange] = useState({
    from: '',
    to: '',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!data) return;
    rebuildTrend();
  }, [mode, range, customRange]);

  const loadDashboard = async () => {
    setLoading(true);
    const dashboardData = await dashboardService.getDashboardData();
    setData(dashboardData);
    setLoading(false);

    // build initial trend
    const { start, end } = calculateDateRange();
    setTrendData(
      dashboardService.getTrendData(
        dashboardData.incidents,
        start,
        end,
        mode
      )
    );
  };

  const calculateDateRange = () => {
    const end = new Date();
    const start = new Date();

    if (range === 'custom' && customRange.from && customRange.to) {
      return {
        start: new Date(customRange.from),
        end: new Date(customRange.to),
      };
    }

    start.setDate(start.getDate() - RANGE_DAYS[range] + 1);
    return { start, end };
  };

  const rebuildTrend = () => {
    const { start, end } = calculateDateRange();
    setTrendData(
      dashboardService.getTrendData(
        data.incidents,
        start,
        end,
        mode
      )
    );
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading dashboard..." />;
  }

  const stats = data.statistics;

  return (
    <div className="p-6 space-y-6">
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Tourists" value={stats.tourists.total} icon={<Users size={20} />} />
        <StatCard title="Open" value={stats.incidents.open} icon={<AlertTriangle size={20} />} color="red" />
        <StatCard title="In Progress" value={stats.incidents.in_progress} icon={<Clock size={20} />} color="yellow" />
        <StatCard title="Resolved Today" value={stats.resolvedToday} icon={<CalendarCheck size={20} />} />
        <StatCard title="Resolved" value={stats.incidents.resolved} icon={<CheckCircle size={20} />} />
      </div>

      {/* CONTROLS */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-center">
        {/* Mode */}
        <div className="flex gap-2">
          {['daily', 'cumulative'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Range */}
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                range === r
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setRange('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              range === 'custom'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            CUSTOM
          </button>
        </div>

        {/* Custom date pickers */}
        {range === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customRange.from}
              onChange={e =>
                setCustomRange(r => ({ ...r, from: e.target.value }))
              }
              className="border px-3 py-2 rounded-lg"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customRange.to}
              onChange={e =>
                setCustomRange(r => ({ ...r, to: e.target.value }))
              }
              className="border px-3 py-2 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Incident Trends
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line dataKey="open" stroke="#F59E0B" strokeWidth={2} />
            <Line dataKey="in_progress" stroke="#2563EB" strokeWidth={2} />
            <Line dataKey="resolved" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardPage;
