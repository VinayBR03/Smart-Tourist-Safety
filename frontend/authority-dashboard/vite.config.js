import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses, including LAN and public IPs
    port: 5173, // You can specify a port if needed
    allowedHosts: ['unwhisked-lorine-uncomplaining.ngrok-free.dev'], // Allow requests from ngrok domains
  },
})
