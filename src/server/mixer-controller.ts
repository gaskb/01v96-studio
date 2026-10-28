import {
  API_VERSION,
  APP_VERSION,
  ClientCommand,
  MixerBackupPackage,
  MixerState,
  RestoreRequest,
  RestoreResult,
  SceneBackupData,
  UI_VERSION,
} from '../shared/types.js';
import { dispatchClientCommand } from './command-dispatcher.js';
import { createInitialMixerState } from './default-state.js';
import { computePostDspMeter } from './dsp-meter-simulator.js';
import { LayoutStorage } from './layout-storage.js';
import {
  buildMeterRequest,
  buildOutputMeterRequest,
  buildParamChange,
  buildParamRequest,
  buildSceneStoreSysEx,
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
import { SceneArchiveStorage } from './scene-archive-storage.js';
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
  public archiveStorage: SceneArchiveStorage;
  private isSyncing = false;
  private pendingSceneResync = false;
  private syncSessionId = 0;

  constructor(broadcastCallback: (msg: unknown) => void) {
    this.broadcastCallback = broadcastCallback;
    this.transport = new YamahaUsbTransport();
    this.state = createInitialMixerState();
    this.labelsStorage = new SceneLabelsStorage();
    this.archiveStorage = new SceneArchiveStorage();

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

    // Live meter streaming keepalive (3000ms - Yamaha 01V96 streams continuous meters via USB IN on its own)
    this.meterInterval = setInterval(async () => {
      if (this.transport.isConnected()) {
        await this.transport.sendSysEx(buildMeterRequest(), 'high');
      }
    }, 3000);

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
    this.transport.clearLowPriorityQueue();
    this.transport.disconnect();
  }

  async initialSync(): Promise<void> {
    if (!this.transport.isConnected()) return;
    this.syncSessionId++;
    const currentSession = this.syncSessionId;
    const startTime = Date.now();
    console.log('🔄 Synchronizing state from Yamaha 01V96 VCM...');
    this.dirtyParams.clear();
    this.transport.clearLowPriorityQueue();

    // 1. Meter Streaming Start
    await this.transport.sendSysEx(buildMeterRequest(), 'high');
    await this.transport.sendSysEx(buildOutputMeterRequest(), 'high');

    // 2. Query Scene Title (16 chars)
    for (let p = 0; p < 16; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0), 'high');
    }

    // 3. Faders, On, Pan, Phase, Att, Pair, Solo, Patch, and Track Names (4 chars) for all 32 channels
    for (let ch = 0; ch < 32; ch++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 3, 46, 0, ch), 'high'); // Solo
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 1, 0, ch), 'high'); // Input Patch
      for (let p = 0; p < 4; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 4, p, ch), 'high'); // Short Name
      }
    }

    // 4. Query AUX 1..8 Masters & BUS 1..8 Masters & Stereo Out
    for (let i = 0; i < 8; i++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_AUX_FADER, 0, i), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_AUX_ON, 0, i), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_BUS_FADER, 0, i), 'high');
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_BUS_ON, 0, i), 'high');
    }
    await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_STEREO_FADER, 0, 0), 'high');
    await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_STEREO_ON, 0, 0), 'high');

    // 5. Query Effects 1..4 Titles & Bypass/Mix/Type (for effect picker selection)
    for (let fx = 0; fx < 4; fx++) {
      for (let p = 0; p < 16; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, p, fx), 'high');
      }
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 48, fx), 'high'); // Mix
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 49, fx), 'high'); // Type
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, fx), 'high'); // Bypass
    }

    // 6. Sync full Channel Strip (EQ, Gate, Comp, Aux Sends, Routing) for Selected Channel (and its pair)
    await this.syncChannelStrip(this.state.selectedChannel);
    const pairCh =
      this.state.selectedChannel % 2 === 1
        ? this.state.selectedChannel + 1
        : this.state.selectedChannel - 1;
    if (pairCh >= 1 && pairCh <= 32) {
      await this.syncChannelStrip(pairCh);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Immediate synchronization complete in ${elapsed}ms! Surface and selected channel active.`);

    // 7. Background Phase: query remaining 31 channels EQ curves with low priority
    this.syncRemainingChannelsInBackground(currentSession);
  }

  private async syncRemainingChannelsInBackground(sessionId: number): Promise<void> {
    const selCh = this.state.selectedChannel;
    const pairCh = selCh % 2 === 1 ? selCh + 1 : selCh - 1;

    for (let ch = 0; ch < 32; ch++) {
      if (sessionId !== this.syncSessionId) return; // Scene was changed or sync cancelled, abort!
      const chId = ch + 1;
      if (chId === selCh || chId === pairCh) continue; // Already loaded in high priority!

      for (let p = 1; p <= 15; p++) {
        if (sessionId !== this.syncSessionId) return;
        await this.transport.sendSysEx(
          buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, p, ch),
          'low'
        );
      }
      await this.delay(10);
    }
  }

  async syncChannelStrip(channelId: number): Promise<void> {
    if (!this.transport.isConnected()) return;
    const ch = Math.max(0, Math.min(31, channelId - 1));

    for (let p = 1; p <= 15; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, p, ch), 'high');
    }
    for (const p of Object.values(GATE_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, p, ch), 'high');
    }
    for (const p of Object.values(COMP_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, p, ch), 'high');
    }
    for (let p = 0; p <= 10; p++) {
      await this.transport.sendSysEx(
        buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, p, ch),
        'high'
      );
    }
    for (let p = 0; p < 24; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, p, ch), 'high');
    }
  }

  private scheduleSceneResync(): void {
    if (this.sceneSyncDebounceTimer) {
      clearTimeout(this.sceneSyncDebounceTimer);
    }
    // Cancel any low-priority background queries immediately!
    this.transport.clearLowPriorityQueue();

    this.sceneSyncDebounceTimer = setTimeout(async () => {
      if (this.isSyncing) {
        this.pendingSceneResync = true;
        return;
      }
      this.isSyncing = true;
      try {
        await this.initialSync();
      } finally {
        this.isSyncing = false;
        if (this.pendingSceneResync) {
          this.pendingSceneResync = false;
          this.scheduleSceneResync();
        }
      }
    }, 200);
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
      archiveStorage: this.archiveStorage,
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

  public getSceneList(): Array<{
    sceneNumber: number;
    title: string;
    hasArchive: boolean;
    hasLabels: boolean;
    isCurrent: boolean;
  }> {
    const list: Array<{
      sceneNumber: number;
      title: string;
      hasArchive: boolean;
      hasLabels: boolean;
      isCurrent: boolean;
    }> = [];
    const allArchived = this.archiveStorage.getAllScenes();

    for (let i = 0; i <= 99; i++) {
      const isCurrent = i === this.state.sceneNumber;
      const archived = allArchived[String(i)];
      const labels = this.labelsStorage.get(i);
      const title = isCurrent
        ? this.state.sceneTitle
        : archived?.title || (i === 0 ? 'Initial Data' : `Scene #${String(i).padStart(2, '0')}`);

      if (isCurrent || archived || labels) {
        list.push({
          sceneNumber: i,
          title,
          hasArchive: !!archived,
          hasLabels: !!labels,
          isCurrent,
        });
      }
    }
    return list;
  }

  public exportBackup(
    sceneNumbers?: number[],
    includeGlobal = true,
    metadata?: { name?: string; author?: string; description?: string }
  ): MixerBackupPackage {
    const scenesToExport: Record<string, SceneBackupData> = {};
    const allArchived = this.archiveStorage.getAllScenes();

    let targetNumbers: number[] = [];
    if (sceneNumbers && sceneNumbers.length > 0) {
      targetNumbers = sceneNumbers;
    } else {
      const numSet = new Set<number>();
      for (const k of Object.keys(allArchived)) numSet.add(Number(k));
      numSet.add(this.state.sceneNumber);
      targetNumbers = Array.from(numSet).sort((a, b) => a - b);
    }

    for (const num of targetNumbers) {
      if (num === this.state.sceneNumber) {
        const chMap: Record<number, string> = {};
        for (const c of this.state.channels) chMap[c.id] = c.name;
        const auxMap: Record<number, string> = {};
        for (const a of this.state.auxes) auxMap[a.id] = a.name;
        const busMap: Record<number, string> = {};
        for (const b of this.state.buses) busMap[b.id] = b.name;

        scenesToExport[String(num)] = {
          number: num,
          title: this.state.sceneTitle,
          channels: structuredClone(this.state.channels),
          auxes: structuredClone(this.state.auxes),
          buses: structuredClone(this.state.buses),
          stereo: structuredClone(this.state.stereo),
          effects: structuredClone(this.state.effects),
          labels: { ch: chMap, aux: auxMap, bus: busMap },
        };
      } else if (allArchived[String(num)]) {
        scenesToExport[String(num)] = structuredClone(allArchived[String(num)]);
      } else {
        const labels = this.labelsStorage.get(num);
        if (labels) {
          scenesToExport[String(num)] = {
            number: num,
            title: `Scene #${String(num).padStart(2, '0')}`,
            channels: structuredClone(this.state.channels),
            auxes: structuredClone(this.state.auxes),
            buses: structuredClone(this.state.buses),
            stereo: structuredClone(this.state.stereo),
            effects: structuredClone(this.state.effects),
            labels: structuredClone(labels),
          };
        }
      }
    }

    return {
      format: '01v96-studio-backup',
      version: '1.0',
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      uiVersion: UI_VERSION,
      apiVersion: API_VERSION,
      metadata: metadata || {
        name: `01V96 Studio Backup`,
        description: `Exported ${Object.keys(scenesToExport).length} scene(s)`,
      },
      global: includeGlobal
        ? {
            activeLayer: this.state.activeLayer,
            dualChannelView: this.state.dualChannelView,
            deepPair: this.state.deepPair,
          }
        : undefined,
      scenes: scenesToExport,
    };
  }

  public async restoreBackup(
    req: RestoreRequest,
    layoutStorage?: LayoutStorage
  ): Promise<RestoreResult> {
    const restoredScenes: number[] = [];
    let restoredGlobal = false;

    // 1. Restore global layouts & flags
    if (req.plan.restoreGlobal && req.package.global) {
      if (req.package.global.layouts && layoutStorage) {
        if (req.package.global.layouts.activeLayout) {
          layoutStorage.setActiveLayout(req.package.global.layouts.activeLayout);
        }
        if (req.package.global.layouts.presets) {
          for (const p of req.package.global.layouts.presets) {
            layoutStorage.savePreset(p);
          }
        }
      }
      if (req.package.global.activeLayer !== undefined) {
        this.state.activeLayer = req.package.global.activeLayer;
      }
      if (req.package.global.deepPair !== undefined) {
        this.state.deepPair = req.package.global.deepPair;
      }
      restoredGlobal = true;
    }

    // 2. Restore scenes according to the plan
    for (const item of req.plan.scenes) {
      const srcKey = String(item.sourceSceneNumber);
      const sceneData = req.package.scenes[srcKey];
      if (!sceneData) continue;

      const targetNum = item.targetSceneNumber;

      const clonedScene: SceneBackupData = {
        ...structuredClone(sceneData),
        number: targetNum,
      };
      this.archiveStorage.archiveScene(targetNum, clonedScene);

      if (sceneData.labels) {
        this.labelsStorage.snapshotScene(targetNum, sceneData.labels);
      }

      if (targetNum === this.state.sceneNumber) {
        this.state.sceneTitle = sceneData.title || `Scene #${targetNum}`;
        if (sceneData.channels) this.state.channels = structuredClone(sceneData.channels);
        if (sceneData.auxes) this.state.auxes = structuredClone(sceneData.auxes);
        if (sceneData.buses) this.state.buses = structuredClone(sceneData.buses);
        if (sceneData.stereo) this.state.stereo = structuredClone(sceneData.stereo);
        if (sceneData.effects) this.state.effects = structuredClone(sceneData.effects);
        this.applySceneLabels(targetNum);

        if (this.transport.isConnected() && req.plan.writeHardware !== false) {
          await this.sendFullStateToHardware();
          await this.transport.sendSysEx(buildSceneStoreSysEx(targetNum));
        }
      }

      restoredScenes.push(targetNum);
    }

    this.broadcastState();

    return {
      ok: true,
      restoredScenes,
      restoredGlobal,
      message: `Successfully restored ${restoredScenes.length} scene(s)${restoredGlobal ? ' and global settings' : ''}.`,
    };
  }

  private async sendFullStateToHardware(): Promise<void> {
    if (!this.transport.isConnected()) return;
    for (const ch of this.state.channels) {
      await this.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch.id - 1, ch.fader),
        'high'
      );
      await this.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch.id - 1, ch.on ? 1 : 0),
        'high'
      );
      await this.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch.id - 1, ch.pan),
        'high'
      );
    }
  }
}
