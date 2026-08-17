/**
 * Full-Stack Server Entry Point
 * Hosts Express REST APIs, Vite Development Middleware, and WebSocket Engine on Port 3000.
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { networkInterfaces } from 'node:os';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { setupWebSocketServer } from './server/wsHandler';
import { roomManager } from './server/roomManager';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'AudioFit Hexagonal Ear Training Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/rooms', (req, res) => {
    res.json(roomManager.getActiveRoomsList());
  });

  app.get('/api/specs', (req, res) => {
    res.json({
      architecture: 'Hexagonal (Ports and Adapters)',
      domain: {
        entities: ['Frequency', 'ExerciseRound', 'DifficultyProfile', 'TrainingSession', 'MultiplayerRoom'],
        services: ['DeviationCalculator', 'AdaptiveDifficultyEngine', 'ProgressReportGenerator']
      },
      ports: {
        inbound: ['ITrainingUseCase', 'IMultiplayerUseCase', 'IAudioPlaybackUseCase'],
        outbound: ['IAudioSynthesizerPort', 'IStoragePort', 'IRealtimeNetworkPort']
      },
      adapters: {
        primary: ['React UI Controllers', 'WebSocket Client Hook'],
        secondary: ['WebAudioSynthesizerAdapter', 'LocalStorageAdapter', 'WebSocketServerAdapter']
      }
    });
  });

  // Attach WebSocket Server
  setupWebSocketServer(server);

  // Vite middleware or Production Static Serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const localNetworkUrls = Object.values(networkInterfaces())
      .flat()
      .filter((networkInterface) =>
        networkInterface &&
        networkInterface.family === 'IPv4' &&
        !networkInterface.internal
      )
      .map((networkInterface) => `http://${networkInterface.address}:${PORT}`);

    console.log(`AudioFit Hexagonal Server running on http://localhost:${PORT}`);
    console.log(`Local network: ${localNetworkUrls.join(', ') || 'No IPv4 address found'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
