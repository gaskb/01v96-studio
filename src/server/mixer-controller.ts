import { ClientCommand, MixerState } from '../shared/types.js';
import { dispatchClientCommand } from './command-dispatcher.js';
import { createInitialMixerState } from './default-state.js';
import { computePostDspMeter } from './dsp-meter-simulator.js';
import {
  buildMeterRequest,
  buildOutputMeterRequest,
  buildParamChange,
  buildParamRequest,
  COMP_PARAM_MAP,
  EL_AUX_FADER,
  EL_AUX_ON,
  EL_BUS_FADER,
  EL_BUS_ON,
  EL_EFFECT,
  EL_INPUT_ATT,
  EL_INPUT_AUX,
  EL_INPUT_COMP,
  EL_INPUT_EQ,
  EL_INPUT_FADER,
  EL_INPUT_GATE,
  EL_INPUT_ON,
  EL_INPUT_PAIR,
  EL_INPUT_PAN,
  EL_INPUT_PHASE,
  EL_INPUT_ROUTING,
  EL_SCENE_TITLE,
  EL_STEREO_FADER,
  EL_STEREO_ON,
  GATE_PARAM_MAP,
  MODEL_01V96,
  MODEL_UNIVERSAL,
} from './protocol.js';
import { SceneLabelsStorage } from './scene-labels-storage.js';
import { handleIncomingMidi } from './sysex-inbound-handler.js';
import { YamahaUsbTransport } from './usb-transport.js';

// Re-export computePostDspMeter for backward-compatibility with tests & external modules
export { computePostDspMeter };

export class MixerController {
  public state: MixerState;
  private transport: YamahaUsbTransport;
  private broadcastCallback: (msg: unknown) => void;
  private meterInterval: NodeJS.Timeout | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private demoWaveTimer: NodeJS.Timeout | null = null;
  private sceneSyncDebounceTimer: NodeJS.Timeout | null = null;
  private savedFadersBeforeWave: number[] = [];
  private dirtyParams: Set<string> = new Set();
  private sceneTitleChars: string[] = Array(16).fill(' ');
  private effectTitleChars: Map<number, string[]> = new Map();
  private channelNameChars: Map<number, string[]> = new Map();
  private labelsStorage: SceneLabelsStorage;

  constructor(broadcastCallback: (msg: unknown) => void) {
    this.broadcastCallback = broadcastCallback;
    this.transport = new YamahaUsbTransport();
    this.state = createInitialMixerState();
    this.labelsStorage = new SceneLabelsStorage();

    for (let i = 0; i < 32; i++) {
      this.channelNameChars.set(i, (`CH${i + 1}    `).slice(0, 4).split(''));
    }
    for (let i = 0; i < 4; i++) {
      this.effectTitleChars.set(i, Array(16).fill(' '));
    }

    this.applySceneLabels(this.state.sceneNumber);

    this.transport.onMessage((msg) => this.handleIncomingMidi(msg));
    this.transport.onStatusChange((connected) => {
      this.state.connected = connected;
      this.state.connectionMode = connected ? 'usb-direct' : 'simulated';
      this.broadcastState();
    });
  }

  public applySceneLabels(sceneNo: number): void {
    const labels = this.labelsStorage.get(sceneNo);
    if (!labels) return;

    if (labels.ch) {
      for (const [idStr, name] of Object.entries(labels.ch)) {
        const id = Number(idStr);
        const idx = id - 1;
        if (this.state.channels[idx] && name) {
          this.state.channels[idx].name = name;
          this.broadcastChannelUpdate('ch', id, { name });
        }
      }
    }
    if (labels.aux) {
      for (const [idStr, name] of Object.entries(labels.aux)) {
        const id = Number(idStr);
        const idx = id - 1;
        if (this.state.auxes[idx] && name) {
          this.state.auxes[idx].name = name;
          this.broadcastChannelUpdate('aux', id, { name });
        }
      }
    }
    if (labels.bus) {
      for (const [idStr, name] of Object.entries(labels.bus)) {
        const id = Number(idStr);
        const idx = id - 1;
        if (this.state.buses[idx] && name) {
          this.state.buses[idx].name = name;
          this.broadcastChannelUpdate('bus', id, { name });
        }
      }
    }
  }

