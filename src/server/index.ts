import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { API_VERSION, APP_VERSION, ClientCommand, UI_VERSION } from '../shared/types.js';
import { validateClientCommand } from '../shared/validators.js';
import { MixerController } from './mixer-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(port = Number(process.env.PORT) || 8096) {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  const broadcast = (payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  };

  const mixer = new MixerController(broadcast);

  wss.on('connection', (ws) => {
    clients.add(ws);
    // Send full initial state immediately upon connection
    ws.send(JSON.stringify({ type: 'full_state', state: mixer.state }));

    ws.on('message', async (raw) => {
      try {
        let json: unknown;
        try {
          json = JSON.parse(raw.toString());
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Malformed JSON payload' }));
          return;
        }

        const validation = validateClientCommand(json);
        if (!validation.success) {
          ws.send(JSON.stringify({ type: 'error', message: `Validation error: ${validation.error}` }));
          return;
        }

        await mixer.handleClientCommand(validation.data);
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Internal error processing command',
          })
        );
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      appVersion: APP_VERSION,
      uiVersion: UI_VERSION,
      apiVersion: API_VERSION,
      connected: mixer.state.connected,
      connectionMode: mixer.state.connectionMode,
      sceneTitle: mixer.state.sceneTitle,
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json(mixer.state);
  });

  app.post('/api/command', async (req, res) => {
    try {
      const validation = validateClientCommand(req.body);
      if (!validation.success) {
        res.status(400).json({ error: `Validation error: ${validation.error}` });
        return;
      }
      await mixer.handleClientCommand(validation.data);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Serve static frontend in production
  const clientDist = path.resolve(__dirname, '../../dist/client');
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Frontend build not found. Run npm run build first.');
      }
    });
  });

  return {
    app,
    server,
    mixer,
    start: () =>
      new Promise<http.Server>((resolve) => {
        mixer.start();
        server.listen(port, '0.0.0.0', () => {
          console.log(`🎚️  Yamaha 01V96 VCM Studio Server running on http://0.0.0.0:${port}`);
          resolve(server);
        });
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        mixer.stop();
        wss.close();
        server.close(() => resolve());
      }),
  };
}

// Start if invoked directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const srv = createServer();
  srv.start();
}
