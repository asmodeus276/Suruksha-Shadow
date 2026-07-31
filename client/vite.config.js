import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0, not just localhost — needed for phone/tunnel access
    allowedHosts: ['.devtunnels.ms'], // Vite blocks unrecognized Host headers by default
  },
})