  start(): void {
    const ok = this.transport.connect();
    if (ok) {
      this.initialSync();
    }

    // High-frequency meter polling (35ms interval ~ 28 fps) - throttled if sendQueue is busy
    this.meterInterval = setInterval(async () => {
      if (this.transport.isConnected() && this.transport.getQueueLength() < 2) {
        await this.transport.sendSysEx(buildMeterRequest());
      }
    }, 35);

    // Auto-reconnect monitoring every 3s
    this.reconnectInterval = setInterval(async () => {
      if (!this.transport.isConnected()) {
        const ok = this.transport.connect();
        if (ok) {
          await this.initialSync();
        }
      }
    }, 3000);
  }

  stop(): void {
    this.stopDemoWave();
    if (this.meterInterval) clearInterval(this.meterInterval);
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.sceneSyncDebounceTimer) clearTimeout(this.sceneSyncDebounceTimer);
    this.transport.disconnect();
  }

  async initialSync(): Promise<void> {
    if (!this.transport.isConnected()) return;
    console.log('🔄 Synchronizing state from Yamaha 01V96 VCM...');
    this.dirtyParams.clear();

    await this.transport.sendSysEx(buildMeterRequest());
    await this.transport.sendSysEx(buildOutputMeterRequest());

    // Query Scene Title (16 chars)
    for (let p = 0; p < 16; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0));
    }

    // Query Faders, On, Pan, Phase, Att, Patch, and 4-Band EQ for all 32 input channels
    for (let ch = 0; ch < 32; ch++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 3, 46, 0, ch)); // Solo
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 1, 0, ch)); // Input Patch
      for (let p = 0; p < 4; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 4, p, ch)); // Short Name
      }
      for (let p = 1; p <= 15; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, p, ch));
      }
      await this.delay(10);
    }

    // Query AUX 1..8 Masters & BUS 1..8 Masters & Stereo Out
    for (let i = 0; i < 8; i++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_AUX_FADER, 0, i));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_AUX_ON, 0, i));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_BUS_FADER, 0, i));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_BUS_ON, 0, i));
    }
    await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_STEREO_FADER, 0, 0));
    await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_STEREO_ON, 0, 0));

    // Query Effects 1..4 Titles & Bypass/Mix
    for (let fx = 0; fx < 4; fx++) {
      for (let p = 0; p < 16; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, p, fx));
      }
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 48, fx)); // Mix
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 49, fx)); // Type
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, fx)); // Bypass
    }

    // Sync full Channel Strip for Selected Channel (and its adjacent pair channel!)
    await this.syncChannelStrip(this.state.selectedChannel);
    const pairCh =
      this.state.selectedChannel % 2 === 1
        ? this.state.selectedChannel + 1
        : this.state.selectedChannel - 1;
    if (pairCh >= 1 && pairCh <= 32) {
      await this.syncChannelStrip(pairCh);
    }
    console.log('✅ Initial synchronization complete!');
  }

  async syncChannelStrip(channelId: number): Promise<void> {
    if (!this.transport.isConnected()) return;
    const ch = Math.max(0, Math.min(31, channelId - 1));

    for (let p = 1; p <= 15; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, p, ch));
    }
    for (const p of Object.values(GATE_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, p, ch));
    }
    for (const p of Object.values(COMP_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, p, ch));
    }
    await this.delay(6);
    for (let p = 0; p <= 10; p++) {
      await this.transport.sendSysEx(
        buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, p, ch)
      );
    }
    for (let p = 0; p < 24; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, p, ch));
    }
  }

  private scheduleSceneResync(): void {
    if (this.sceneSyncDebounceTimer) {
      clearTimeout(this.sceneSyncDebounceTimer);
    }
    this.sceneSyncDebounceTimer = setTimeout(() => {
      this.initialSync();
    }, 250);
  }

  public handleIncomingMidi(msg: number[]): void {
    handleIncomingMidi(msg, {
      state: this.state,
      dirtyParams: this.dirtyParams,
      sceneTitleChars: this.sceneTitleChars,
      effectTitleChars: this.effectTitleChars,
      channelNameChars: this.channelNameChars,
      labelsStorage: this.labelsStorage,
      broadcastPatch: (patch) => this.broadcastPatch(patch),
      broadcastChannelUpdate: (target, id, changes) =>
        this.broadcastChannelUpdate(target, id, changes),
      broadcastMeters: (meters) => this.broadcastCallback(meters),
      applySceneLabels: (sceneNo) => this.applySceneLabels(sceneNo),
      scheduleSceneResync: () => this.scheduleSceneResync(),
      syncChannelStrip: (id) => this.syncChannelStrip(id),
    });
  }

  public async handleClientCommand(cmd: ClientCommand): Promise<void> {
    await dispatchClientCommand(cmd, {
      state: this.state,
      transport: this.transport,
      dirtyParams: this.dirtyParams,
      labelsStorage: this.labelsStorage,
      broadcastChannelUpdate: (target, id, changes) =>
        this.broadcastChannelUpdate(target, id, changes),
      broadcastPatch: (patch) => this.broadcastPatch(patch),
      broadcastState: () => this.broadcastState(),
      applySceneLabels: (sceneNo) => this.applySceneLabels(sceneNo),
      scheduleSceneResync: () => this.scheduleSceneResync(),
      syncChannelStrip: (id) => this.syncChannelStrip(id),
      initialSync: () => this.initialSync(),
      startDemoWave: (mode) => this.startDemoWave(mode),
      stopDemoWave: () => this.stopDemoWave(),
    });
  }

  public async startDemoWave(mode: 'sine' | 'bounce' | 'v-shape' = 'sine'): Promise<void> {
    if (this.state.demoWaveActive) {
      await this.stopDemoWave();
      return;
    }

    this.savedFadersBeforeWave = this.state.channels.map((c) => c.fader);
    this.state.demoWaveActive = true;
    this.broadcastPatch({ demoWaveActive: true });

    let step = 0;
    this.demoWaveTimer = setInterval(async () => {
      if (!this.state.demoWaveActive) return;
      step++;

      const faderUpdates: Record<number, number> = {};
      for (let ch = 0; ch < 16; ch++) {
        let val = 0;
        if (mode === 'sine') {
          const angle = step * 0.24 - ch * 0.45;
          val = Math.round(((Math.sin(angle) + 1) / 2) * 950);
        } else if (mode === 'bounce') {
          const pos = (step * 0.6) % 30;
          const peak = pos > 15 ? 30 - pos : pos;
          const dist = Math.abs(ch - peak);
          val = Math.max(0, Math.round(980 - dist * 220));
        } else {
          const center = 7.5;
          const dist = Math.abs(ch - center);
          const angle = step * 0.25 - dist * 0.5;
          val = Math.round(((Math.sin(angle) + 1) / 2) * 950);
        }

        this.state.channels[ch].fader = val;
        this.state.channels[ch + 16].fader = val;
        faderUpdates[ch + 1] = val;
        faderUpdates[ch + 17] = val;

        if (this.transport.isConnected()) {
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch, val)
          );
        }
      }

      this.broadcastCallback({ type: 'wave_frame', faders: faderUpdates });

      if (step >= 180) {
        await this.stopDemoWave();
      }
    }, 60);
  }

  public async stopDemoWave(): Promise<void> {
    if (!this.state.demoWaveActive) return;
    if (this.demoWaveTimer) {
      clearInterval(this.demoWaveTimer);
      this.demoWaveTimer = null;
    }
    this.state.demoWaveActive = false;

    for (let ch = 0; ch < 32; ch++) {
      const orig = this.savedFadersBeforeWave[ch] ?? 0;
      this.state.channels[ch].fader = orig;
      if (ch < 16 && this.transport.isConnected()) {
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch, orig)
        );
      }
    }
    this.broadcastState();
  }

  private broadcastState(): void {
    this.broadcastCallback({ type: 'full_state', state: this.state });
  }

  private broadcastPatch(patch: Partial<MixerState>): void {
    this.broadcastCallback({ type: 'state_patch', patch });
  }

  private broadcastChannelUpdate(
    target: 'ch' | 'aux' | 'bus' | 'stereo',
    id: number,
    changes: Record<string, unknown>
  ): void {
    const savedChannel =
      target === 'ch' && this.state.savedChannels[id - 1]
        ? this.state.savedChannels[id - 1]
        : undefined;
    this.broadcastCallback({ type: 'channel_update', target, id, changes, savedChannel });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
