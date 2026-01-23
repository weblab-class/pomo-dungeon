import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { registerApiMiddleware } from './server/api.js';
import { setupSocketServer } from './server/socket.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mongoUri = env.MONGODB_URI;

  return {
    plugins: [
      react(),
      {
        name: 'mongo-api',
        configureServer(server) {
          registerApiMiddleware(server, { mongoUri });
          
          // Set up Socket.IO server
          server.httpServer?.once('listening', () => {
            setupSocketServer(server.httpServer);
            console.log('✅ Socket.IO server initialized');
          });
        },
      },
    ],
  };
});
