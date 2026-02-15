import React, { useEffect, useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import IncidentCard from "../components/IncidentCard";
import LoadingSpinner from "../components/LoadingSpinner";
import IncidentDetailModal from "../components/IncidentDetailModal";
import incidentService from "../services/incidentService";
import { useWebSocket } from "../context/WebSocketContext";

const IncidentsPage = () => {
  const { notifications } = useWebSocket();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await incidentService.getAllIncidents();
      setIncidents(data);
    } catch (error) {
      console.error("Failed to load incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔴 Live Update Listener
  useEffect(() => {
    if (!notifications.length) return;

    const latest = notifications[0];

    if (latest.message.includes("New Incident")) {
      loadIncidents();
    }

    if (latest.message.includes("Status Updated")) {
      loadIncidents();
    }
  }, [notifications]);

  const filteredIncidents = useMemo(() => {
    let data = [...incidents];

    if (statusFilter !== "all") {
      data = data.filter((i) => i.status === statusFilter);
    }

    if (searchTerm) {
      data = data.filter(
        (i) =>
          i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.id.toString().includes(searchTerm)
      );
    }

    if (sortBy === "newest") {
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (sortBy === "oldest") {
      data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    if (sortBy === "severity") {
      const order = { open: 1, in_progress: 2, resolved: 3 };
      data.sort((a, b) => order[a.status] - order[b.status]);
    }

    return data;
  }, [incidents, searchTerm, statusFilter, sortBy]);

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    in_progress: incidents.filter((i) => i.status === "in_progress").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
  };

  const handleStatusUpdate = async (id, status) => {
    await incidentService.updateStatus(id, status);
    loadIncidents();
    setSelectedIncident(null);
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading incidents..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Incident Command Center
        </h1>

        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="severity">Priority Order</option>
          </select>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} color="gray" />
        <StatCard label="Open" value={stats.open} color="yellow" />
        <StatCard label="In Progress" value={stats.in_progress} color="blue" />
        <StatCard label="Resolved" value={stats.resolved} color="green" />
      </div>

      {/* INCIDENT GRID */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          No incidents found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={setSelectedIncident}
            />
          ))}
        </div>
      )}

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
};

export default IncidentsPage;

/* Mini internal stat card */
const StatCard = ({ label, value, color }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-800",
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
  };

  return (
    <div className={`p-4 rounded-lg shadow ${colors[color]}`}>
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};
