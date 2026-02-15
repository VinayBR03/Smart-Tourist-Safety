// src/services/websocketService.js

class WebSocketService {
  constructor() {
    this.socket = null;
  }

  connect(onMessage) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    const wsUrl = baseUrl.replace("http", "ws") + "/ws/dashboard";

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connected");
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    this.socket.onclose = () => {
      console.log("WebSocket disconnected");
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
