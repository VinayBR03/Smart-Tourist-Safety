import React, { useEffect, useRef, useState } from "react";
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
import locationService from "../services/locationService";
import LoadingSpinner from "../components/LoadingSpinner";
import { MAP_CONFIG } from "../constants/config";
import { useWebSocket } from "../context/WebSocketContext";

const createPulseIcon = (color) =>
  new L.DivIcon({
    className: "",
    html: `
      <div class="pulse-marker" style="--pulse-color:${color}">
        <div class="pulse-core"></div>
        <div class="pulse-ring"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const createDotIcon = (color) =>
  new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        background:${color};
        border-radius:50%;
        border:2px solid white;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const MapPage = () => {
  const ws = useWebSocket();
  const events = ws.events || [];

  const [incidents, setIncidents] = useState([]);
  const [tourists, setTourists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef(null);

  const loadData = async () => {
    try {
      const [i, t, l] = await Promise.all([
        incidentService.getAllIncidents(),
        touristService.getAllTourists(),
        locationService.getAllCurrentLocations(),
      ]);

      setIncidents(i);
      setTourists(t);
      setLocations(l);
    } catch (err) {
      console.error("Map load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!events.length) return;
    loadData();
  }, [events]);

  if (loading)
    return <LoadingSpinner size="lg" message="Loading map..." />;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <MapContainer
        center={MAP_CONFIG.DEFAULT_CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* INCIDENT MARKERS */}
        {incidents.map((incident) => {
          if (incident.status === "resolved") return null;

          const icon =
            incident.status === "open"
              ? createPulseIcon("#dc2626")
              : createDotIcon("#f97316");

          return (
            <Marker
              key={`incident-${incident.id}`}
              position={[
                incident.latitude,
                incident.longitude,
              ]}
              icon={icon}
            >
              <Popup>
                <strong>Incident #{incident.id}</strong>
                <br />
                {incident.description}
              </Popup>
            </Marker>
          );
        })}

        {/* TOURIST MARKERS */}
        {locations.map((loc) => {
          const tourist = tourists.find(
            (t) => t.id === loc.tourist_id
          );
          if (!tourist) return null;

          let icon;

          if (tourist.activity_status === "active")
            icon = createPulseIcon("#2563eb");
          else if (tourist.activity_status === "delayed")
            icon = createDotIcon("#f59e0b");
          else icon = createDotIcon("#9ca3af");

          return (
            <Marker
              key={`tourist-${tourist.id}`}
              position={[loc.latitude, loc.longitude]}
              icon={icon}
            >
              <Popup>
                <strong>{tourist.full_name}</strong>
                <br />
                Status: {tourist.activity_status}
                <br />
                Updated:{" "}
                {new Date(
                  loc.updated_at
                ).toLocaleString()}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <style>{`
        .pulse-marker {
          position: relative;
          width: 18px;
          height: 18px;
        }
        .pulse-core {
          width: 18px;
          height: 18px;
          background: var(--pulse-color);
          border-radius: 50%;
          border: 2px solid white;
          position: absolute;
          z-index: 2;
        }
        .pulse-ring {
          width: 18px;
          height: 18px;
          background: var(--pulse-color);
          border-radius: 50%;
          position: absolute;
          animation: pulse 1.5s infinite;
          opacity: 0.6;
          z-index: 1;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MapPage;
