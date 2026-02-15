import React, { useEffect, useMemo, useState } from "react";
import touristService from "../services/touristService";
import incidentService from "../services/incidentService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useWebSocket } from "../context/WebSocketContext";

const TouristsPage = () => {
  const { notifications } = useWebSocket();

  const [tourists, setTourists] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [t, i] = await Promise.all([
      touristService.getAllTourists(),
      incidentService.getAllIncidents(),
    ]);
    setTourists(t);
    setIncidents(i);
    setLoading(false);
  };

  useEffect(() => {
    if (!notifications.length) return;
    loadData();
  }, [notifications]);

  const activeTourists = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMilliseconds(cutoff.getMilliseconds() - 1 * 60 * 1000); // 1 minute ago

    return tourists.filter((t) =>
      incidents.some(
        (i) =>
          i.tourist_id === t.id &&
          new Date(i.created_at) >= cutoff
      )
    );
  }, [tourists, incidents]);

  const filtered = useMemo(() => {
    let data = [...tourists];

    if (search) {
      data = data.filter(
        (t) =>
          t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          t.email.toLowerCase().includes(search.toLowerCase()) ||
          t.phone?.includes(search)
      );
    }

    if (sortBy === "name") {
      data.sort((a, b) =>
        (a.full_name || "").localeCompare(b.full_name || "")
      );
    }

    if (sortBy === "newest") {
      data.sort((a, b) => b.id - a.id);
    }

    return data;
  }, [tourists, search, sortBy]);

  if (loading)
    return <LoadingSpinner size="lg" message="Loading tourists..." />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tourist Intelligence Panel</h1>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Tourists" value={tourists.length} />
        <StatCard label="Active (1m)" value={activeTourists.length} />
        <StatCard
          label="With Emergency Contact"
          value={tourists.filter((t) => t.emergency_contact).length}
        />
      </div>

      {/* SEARCH + SORT */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <input
          type="text"
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Newest First</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* TOURIST CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((tourist) => {
          const isActive = activeTourists.some(
            (t) => t.id === tourist.id
          );

          return (
            <div
              key={tourist.id}
              className={`bg-white rounded-xl shadow-md p-5 border ${
                isActive ? "border-green-400" : "border-gray-200"
              } hover:shadow-xl transition`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">
                  {tourist.full_name || "Unnamed Tourist"}
                </h3>
                {isActive && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    Active
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">
                {tourist.email}
              </p>

              {tourist.phone && (
                <p className="text-sm">📞 {tourist.phone}</p>
              )}

              {tourist.emergency_contact && (
                <p className="text-sm text-red-600">
                  🚨 Emergency: {tourist.emergency_contact}
                </p>
              )}

              <div className="mt-3 text-xs text-gray-400">
                ID: #{tourist.id}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export default TouristsPage;
