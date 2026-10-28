import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { API_VERSION, APP_VERSION, ClientCommand, UI_VERSION } from '../shared/types.js';
import { validateClientCommand, validateRestoreRequest } from '../shared/validators.js';
import { LayoutStorage } from './layout-storage.js';
import { MixerController } from './mixer-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(port = Number(process.env.PORT) || 8096, customLayoutStoragePath?: string) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  const broadcast = (payload: unknown) => {
    if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload, { binary: true });
        }
      }
      return;
    }

    const data = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  };

  const mixer = new MixerController(broadcast);
  const layoutStorage = new LayoutStorage(customLayoutStoragePath);

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

  // Modular Layout Storage API (Decoupled from mixer scenes, persists to data/layouts.json)
  app.get('/api/layouts', (_req, res) => {
    res.json(layoutStorage.getAll());
  });

  app.post('/api/layouts', (req, res) => {
    try {
      const { activeLayout } = req.body;
      if (activeLayout) {
        layoutStorage.setActiveLayout(activeLayout);
      }
      res.json({ ok: true, data: layoutStorage.getAll() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/layouts/preset', (req, res) => {
    try {
      const preset = req.body?.preset || req.body;
      if (!preset || !preset.items || !Array.isArray(preset.items)) {
        res.status(400).json({ error: 'Invalid preset object' });
        return;
      }
      const updatedPresets = layoutStorage.savePreset(preset);
      res.json({ ok: true, presets: updatedPresets });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/layouts/preset/:name', (req, res) => {
    try {
      const name = req.params.name;
      if (!name) {
        res.status(400).json({ error: 'Missing preset name' });
        return;
      }
      const updatedPresets = layoutStorage.deletePreset(name);
      res.json({ ok: true, presets: updatedPresets });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Scene & Backup Management APIs
  app.get('/api/scenes', (_req, res) => {
    res.json(mixer.getSceneList());
  });

  app.get('/api/backup', (req, res) => {
    try {
      const scenesParam = req.query.scenes as string | undefined;
      const includeGlobalParam = req.query.includeGlobal as string | undefined;
      const downloadParam = req.query.download as string | undefined;
      const nameParam = req.query.name as string | undefined;

      let sceneNumbers: number[] | undefined;
      if (scenesParam && scenesParam !== 'all') {
        sceneNumbers = scenesParam
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n >= 0 && n <= 99);
      }

      const includeGlobal = includeGlobalParam !== 'false';
      const pkg = mixer.exportBackup(sceneNumbers, includeGlobal, {
        name: nameParam || `01V96 Studio Backup - ${new Date().toISOString().slice(0, 10)}`,
        description: `Export of ${sceneNumbers ? sceneNumbers.length : 'all'} scene(s)`,
      });

      if (pkg.global && includeGlobal) {
        pkg.global.layouts = layoutStorage.getAll();
      }

      if (downloadParam === 'true') {
        const filename = `01v96_backup_${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
      }

      res.json(pkg);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/backup/restore', async (req, res) => {
    try {
      const validation = validateRestoreRequest(req.body);
      if (!validation.success) {
        res.status(400).json({ error: `Validation error: ${validation.error}` });
        return;
      }
      const result = await mixer.restoreBackup(validation.data, layoutStorage);
      res.json(result);
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
    layoutStorage,
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

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    try {
      await srv.stop();
      console.log('✅ Yamaha 01V96 Studio Server stopped cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
