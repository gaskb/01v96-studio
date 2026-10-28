import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../server/index.js';

describe('Server API & WebSocket Error Paths (P2)', () => {
  const testPort = 19100 + Math.floor(Math.random() * 500);
  let serverInstance: ReturnType<typeof createServer>;

  beforeAll(async () => {
    serverInstance = createServer(testPort);
    await serverInstance.start();
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  it('GET /api/health returns valid status and versions', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.appVersion).toBeDefined();
    expect(body.connectionMode).toBeDefined();
  });

  it('GET /api/state returns current MixerState', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/state`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(32);
    expect(body.auxes).toHaveLength(8);
    expect(body.buses).toHaveLength(8);
  });

  it('POST /api/command accepts valid command and rejects invalid/NaN command', async () => {
    // Valid command
    const validRes = await fetch(`http://localhost:${testPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'set_fader',
        target: 'ch',
        id: 3,
        value: 750,
      }),
    });
    expect(validRes.status).toBe(200);
    expect(await validRes.json()).toEqual({ ok: true });
    expect(serverInstance.mixer.state.channels[2].fader).toBe(750);

    // Invalid command (fader value > 1023)
    const invalidRes = await fetch(`http://localhost:${testPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'set_fader',
        target: 'ch',
        id: 3,
        value: 2000,
      }),
    });
    expect(invalidRes.status).toBe(400);
    const errBody = await invalidRes.json();
    expect(errBody.error).toContain('Validation error');
  });

  it('WebSocket handles full_state, valid commands, validation errors, and malformed JSON', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

    const messages: any[] = [];
    ws.on('message', (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch {
        // Binary meter frame or other non-JSON data
      }
    });

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    // Wait for initial full_state message
    await new Promise((r) => setTimeout(r, 60));
    expect(messages[0]?.type).toBe('full_state');

    // Send valid command over WS
    ws.send(
      JSON.stringify({
        type: 'set_pan',
        target: 'ch',
        id: 2,
        value: 30,
      })
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(serverInstance.mixer.state.channels[1].pan).toBe(30);

    // Send command with validation error (channel 99)
    ws.send(
      JSON.stringify({
        type: 'set_pan',
        target: 'ch',
        id: 99,
        value: 10,
      })
    );
    await new Promise((r) => setTimeout(r, 60));
    const valErrorMsg = messages.find((m) => m.type === 'error' && m.message.includes('Validation error'));
    expect(valErrorMsg).toBeDefined();

    // Send malformed non-JSON string
    ws.send('NOT_A_VALID_JSON{{{');
    await new Promise((r) => setTimeout(r, 60));
    const malformedError = messages.find((m) => m.type === 'error' && m.message.includes('Malformed JSON'));
    expect(malformedError).toBeDefined();

    ws.close();
    await new Promise((r) => setTimeout(r, 60));
  });

  it('broadcasts binary meter frames (98 bytes) over WebSocket', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
    const binaryFrames: Buffer[] = [];

    ws.on('message', (data, isBinary) => {
      if (isBinary && Buffer.isBuffer(data)) {
        binaryFrames.push(data);
      }
    });

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    // Simulate incoming Yamaha meter SysEx packet to mixer controller
    const fakeMeterSysEx = [
      0xf0, 0x43, 0x10, 0x3e, 0x0d, 0x21, 0x00, 0x00, 0x00,
      ...Array(64).fill(0x30),
      0xf7,
    ];
    serverInstance.mixer.handleIncomingMidi(fakeMeterSysEx);

    await new Promise((r) => setTimeout(r, 60));
    expect(binaryFrames.length).toBeGreaterThanOrEqual(1);
    const frame = binaryFrames[0];
    expect(frame.length).toBe(98);
    expect(frame[0]).toBe(0x4d); // 'M' header

    ws.close();
    await new Promise((r) => setTimeout(r, 60));
  });

  it('manages layout storage endpoints (/api/layouts, /api/layouts/preset, DELETE)', async () => {
    // 1. GET initial layouts
    const getRes = await fetch(`http://localhost:${testPort}/api/layouts`);
    expect(getRes.status).toBe(200);
    const initialData = await getRes.json();
    expect(Array.isArray(initialData.presets)).toBe(true);

    // 2. POST active layout
    const postActiveRes = await fetch(`http://localhost:${testPort}/api/layouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeLayout: {
          presetName: 'API Test Rack',
          gridCols: 24,
          gridRows: 4,
          items: [{ id: 'compressor', colSpan: 6, visible: true }],
        },
      }),
    });
    expect(postActiveRes.status).toBe(200);

    // 3. POST new named preset
    const postPresetRes = await fetch(`http://localhost:${testPort}/api/layouts/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset: {
          presetName: 'Studio API Preset',
          gridCols: 24,
          gridRows: 4,
          items: [{ id: 'meter_vu', colSpan: 8, visible: true }],
        },
      }),
    });
    expect(postPresetRes.status).toBe(200);
    const presetBody = await postPresetRes.json();
    expect(presetBody.ok).toBe(true);
    expect(presetBody.presets.some((p: any) => p.presetName === 'Studio API Preset')).toBe(true);

    // 4. DELETE preset
    const delRes = await fetch(
      `http://localhost:${testPort}/api/layouts/preset/${encodeURIComponent('Studio API Preset')}`,
      { method: 'DELETE' }
    );
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.presets.some((p: any) => p.presetName === 'Studio API Preset')).toBe(false);
  });
});
