import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../server/index.js';
import { MixerBackupPackage, RestoreRequest } from '../shared/types.js';
import { validateRestoreRequest } from '../shared/validators.js';

describe('Backup & Restore System (Show Packages)', () => {
  const tmpDir = path.join(os.tmpdir(), `01v96-backup-test-${Date.now()}`);
  const layoutPath = path.join(tmpDir, 'layouts.json');
  const testPort = 19700 + Math.floor(Math.random() * 200);
  let serverInstance: ReturnType<typeof createServer>;

  beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    serverInstance = createServer(testPort, layoutPath);
    await serverInstance.start();
  });

  afterAll(async () => {
    await serverInstance.stop();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('GET /api/scenes returns valid scene list including active scene', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/scenes`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const current = body.find((s: { isCurrent: boolean }) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current.sceneNumber).toBe(serverInstance.mixer.state.sceneNumber);
  });

  it('GET /api/backup exports a complete valid MixerBackupPackage', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/backup`);
    expect(res.status).toBe(200);
    const pkg: MixerBackupPackage = await res.json();
    expect(pkg.format).toBe('01v96-studio-backup');
    expect(pkg.version).toBe('1.0');
    expect(pkg.scenes).toBeDefined();
    expect(pkg.scenes[String(serverInstance.mixer.state.sceneNumber)]).toBeDefined();
    expect(pkg.global).toBeDefined();
  });

  it('GET /api/backup supports selective scene filtering and excludeGlobal flag', async () => {
    const activeSc = serverInstance.mixer.state.sceneNumber;
    const res = await fetch(
      `http://localhost:${testPort}/api/backup?scenes=${activeSc}&includeGlobal=false`
    );
    expect(res.status).toBe(200);
    const pkg: MixerBackupPackage = await res.json();
    expect(pkg.scenes[String(activeSc)]).toBeDefined();
    expect(pkg.global).toBeUndefined();
    expect(Object.keys(pkg.scenes)).toHaveLength(1);
  });

  it('POST /api/backup/restore validates and applies a valid restore plan with remapping', async () => {
    // 1. Export current scene as source
    const exportRes = await fetch(`http://localhost:${testPort}/api/backup`);
    const originalPkg: MixerBackupPackage = await exportRes.json();

    const activeSc = serverInstance.mixer.state.sceneNumber;
    const targetSc = activeSc === 1 ? 2 : 1;

    // Modify a channel name in package to verify restore
    const sceneToRestore = originalPkg.scenes[String(activeSc)];
    sceneToRestore.title = 'Restored Concert';
    sceneToRestore.channels[0].name = 'Lead Vox Restored';
    sceneToRestore.channels[0].fader = 950;

    const restorePayload: RestoreRequest = {
      package: originalPkg,
      plan: {
        restoreGlobal: false,
        writeHardware: false,
        scenes: [
          {
            sourceSceneNumber: activeSc,
            targetSceneNumber: targetSc,
          },
        ],
      },
    };

    const restoreRes = await fetch(`http://localhost:${testPort}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restorePayload),
    });

    expect(restoreRes.status).toBe(200);
    const result = await restoreRes.json();
    expect(result.ok).toBe(true);
    expect(result.restoredScenes).toContain(targetSc);

    // Verify target scene is archived in storage
    const archived = serverInstance.mixer.archiveStorage.getScene(targetSc);
    expect(archived).toBeDefined();
    expect(archived?.title).toBe('Restored Concert');
    expect(archived?.channels[0].name).toBe('Lead Vox Restored');
    expect(archived?.channels[0].fader).toBe(950);
  });

  it('POST /api/backup/restore updates live state when target is active scene', async () => {
    const exportRes = await fetch(`http://localhost:${testPort}/api/backup`);
    const originalPkg: MixerBackupPackage = await exportRes.json();

    const activeSc = serverInstance.mixer.state.sceneNumber;

    originalPkg.scenes[String(activeSc)].title = 'Live Scene Restored';
    originalPkg.scenes[String(activeSc)].channels[1].fader = 777;

    const restorePayload: RestoreRequest = {
      package: originalPkg,
      plan: {
        restoreGlobal: false,
        writeHardware: false,
        scenes: [
          {
            sourceSceneNumber: activeSc,
            targetSceneNumber: activeSc,
          },
        ],
      },
    };

    const res = await fetch(`http://localhost:${testPort}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restorePayload),
    });

    expect(res.status).toBe(200);
    expect(serverInstance.mixer.state.sceneTitle).toBe('Live Scene Restored');
    expect(serverInstance.mixer.state.channels[1].fader).toBe(777);
  });

  it('POST /api/backup/restore rejects invalid payload with 400', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'structure' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Validation error');
  });

  it('validateRestoreRequest helper catches missing fields', () => {
    const invalidResult = validateRestoreRequest({});
    expect(invalidResult.success).toBe(false);
  });
});
