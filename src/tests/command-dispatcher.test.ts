import { describe, expect, it, vi, beforeEach } from 'vitest';
import { dispatchClientCommand, CommandDispatcherContext } from '../server/command-dispatcher.js';
import { createInitialMixerState } from '../server/default-state.js';
import { ClientCommand, MixerState } from '../shared/types.js';

describe('Command Dispatcher Edge Cases & Environment Decoupling', () => {
  let state: MixerState;
  let sentSysEx: number[][];
  let broadcastChannelUpdates: Array<{ target: string; id: number; changes: Record<string, unknown> }>;
  let broadcastPatches: Array<Partial<MixerState>>;
  let broadcastStateCount: number;
  let appliedSceneLabels: number[];
  let resyncScheduledCount: number;
  let syncedChannelStrips: number[];
  let demoWaveStarted: Array<string | undefined>;
  let demoWaveStoppedCount: number;
  let storedLabels: Array<{ sceneNo: number; target: string; id: number; name: string }>;
  let snapshottedScenes: Array<{ sceneNo: number; labels: any }>;

  let ctx: CommandDispatcherContext;

  beforeEach(() => {
    state = createInitialMixerState();
    sentSysEx = [];
    broadcastChannelUpdates = [];
    broadcastPatches = [];
    broadcastStateCount = 0;
    appliedSceneLabels = [];
    resyncScheduledCount = 0;
    syncedChannelStrips = [];
    demoWaveStarted = [];
    demoWaveStoppedCount = 0;
    storedLabels = [];
    snapshottedScenes = [];

    const mockTransport = {
      sendSysEx: vi.fn(async (bytes: number[]) => {
        sentSysEx.push(bytes);
        return true;
      }),
    } as any;

    const mockLabelsStorage = {
      setLabel: vi.fn((sceneNo: number, target: 'ch' | 'aux' | 'bus', id: number, name: string) => {
        storedLabels.push({ sceneNo, target, id, name });
      }),
      snapshotScene: vi.fn((sceneNo: number, labels: any) => {
        snapshottedScenes.push({ sceneNo, labels });
      }),
      get: vi.fn(),
      load: vi.fn(() => ({})),
      save: vi.fn(),
    } as any;

    ctx = {
      state,
      transport: mockTransport,
      dirtyParams: new Set<string>(),
      labelsStorage: mockLabelsStorage,
      broadcastChannelUpdate: (target, id, changes) => {
        broadcastChannelUpdates.push({ target, id, changes });
      },
      broadcastPatch: (patch) => {
        broadcastPatches.push(patch);
      },
      broadcastState: () => {
        broadcastStateCount++;
      },
      applySceneLabels: (sceneNo) => {
        appliedSceneLabels.push(sceneNo);
      },
      scheduleSceneResync: () => {
        resyncScheduledCount++;
      },
      syncChannelStrip: async (id) => {
        syncedChannelStrips.push(id);
      },
      initialSync: async () => {},
      startDemoWave: async (mode) => {
        demoWaveStarted.push(mode);
      },
      stopDemoWave: async () => {
        demoWaveStoppedCount++;
      },
    };
  });

  describe('set_fader', () => {
    it('clamps values above 1023 to 1023 and updates channel state and SysEx', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: 2000 }, ctx);
      expect(ctx.state.channels[0].fader).toBe(1023);
      expect(sentSysEx).toHaveLength(1);
      expect(broadcastChannelUpdates).toContainEqual({
        target: 'ch',
        id: 1,
        changes: { fader: 1023 },
      });
      expect(ctx.dirtyParams.has('ch1:fader')).toBe(true);
    });

    it('clamps values below 0 to 0', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: -500 }, ctx);
      expect(ctx.state.channels[0].fader).toBe(0);
      expect(sentSysEx).toHaveLength(1);
    });

    it('rounds floating point fader values to nearest integer', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: 823.6 }, ctx);
      expect(ctx.state.channels[0].fader).toBe(824);
    });

    it('safely handles NaN and non-finite values by falling back to 0', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: NaN }, ctx);
      expect(ctx.state.channels[0].fader).toBe(0);

      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: 'not-a-number' as any }, ctx);
      expect(ctx.state.channels[0].fader).toBe(0);
    });

    it('safely ignores out-of-range channel IDs without throwing', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 0, value: 500 }, ctx);
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: 33, value: 500 }, ctx);
      await dispatchClientCommand({ type: 'set_fader', target: 'ch', id: -1, value: 500 }, ctx);
      expect(sentSysEx).toHaveLength(0);
      expect(broadcastChannelUpdates).toHaveLength(0);
    });

    it('safely updates aux, bus, and stereo targets', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'aux', id: 1, value: 700 }, ctx);
      expect(ctx.state.auxes[0].fader).toBe(700);

      await dispatchClientCommand({ type: 'set_fader', target: 'bus', id: 2, value: 650 }, ctx);
      expect(ctx.state.buses[1].fader).toBe(650);

      await dispatchClientCommand({ type: 'set_fader', target: 'stereo', id: 1, value: 823 }, ctx);
      expect(ctx.state.stereo.fader).toBe(823);
      expect(sentSysEx).toHaveLength(3);
    });

    it('ignores unknown targets safely', async () => {
      await dispatchClientCommand({ type: 'set_fader', target: 'unknown' as any, id: 1, value: 500 }, ctx);
      expect(sentSysEx).toHaveLength(0);
    });
  });

  describe('set_pan', () => {
    it('clamps pan values to [-63, 63]', async () => {
      await dispatchClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: 100 }, ctx);
      expect(ctx.state.channels[0].pan).toBe(63);

      await dispatchClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: -100 }, ctx);
      expect(ctx.state.channels[0].pan).toBe(-63);
    });

    it('handles NaN pan by falling back to center (0)', async () => {
      await dispatchClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: NaN }, ctx);
      expect(ctx.state.channels[0].pan).toBe(0);
    });

    it('safely ignores out-of-range IDs for pan', async () => {
      await dispatchClientCommand({ type: 'set_pan', target: 'ch', id: 99, value: 20 }, ctx);
      await dispatchClientCommand({ type: 'set_pan', target: 'aux', id: 0, value: 20 }, ctx);
      expect(sentSysEx).toHaveLength(0);
    });
  });

  describe('set_att', () => {
    it('clamps attenuation to [-960, 180]', async () => {
      await dispatchClientCommand({ type: 'set_att', id: 1, value: 500 }, ctx);
      expect(ctx.state.channels[0].att).toBe(180);

      await dispatchClientCommand({ type: 'set_att', id: 1, value: -1200 }, ctx);
      expect(ctx.state.channels[0].att).toBe(-960);
    });

    it('defaults NaN attenuation to 0', async () => {
      await dispatchClientCommand({ type: 'set_att', id: 1, value: NaN }, ctx);
      expect(ctx.state.channels[0].att).toBe(0);
    });

    it('ignores out of range channel IDs for set_att', async () => {
      await dispatchClientCommand({ type: 'set_att', id: 35, value: 50 }, ctx);
      expect(sentSysEx).toHaveLength(0);
    });
  });

  describe('set_name', () => {
    it('trims whitespace and falls back to default label when empty', async () => {
      await dispatchClientCommand({ type: 'set_name', target: 'ch', id: 1, name: '   ' }, ctx);
      expect(ctx.state.channels[0].name).toBe('CH1');
      expect(storedLabels).toContainEqual({ sceneNo: 1, target: 'ch', id: 1, name: 'CH1' });

      await dispatchClientCommand({ type: 'set_name', target: 'aux', id: 2, name: '' }, ctx);
      expect(ctx.state.auxes[1].name).toBe('AUX 2');

      await dispatchClientCommand({ type: 'set_name', target: 'bus', id: 3, name: '   ' }, ctx);
      expect(ctx.state.buses[2].name).toBe('BUS 3');
    });

    it('truncates names exceeding 32 characters', async () => {
      const veryLongName = 'A'.repeat(50);
      await dispatchClientCommand({ type: 'set_name', target: 'ch', id: 1, name: veryLongName }, ctx);
      expect(ctx.state.channels[0].name).toBe('A'.repeat(32));
      expect(ctx.state.channels[0].name.length).toBe(32);
    });

    it('sends 4 SysEx bytes for the first 4 characters to Yamaha 01V96 hardware', async () => {
      await dispatchClientCommand({ type: 'set_name', target: 'ch', id: 1, name: 'Vocal' }, ctx);
      // 4 bytes sent for SysEx char 0, 1, 2, 3
      expect(sentSysEx).toHaveLength(4);
    });

    it('ignores out-of-range IDs for set_name', async () => {
      await dispatchClientCommand({ type: 'set_name', target: 'ch', id: 0, name: 'Test' }, ctx);
      await dispatchClientCommand({ type: 'set_name', target: 'ch', id: 33, name: 'Test' }, ctx);
      expect(sentSysEx).toHaveLength(0);
      expect(storedLabels).toHaveLength(0);
    });
  });

  describe('set_eq', () => {
    it('safely ignores invalid or unknown EQ parameters', async () => {
      await dispatchClientCommand(
        { type: 'set_eq', target: 'ch', id: 1, param: 'unknown_band' as any, value: 50 },
        ctx
      );
      expect(sentSysEx).toHaveLength(0);
      expect(broadcastChannelUpdates).toHaveLength(0);
    });

    it('handles boolean EQ parameters (e.g. on, hpfOn)', async () => {
      await dispatchClientCommand(
        { type: 'set_eq', target: 'ch', id: 1, param: 'on', value: false },
        ctx
      );
      expect(ctx.state.channels[0].eq.on).toBe(false);
      expect(sentSysEx).toHaveLength(1);
    });

    it('handles numeric EQ band parameters across ch, aux, bus, and stereo', async () => {
      await dispatchClientCommand(
        { type: 'set_eq', target: 'ch', id: 1, param: 'lowG', value: 35 },
        ctx
      );
      expect(ctx.state.channels[0].eq.low.gain).toBe(35);

      await dispatchClientCommand(
        { type: 'set_eq', target: 'stereo', id: 1, param: 'highG', value: -20 },
        ctx
      );
      expect(ctx.state.stereo.eq.high.gain).toBe(-20);
    });

    it('ignores out-of-range IDs for set_eq', async () => {
      await dispatchClientCommand(
        { type: 'set_eq', target: 'ch', id: 0, param: 'lowG', value: 35 },
        ctx
      );
      expect(sentSysEx).toHaveLength(0);
    });
  });

  describe('set_gate and set_comp', () => {
    it('ignores invalid gate param or out-of-range channel ID', async () => {
      await dispatchClientCommand(
        { type: 'set_gate', id: 1, param: 'invalid_param' as any, value: 10 },
        ctx
      );
      await dispatchClientCommand(
        { type: 'set_gate', id: 33, param: 'on', value: true },
        ctx
      );
      expect(sentSysEx).toHaveLength(0);
    });

    it('applies valid gate parameters to channel', async () => {
      await dispatchClientCommand(
        { type: 'set_gate', id: 1, param: 'on', value: true },
        ctx
      );
      expect(ctx.state.channels[0].gate.on).toBe(true);
      expect(sentSysEx).toHaveLength(1);
    });

    it('applies compressor parameters to channel and stereo', async () => {
      await dispatchClientCommand(
        { type: 'set_comp', target: 'ch', id: 1, param: 'on', value: true },
        ctx
      );
      expect(ctx.state.channels[0].comp.on).toBe(true);

      await dispatchClientCommand(
        { type: 'set_comp', target: 'stereo', id: 1, param: 'ratio', value: 4 },
        ctx
      );
      expect(ctx.state.stereo.comp.ratio).toBe(4);
      expect(sentSysEx).toHaveLength(2);
    });
  });

  describe('set_aux_send', () => {
    it('clamps send level between 0 and 1023 and handles NaN', async () => {
      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 1, auxId: 1, param: 'level', value: 2000 },
        ctx
      );
      expect(ctx.state.channels[0].auxSends[0].level).toBe(1023);

      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 1, auxId: 1, param: 'level', value: NaN },
        ctx
      );
      expect(ctx.state.channels[0].auxSends[0].level).toBe(0);
    });

    it('safely handles invalid chId or auxId', async () => {
      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 0, auxId: 1, param: 'level', value: 500 },
        ctx
      );
      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 1, auxId: 9, param: 'level', value: 500 },
        ctx
      );
      expect(sentSysEx).toHaveLength(0);
    });

    it('sets pre/post and on/off flags accurately', async () => {
      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 1, auxId: 1, param: 'pre', value: true },
        ctx
      );
      expect(ctx.state.channels[0].auxSends[0].pre).toBe(true);

      await dispatchClientCommand(
        { type: 'set_aux_send', chId: 1, auxId: 1, param: 'on', value: false },
        ctx
      );
      expect(ctx.state.channels[0].auxSends[0].on).toBe(false);
    });
  });

  describe('set_delay', () => {
    it('clamps delay time to [0, 1000] ms and handles NaN', async () => {
      await dispatchClientCommand({ type: 'set_delay', id: 1, on: true, time: 1500 }, ctx);
      expect(ctx.state.channels[0].delayTime).toBe(1000);
      expect(ctx.state.channels[0].delayOn).toBe(true);

      await dispatchClientCommand({ type: 'set_delay', id: 1, on: false, time: NaN }, ctx);
      expect(ctx.state.channels[0].delayTime).toBe(0);
      expect(ctx.state.channels[0].delayOn).toBe(false);
    });

    it('ignores out-of-range channel ID for set_delay', async () => {
      await dispatchClientCommand({ type: 'set_delay', id: 0, on: true, time: 200 }, ctx);
      await dispatchClientCommand({ type: 'set_delay', id: 33, on: true, time: 200 }, ctx);
      expect(sentSysEx).toHaveLength(0);
    });
  });

  describe('select_channel', () => {
    it('clamps selected channel to [1, 32]', async () => {
      await dispatchClientCommand({ type: 'select_channel', id: 0 }, ctx);
      expect(ctx.state.selectedChannel).toBe(1);

      await dispatchClientCommand({ type: 'select_channel', id: 99 }, ctx);
      expect(ctx.state.selectedChannel).toBe(32);
    });

    it('syncs channel strip and its stereo pair', async () => {
      await dispatchClientCommand({ type: 'select_channel', id: 5 }, ctx);
      expect(syncedChannelStrips).toContain(5);
      expect(syncedChannelStrips).toContain(6); // odd pair is id + 1

      syncedChannelStrips = [];
      await dispatchClientCommand({ type: 'select_channel', id: 8 }, ctx);
      expect(syncedChannelStrips).toContain(8);
      expect(syncedChannelStrips).toContain(7); // even pair is id - 1
    });
  });

  describe('recall_scene and store_scene', () => {
    it('clamps scene number to [0, 99] and triggers scene resync on recall', async () => {
      await dispatchClientCommand({ type: 'recall_scene', sceneNumber: -5 }, ctx);
      expect(ctx.state.sceneNumber).toBe(0);
      expect(appliedSceneLabels).toContain(0);
      expect(resyncScheduledCount).toBe(1);

      await dispatchClientCommand({ type: 'recall_scene', sceneNumber: 150 }, ctx);
      expect(ctx.state.sceneNumber).toBe(99);
      expect(appliedSceneLabels).toContain(99);
      expect(resyncScheduledCount).toBe(2);
    });

    it('stores scene, clamps scene number, truncates title to 16 chars, and snapshots labels', async () => {
      const longTitle = 'Super Long Studio Scene Title That Exceeds Limit';
      await dispatchClientCommand(
        { type: 'store_scene', sceneNumber: 42, title: longTitle },
        ctx
      );
      expect(ctx.state.sceneNumber).toBe(42);
      expect(ctx.state.sceneTitle).toBe(longTitle.slice(0, 16).trim());
      expect(snapshottedScenes).toHaveLength(1);
      expect(snapshottedScenes[0].sceneNo).toBe(42);
      expect(broadcastStateCount).toBe(1);
    });
  });

  describe('demo wave, effects and setup', () => {
    it('triggers demo wave start and stop', async () => {
      await dispatchClientCommand({ type: 'trigger_demo_wave', mode: 'sine' }, ctx);
      expect(demoWaveStarted).toContain('sine');

      ctx.state.demoWaveActive = true;
      await dispatchClientCommand({ type: 'trigger_demo_wave' }, ctx);
      expect(demoWaveStoppedCount).toBe(1);
    });

    it('handles set_effect safely with clamped rackId', async () => {
      await dispatchClientCommand(
        { type: 'set_effect', rackId: 1, param: 'bypass', value: true },
        ctx
      );
      expect(ctx.state.effects[0].bypass).toBe(true);

      await dispatchClientCommand(
        { type: 'set_effect', rackId: 1, param: 'mix', value: 80 },
        ctx
      );
      expect(ctx.state.effects[0].mix).toBe(80);
    });

    it('handles set_geq safely with clamped unitId and bands', async () => {
      await dispatchClientCommand(
        { type: 'set_geq', unitId: 1, param: 'band', bandIndex: 10, value: 50 },
        ctx
      );
      expect(ctx.state.geqs[0].bands[10]).toBe(50);

      await dispatchClientCommand(
        { type: 'set_geq', unitId: 1, param: 'flat', value: 1 },
        ctx
      );
      expect(ctx.state.geqs[0].bands.every((b) => b === 0)).toBe(true);
    });
  });
});
