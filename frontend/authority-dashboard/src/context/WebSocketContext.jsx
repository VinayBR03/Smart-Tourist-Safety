import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import useSound from "../hooks/useSound";
import alertSound from "../assets/alert.mp3";

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const playSound = useSound(alertSound);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const connect = () => {
    if (socketRef.current) return;

    const ws = new WebSocket("ws://localhost:8000/ws/dashboard");

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "incident_created") {
        addNotification("New Incident Reported");
        playSound();
      }

      if (data.type === "incident_updated") {
        addNotification("Incident Status Updated");
      }

      if (data.type === "tourist_created") {
        addNotification("New Tourist Registered");
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      socketRef.current = null;
      setTimeout(connect, 3000); // auto reconnect
    };

    ws.onerror = () => {
      ws.close();
    };

    socketRef.current = ws;
  };

  const disconnect = () => {
    socketRef.current?.close();
  };

  const addNotification = (message) => {
    setNotifications((prev) => [
      { id: Date.now(), message },
      ...prev,
    ]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <WebSocketContext.Provider
      value={{
        notifications,
        clearNotifications,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
