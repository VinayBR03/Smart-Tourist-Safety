import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_CONFIG, STORAGE_KEYS } from "../constants/config";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const socketRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    const wsUrl = `${API_CONFIG.WS_URL}?token=${token}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Connected");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setNotifications((prev) => [data, ...prev]);
      } catch (err) {
        console.error("Invalid WS message", err);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket Disconnected");
      setConnected(false);
    };

    socket.onerror = (err) => {
      console.error("WebSocket Error", err);
    };

    return () => {
      socket.close();
    };
  }, []);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <WebSocketContext.Provider
      value={{
        notifications,
        connected,
        clearNotifications,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};
