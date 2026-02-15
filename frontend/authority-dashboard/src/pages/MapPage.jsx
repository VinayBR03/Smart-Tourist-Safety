import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import incidentService from "../services/incidentService";
import touristService from "../services/touristService";
import LoadingSpinner from "../components/LoadingSpinner";
import { MAP_CONFIG } from "../constants/config";
import { useWebSocket } from "../context/WebSocketContext";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default icon issue in Leaflet
const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [10,14],
  shadowSize: [10, 14],
});
L.Marker.prototype.options.icon = defaultIcon;

// ✅ Map controller for flyTo (React 18 safe)
const MapController = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, MAP_CONFIG.INCIDENT_ZOOM, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [position]);

  return null;
};

const MapPage = () => {
  const { notifications } = useWebSocket();

  const [incidents, setIncidents] = useState([]);
  const [tourists, setTourists] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPosition, setSelectedPosition] = useState(null);
  const [incidentSort, setIncidentSort] = useState("newest");
  const [touristFilter, setTouristFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!notifications.length) return;
    loadData();
  }, [notifications]);

  const loadData = async () => {
    const [i, t] = await Promise.all([
      incidentService.getAllIncidents(),
      touristService.getAllTourists(),
    ]);
    setIncidents(i);
    setTourists(t);
    setLoading(false);
  };

  // ------------------------
  // Active tourists = 24hr recent incident
  // ------------------------
  const activeTourists = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    return tourists.filter((t) =>
      incidents.some(
        (i) =>
          i.tourist_id === t.id &&
          new Date(i.created_at) >= cutoff
      )
    );
  }, [tourists, incidents]);

  // ------------------------
  // Incident Sorting
  // ------------------------
  const sortedIncidents = useMemo(() => {
    let data = [...incidents];

    if (incidentSort === "newest") {
      data.sort((a, b) => b.id - a.id);
    }

    if (incidentSort === "oldest") {
      data.sort((a, b) => a.id - b.id);
    }

    if (incidentSort === "open") {
      data.sort((a, b) =>
        a.status === "open" ? -1 : 1
      );
    }

    return data;
  }, [incidents, incidentSort]);

  // ------------------------
  // Tourist Filter
  // ------------------------
  const filteredTourists =
    touristFilter === "active"
      ? activeTourists
      : tourists;

  if (loading)
    return <LoadingSpinner size="lg" message="Loading map..." />;

  return (
    <div className="flex h-[calc(100vh-4rem)]">

      {/* SIDEBAR */}
      <div className="w-96 bg-white shadow-lg overflow-y-auto p-6 space-y-8">

        <h2 className="text-xl font-bold">
          Operational Intelligence Map
        </h2>

        {/* INCIDENT SECTION */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Incidents</h3>
            <select
              value={incidentSort}
              onChange={(e) => setIncidentSort(e.target.value)}
              className="text-sm px-2 py-1 border rounded"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="open">Open First</option>
            </select>
          </div>

          <div className="space-y-3">
            {sortedIncidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() =>
                  setSelectedPosition([
                    incident.latitude,
                    incident.longitude,
                  ])
                }
                className="p-4 bg-gray-50 rounded-xl shadow-sm hover:shadow-md cursor-pointer border-l-4 border-red-500 transition"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    #{incident.id}
                  </span>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                    {incident.status}
                  </span>
                </div>

                <p className="text-sm mt-2 text-gray-700 line-clamp-2">
                  {incident.description}
                </p>

                <div className="text-xs text-gray-400 mt-2">
                  {incident.latitude.toFixed(4)},{" "}
                  {incident.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOURIST SECTION */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Tourists</h3>
            <select
              value={touristFilter}
              onChange={(e) => setTouristFilter(e.target.value)}
              className="text-sm px-2 py-1 border rounded"
            >
              <option value="all">All</option>
              <option value="active">Active (24h)</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredTourists.map((tourist) => {
              const latestIncident = incidents
                .filter((i) => i.tourist_id === tourist.id)
                .sort(
                  (a, b) =>
                    new Date(b.created_at) -
                    new Date(a.created_at)
                )[0];

              if (!latestIncident) return null;

              return (
                <div
                  key={tourist.id}
                  onClick={() =>
                    setSelectedPosition([
                      latestIncident.latitude,
                      latestIncident.longitude,
                    ])
                  }
                  className="p-4 bg-blue-50 rounded-xl shadow-sm hover:shadow-md cursor-pointer border-l-4 border-blue-500 transition"
                >
                  <div className="font-semibold">
                    {tourist.full_name || "Unnamed"}
                  </div>

                  <div className="text-xs text-gray-500">
                    {tourist.email}
                  </div>

                  <div className="text-xs text-gray-400 mt-2">
                    Last Seen:{" "}
                    {latestIncident.latitude.toFixed(4)},{" "}
                    {latestIncident.longitude.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1">
        <MapContainer
          center={selectedPosition || MAP_CONFIG.DEFAULT_CENTER}
          zoom={MAP_CONFIG.DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
        >
          <MapController position={selectedPosition} />

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[
                incident.latitude,
                incident.longitude,
              ]}
            >
              <Popup>
                <strong>Incident #{incident.id}</strong>
                <br />
                {incident.description}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapPage;
