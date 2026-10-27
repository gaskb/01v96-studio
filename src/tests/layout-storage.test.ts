import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LayoutStorage } from '../server/layout-storage.js';
import { ChannelLayoutConfig } from '../shared/types.js';

describe('LayoutStorage (Decoupled General Layout File Persistence)', () => {
  let tmpDir: string;
  let testFilePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '01v96-layout-test-'));
    testFilePath = path.join(tmpDir, 'layouts.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('initializes with empty presets if file does not exist', () => {
    const storage = new LayoutStorage(testFilePath);
    expect(storage.getPresets()).toEqual([]);
    expect(storage.getActiveLayout()).toBeUndefined();
  });

  it('saves and loads active layout', () => {
    const storage = new LayoutStorage(testFilePath);
    const mockLayout: ChannelLayoutConfig = {
      presetName: 'Test Active',
      gridCols: 24,
      gridRows: 4,
      items: [
        { id: 'meter_vertical', colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 4, visible: true },
      ],
    };

    storage.setActiveLayout(mockLayout);
    expect(fs.existsSync(testFilePath)).toBe(true);

    const reloaded = new LayoutStorage(testFilePath);
    expect(reloaded.getActiveLayout()).toEqual(mockLayout);
  });

  it('saves, updates, and deletes presets in general file without touching mixer scenes', () => {
    const storage = new LayoutStorage(testFilePath);

    const preset1: ChannelLayoutConfig = {
      presetName: 'Live Vocals',
      gridCols: 24,
      gridRows: 4,
      items: [{ id: 'compressor', colSpan: 6, visible: true }],
    };

    const preset2: ChannelLayoutConfig = {
      presetName: 'Drums Punch',
      gridCols: 24,
      gridRows: 4,
      items: [{ id: 'gate', colSpan: 4, visible: true }],
    };

    // Save 2 presets
    storage.savePreset(preset1);
    storage.savePreset(preset2);
    expect(storage.getPresets()).toHaveLength(2);

    // Update preset1
    const updatedPreset1: ChannelLayoutConfig = {
      ...preset1,
      items: [
        { id: 'compressor', colSpan: 8, visible: true },
        { id: 'meter_vu', colSpan: 8, visible: true },
      ],
    };
    storage.savePreset(updatedPreset1);
    expect(storage.getPresets()).toHaveLength(2);
    expect(storage.getPresets().find((p) => p.presetName === 'Live Vocals')?.items).toHaveLength(2);

    // Delete drums punch
    storage.deletePreset('Drums Punch');
    expect(storage.getPresets()).toHaveLength(1);
    expect(storage.getPresets()[0].presetName).toBe('Live Vocals');

    // Verify persisted on disk
    const reloaded = new LayoutStorage(testFilePath);
    expect(reloaded.getPresets()).toHaveLength(1);
    expect(reloaded.getPresets()[0].presetName).toBe('Live Vocals');
  });

  it('handles corrupted JSON files gracefully without throwing', () => {
    fs.writeFileSync(testFilePath, '{ broken json content ...', 'utf-8');
    const storage = new LayoutStorage(testFilePath);
    expect(storage.getPresets()).toEqual([]);
  });
});
