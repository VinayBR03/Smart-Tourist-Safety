import React, { useEffect, useMemo, useState } from "react";
import touristService from "../services/touristService";
import locationService from "../services/locationService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useWebSocket } from "../context/WebSocketContext";

const TouristsPage = () => {
  const { events = []} = useWebSocket();

  const [tourists, setTourists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        touristService.getAllTourists(),
        locationService.getAllCurrentLocations(),
      ]);

      setTourists(t);
      setLocations(l);
    } catch (err) {
      console.error("Tourist load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!events.length) return;
    loadData();
  }, [events]);

  const stats = touristService.getStatistics(tourists);

  const filtered = useMemo(() => {
    let data = [...tourists];

    if (search) {
      data = data.filter(
        (t) =>
          t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          t.email?.toLowerCase().includes(search.toLowerCase())
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

    if (sortBy === "activity") {
      const statusOrder = { active: 1, delayed: 2, offline: 3 };
      data.sort((a, b) => {
        const statusA = statusOrder[a.activity_status] || 99;
        const statusB = statusOrder[b.activity_status] || 99;
        return statusA - statusB;
      });
    }


    return data;
  }, [tourists, search, sortBy]);

  if (loading)
    return <LoadingSpinner size="lg" message="Loading tourists..." />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Tourist Intelligence Panel
      </h1>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Delayed" value={stats.delayed} />
        <StatCard label="Offline" value={stats.offline} />
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search tourist..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* SORT */}
      <div className="flex space-x-2 mt-2">
        <span className="text-sm text-gray-600">Sort by:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-1 border rounded-lg text-sm"
        >
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="activity">Activity Status</option>
        </select>
      </div>

      {/* TOURIST CARDS */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((tourist) => {
          const location = locations.find(
            (l) => l.tourist_id === tourist.id
          );

          return (
            <div
              key={tourist.id}
              className="bg-white p-5 rounded-xl shadow border"
            >
              <div className="flex justify-between">
                <h3 className="font-semibold">
                  {tourist.full_name}
                </h3>
                <StatusBadge status={tourist.activity_status} />
              </div>

              <p className="text-sm text-gray-500 mt-2">
                {tourist.email}
              </p>

              {location && (
                <div className="mt-3 text-xs text-gray-500">
                  <div>
                    Lat: {location.latitude.toFixed(4)}
                  </div>
                  <div>
                    Lng: {location.longitude.toFixed(4)}
                  </div>
                  <div>
                    Updated:{" "}
                    {new Date(
                      location.updated_at
                    ).toLocaleString()}
                  </div>
                </div>
              )}
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

const StatusBadge = ({ status }) => {
  const style =
    status === "active"
      ? "bg-green-100 text-green-700"
      : status === "delayed"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-200 text-gray-600";

  return (
    <span className={`text-xs px-2 py-1 rounded ${style}`}>
      {status}
    </span>
  );
};

export default TouristsPage;
