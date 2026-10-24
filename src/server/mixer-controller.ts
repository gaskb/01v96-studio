import {
  ChannelCompState,
  ChannelEQState,
  ChannelGateState,
  ClientCommand,
  EffectRackState,
  GEQUnitState,
  InputChannelState,
  MixerState,
  OutputChannelState,
} from '../shared/types.js';
import {
  buildMeterRequest,
  buildOutputMeterRequest,
  buildParamChange,
  buildParamRequest,
  buildSceneRecallSysEx,
  buildSceneStoreSysEx,
  COMP_PARAM_MAP,
  convertMeterByte,
  dataBytesToInt,
  EL_AUX_COMP,
  EL_AUX_EQ,
  EL_AUX_FADER,
  EL_AUX_ON,
  EL_AUX_PAN,
  EL_BUS_COMP,
  EL_BUS_EQ,
  EL_BUS_FADER,
  EL_BUS_ON,
  EL_BUS_PAN,
  EL_EFFECT,
  EL_GEQ,
  EL_INPUT_ATT,
  EL_INPUT_AUX,
  EL_INPUT_COMP,
  EL_INPUT_DELAY,
  EL_INPUT_EQ,
  EL_INPUT_FADER,
  EL_INPUT_GATE,
  EL_INPUT_ON,
  EL_INPUT_PAIR,
  EL_INPUT_PAN,
  EL_INPUT_PHASE,
  EL_INPUT_ROUTING,
  EL_SCENE_TITLE,
  EL_STEREO_COMP,
  EL_STEREO_EQ,
  EL_STEREO_FADER,
  EL_STEREO_ON,
  EL_STEREO_PAN,
  EQ_PARAM_MAP,
  GATE_PARAM_MAP,
  MODEL_01V96,
  MODEL_UNIVERSAL,
  SYSEX_END,
  SYSEX_START,
  YAMAHA_ID,
} from './protocol.js';
import { YamahaUsbTransport } from './usb-transport.js';

function createDefaultEQ(): ChannelEQState {
  return {
    on: true,
    mode: 0,
    hpfOn: false,
    lpfOn: false,
    low: { q: 41, freq: 36, gain: 0 },     // Low Shelf ~125 Hz, 0 dB
    lowMid: { q: 23, freq: 65, gain: 0 },  // Peaking ~800 Hz, 0 dB
    hiMid: { q: 23, freq: 92, gain: 0 },   // Peaking ~3.5 kHz, 0 dB
    high: { q: 41, freq: 112, gain: 0 },   // High Shelf ~10 kHz, 0 dB
  };
}

function createDefaultGate(): ChannelGateState {
  return {
    on: false,
    type: 0,
    threshold: -260,
    range: -560,
    attack: 10,
    hold: 60,
    decay: 44,
  };
}

function createDefaultComp(): ChannelCompState {
  return {
    on: false,
    type: 0,
    threshold: -200,
    ratio: 5, // 2:1
    attack: 30,
    release: 40,
    gain: 0,
    knee: 2,
  };
}

function createInputChannel(id: number): InputChannelState {
  return {
    id,
    name: `CH${id}`,
    on: true,
    solo: false,
    fader: 0,
    pan: 0,
    phase: false,
    att: 0,
    pair: false,
    meterIn: 0,
    meterOut: 0,
    grDb: 0,
    eq: createDefaultEQ(),
    gate: createDefaultGate(),
    comp: createDefaultComp(),
    routing: {
      stereo: true,
      direct: false,
      bus: [false, false, false, false, false, false, false, false],
    },
    auxSends: Array.from({ length: 8 }, () => ({
      on: true,
      pre: true,
      level: 0,
    })),
    delayOn: false,
    delayTime: 0,
    inputPatch: id - 1,
    directOutPatch: id - 1,
  };
}

function createOutputChannel(id: number, prefix: string): OutputChannelState {
  return {
    id,
    name: `${prefix}${id}`,
    on: true,
    solo: false,
    fader: 823,
    pan: 0,
    meterIn: 0,
    meterOut: 0,
    eq: createDefaultEQ(),
    comp: createDefaultComp(),
  };
}

function createEffectRack(id: number): EffectRackState {
  const defaultNames = ['REV-X HALL', 'VCM COMP 276', 'STEREO DELAY', 'VCM EQ 601'];
  return {
    id,
    name: defaultNames[id - 1] ?? `EFFECT ${id}`,
    type: id,
    bypass: false,
    mix: 100,
    params: [50, 40, 60, 30, 50, 50, 50, 50],
  };
}

function createGEQUnit(id: number): GEQUnitState {
  return {
    id,
    on: true,
    bands: Array(31).fill(0),
  };
}

/**
 * Computes real-time Post-DSP Output Level & Gain Reduction (GR) from Input Level + Channel Strip DSP
 */
export function computePostDspMeter(ch: InputChannelState, meterIn: number): { meterOut: number; grDb: number } {
  if (!ch.on || ch.fader === 0 || meterIn === 0) {
    return { meterOut: 0, grDb: 0 };
  }

  // Approximate input signal in dBFS (-60 .. 0 dB)
  const inDb = -60 + (meterIn / 255) * 60 + ch.att / 10;

  let grDb = 0;

  // 1. Gate attenuation if input is below gate threshold
  if (ch.gate.on) {
    const gateThreshDb = ch.gate.threshold / 10;
    if (inDb < gateThreshDb) {
      const rangeDb = Math.abs(ch.gate.range / 10);
      grDb += Math.min(rangeDb, (gateThreshDb - inDb) * 2.5);
    }
  }

  // 2. Compressor Gain Reduction & Makeup Gain
  let compMakeupDb = 0;
  if (ch.comp.on) {
    const compThreshDb = ch.comp.threshold / 10;
    const ratios = [1, 1.1, 1.3, 1.5, 1.7, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 20, 100];
    const ratio = ratios[ch.comp.ratio] ?? 2;
    if (inDb > compThreshDb) {
      const overDb = inDb - compThreshDb;
      const compGr = overDb * (1 - 1 / ratio);
      grDb += compGr;
    }
    compMakeupDb = ch.comp.gain / 10;
  }

  // 3. EQ average energy contribution
  let eqBoostDb = 0;
  if (ch.eq.on) {
    eqBoostDb =
      (ch.eq.low.gain + ch.eq.lowMid.gain + ch.eq.hiMid.gain + ch.eq.high.gain) / 40; // average in dB
  }

  // 4. Fader gain relative to unity (823 = 0 dB)
  const faderDb = ch.fader >= 423 ? (ch.fader - 823) / 20 : -20 - ((423 - ch.fader) / 423) * 40;

  const outDb = inDb - grDb + compMakeupDb + eqBoostDb + faderDb;
  const normOut = Math.max(0, Math.min(255, Math.round(((outDb + 60) / 60) * 255)));

  return {
    meterOut: normOut,
    grDb: Math.min(24, Math.round(grDb * 10) / 10),
  };
}

const INV_EQ_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(EQ_PARAM_MAP).map(([k, v]) => [v, k])
);
const INV_GATE_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(GATE_PARAM_MAP).map(([k, v]) => [v, k])
);
const INV_COMP_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(COMP_PARAM_MAP).map(([k, v]) => [v, k])
);

export class MixerController {
  public state: MixerState;
  private transport: YamahaUsbTransport;
  private broadcastCallback: (msg: unknown) => void;
  private meterInterval: NodeJS.Timeout | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private demoWaveTimer: NodeJS.Timeout | null = null;
  private sceneSyncDebounceTimer: NodeJS.Timeout | null = null;
  private savedFadersBeforeWave: number[] = [];
  private sceneTitleChars: string[] = Array(16).fill(' ');
  private effectTitleChars: Map<number, string[]> = new Map();
  private channelNameChars: Map<number, string[]> = new Map();
  private skipNextMeter = false;

  constructor(broadcastCallback: (msg: unknown) => void) {
    this.broadcastCallback = broadcastCallback;
    this.transport = new YamahaUsbTransport();

    this.state = {
      connected: false,
      connectionMode: 'simulated',
      deviceName: 'YAMAHA 01V96 VCM',
      sceneNumber: 1,
      sceneTitle: 'Vintage',
      sceneModified: false,
      selectedChannel: 1,
      dualChannelView: false,
      activeLayer: 0,
      demoWaveActive: false,
      channels: Array.from({ length: 32 }, (_, i) => createInputChannel(i + 1)),
      auxes: Array.from({ length: 8 }, (_, i) => createOutputChannel(i + 1, 'AUX')),
      buses: Array.from({ length: 8 }, (_, i) => createOutputChannel(i + 1, 'BUS')),
      stereo: {
        ...createOutputChannel(1, 'ST'),
        name: 'STEREO L/R',
      },
      effects: Array.from({ length: 4 }, (_, i) => createEffectRack(i + 1)),
      geqs: Array.from({ length: 4 }, (_, i) => createGEQUnit(i + 1)),
      setup: {
        lcdScreenNo: 0,
        lcdTabNo: 0,
        meterInputPoint: 1,  // PRE FADER
        meterOutputPoint: 2, // POST ON
        peakHold: false,
        wordClockMaster: 1,  // 48 kHz Internal
        brightness: 64,
        omniOutPatch: [1, 2, 3, 4],
      },
    };

    for (let i = 0; i < 32; i++) {
      this.channelNameChars.set(i, (`CH${i + 1}    `).slice(0, 4).split(''));
    }
    for (let i = 0; i < 4; i++) {
      this.effectTitleChars.set(i, Array(16).fill(' '));
    }

    this.transport.onMessage((msg) => this.handleIncomingMidi(msg));
    this.transport.onStatusChange((connected) => {
      this.state.connected = connected;
      this.state.connectionMode = connected ? 'usb-direct' : 'simulated';
      this.broadcastState();
    });
  }

  start(): void {
    const ok = this.transport.connect();
    if (ok) {
      this.initialSync();
    }

    // Request live meters & poll Scene Title/Number every 3.5 seconds so hardware scene recalls are always caught
    this.meterInterval = setInterval(() => {
      if (this.transport.isConnected() && !this.state.demoWaveActive) {
        this.transport.sendSysEx(buildMeterRequest());
        this.transport.sendSysEx(buildOutputMeterRequest());
      }
    }, 3500);

    // Auto-reconnect USB if unplugged/replugged
    this.reconnectInterval = setInterval(() => {
      if (!this.transport.isConnected()) {
        if (this.transport.connect()) {
          this.initialSync();
        }
      }
    }, 4000);
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

    await this.transport.sendSysEx(buildMeterRequest());
    await this.transport.sendSysEx(buildOutputMeterRequest());

    // Query Scene Title (16 chars)
    for (let p = 0; p < 16; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0));
    }

    // Query Faders, On, Pan, Phase, Att, Patch for all 32 input channels
    for (let ch = 0; ch < 32; ch++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 3, 46, 0, ch)); // Solo
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 1, 0, ch));  // Input Patch
      for (let p = 0; p < 4; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 4, p, ch)); // Short Name
      }
      await this.delay(8);
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
    const pairCh = this.state.selectedChannel % 2 === 1 ? this.state.selectedChannel + 1 : this.state.selectedChannel - 1;
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
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, p, ch));
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
    // 1. Standard MIDI Program Change (0xCn, pgm) -> Scene changed on mixer!
    if (msg.length === 2 && (msg[0] & 0xf0) === 0xc0) {
      this.state.sceneNumber = msg[1];
      this.broadcastPatch({ sceneNumber: this.state.sceneNumber });
      this.scheduleSceneResync();
      return;
    }

    if (msg.length < 10 || msg[0] !== SYSEX_START || msg[1] !== YAMAHA_ID || msg[msg.length - 1] !== SYSEX_END) {
      return;
    }

    const subStatus = msg[2] & 0xf0;
    const modelId = msg[4];
    const dataType = msg[5];
    const element = msg[6];
    const param = msg[7];
    const channel = msg[8];

    // 2. Universal Scene Recall / Store notification (Model 0x7F, DataType 0x10)
    if (modelId === MODEL_UNIVERSAL && dataType === 0x10) {
      const sceneNo = msg.length >= 11 ? ((msg[8] & 0x7f) << 7) | (msg[9] & 0x7f) : msg[8];
      this.state.sceneNumber = sceneNo;
      this.broadcastPatch({ sceneNumber: sceneNo });
      this.scheduleSceneResync();
      return;
    }

    // 3. Live Meter Packet (Model 0x0D, DataType 0x21)
    if (modelId === MODEL_01V96 && dataType === 0x21 && msg.length >= 25) {
      if (element === 0 && msg.length >= 71) {
        this.skipNextMeter = !this.skipNextMeter;
        if (this.skipNextMeter) return;

        const metersIn: Record<string, number> = {};
        const metersOut: Record<string, number> = {};
        const grs: Record<string, number> = {};
        const data = msg.slice(9, -1);

        let stereoLSum = 0;
        for (let ch = 0; ch < 32; ch++) {
          const raw = data[2 * ch] ?? 0;
          const levelIn = convertMeterByte(raw);
          const chObj = this.state.channels[ch];
          chObj.meterIn = levelIn;

          const { meterOut, grDb } = computePostDspMeter(chObj, levelIn);
          chObj.meterOut = meterOut;
          chObj.grDb = grDb;

          metersIn[`ch${ch + 1}`] = levelIn;
          metersOut[`ch${ch + 1}`] = meterOut;
          grs[`ch${ch + 1}`] = grDb;

          if (chObj.routing.stereo && chObj.on) {
            stereoLSum += Math.pow(meterOut / 255, 2);
          }
        }

        // Compute Stereo Master meter if not explicitly received
        const stLevel = Math.min(
          255,
          Math.round(Math.sqrt(stereoLSum) * 255 * (this.state.stereo.fader / 823))
        );
        this.state.stereo.meterIn = stLevel;
        this.state.stereo.meterOut = this.state.stereo.on ? stLevel : 0;

        this.broadcastCallback({
          type: 'meters',
          metersIn,
          metersOut,
          grs,
          stereoMeter: this.state.stereo.meterOut,
        });
      }
      return;
    }

    if (subStatus !== 0x10 || msg.length < 14) return;

    const dataBytes = msg.slice(9, 13);
    const val = dataBytesToInt(dataBytes);

    // 4. Universal Parameters (Model 0x7F, DataType 0x01)
    if (modelId === MODEL_UNIVERSAL && dataType === 0x01) {
      if (element === EL_SCENE_TITLE && param >= 0 && param < 16) {
        this.sceneTitleChars[param] = val > 31 ? String.fromCharCode(val) : ' ';
        this.state.sceneTitle = this.sceneTitleChars.join('').trim() || 'Scene';
        this.broadcastPatch({ sceneTitle: this.state.sceneTitle });
        return;
      }

      // Effect Rack 1..4 (Element 88)
      if (element === EL_EFFECT && channel >= 0 && channel < 4) {
        const fx = this.state.effects[channel];
        if (param >= 0 && param < 16) {
          const chars = this.effectTitleChars.get(channel) ?? Array(16).fill(' ');
          chars[param] = val > 31 ? String.fromCharCode(val) : ' ';
          this.effectTitleChars.set(channel, chars);
          fx.name = chars.join('').trim() || `EFFECT ${channel + 1}`;
        } else if (param >= 16 && param < 24) {
          fx.params[param - 16] = val;
        } else if (param === 48) {
          fx.mix = val;
        } else if (param === 49) {
          fx.type = val;
        } else if (param === 52) {
          fx.bypass = val === 1;
        }
        this.broadcastPatch({ effects: this.state.effects });
        return;
      }

      // GEQ 1..4 (Element 87)
      if (element === EL_GEQ && channel >= 0 && channel < 4) {
        const geq = this.state.geqs[channel];
        if (param === 0) {
          geq.on = val === 1;
        } else if (param >= 4 && param <= 34) {
          geq.bands[param - 4] = val;
        }
        this.broadcastPatch({ geqs: this.state.geqs });
        return;
      }

      // Input channel parameters
      if (channel >= 0 && channel < 32) {
        const chObj = this.state.channels[channel];
        switch (element) {
          case EL_INPUT_FADER:
            if (param === 0) {
              chObj.fader = val;
              this.broadcastChannelUpdate('ch', channel + 1, { fader: val });
            }
            break;
          case EL_INPUT_ON:
            if (param === 0) {
              chObj.on = val === 1;
              this.broadcastChannelUpdate('ch', channel + 1, { on: chObj.on });
            }
            break;
          case EL_INPUT_PAN:
            if (param === 0) {
              chObj.pan = val;
              this.broadcastChannelUpdate('ch', channel + 1, { pan: val });
            }
            break;
          case EL_INPUT_PHASE:
            if (param === 0) {
              chObj.phase = val === 1;
              this.broadcastChannelUpdate('ch', channel + 1, { phase: chObj.phase });
            }
            break;
          case EL_INPUT_ATT:
            if (param === 0) {
              chObj.att = val;
              this.broadcastChannelUpdate('ch', channel + 1, { att: val });
            }
            break;
          case EL_INPUT_PAIR:
            if (param === 0) {
              chObj.pair = val === 1;
              this.broadcastChannelUpdate('ch', channel + 1, { pair: chObj.pair });
            }
            break;
          case EL_INPUT_EQ:
            this.applyEQParam(chObj.eq, param, val);
            this.broadcastChannelUpdate('ch', channel + 1, { eq: chObj.eq });
            break;
          case EL_INPUT_GATE:
            this.applyGateParam(chObj.gate, param, val);
            this.broadcastChannelUpdate('ch', channel + 1, { gate: chObj.gate });
            break;
          case EL_INPUT_COMP:
            this.applyCompParam(chObj.comp, param, val);
            this.broadcastChannelUpdate('ch', channel + 1, { comp: chObj.comp });
            break;
          case EL_INPUT_ROUTING:
            if (param === 0) chObj.routing.stereo = val === 1;
            else if (param === 2) chObj.routing.direct = val === 1;
            else if (param >= 3 && param <= 10) chObj.routing.bus[param - 3] = val === 1;
            this.broadcastChannelUpdate('ch', channel + 1, { routing: chObj.routing });
            break;
          case EL_INPUT_AUX:
            if (param >= 0 && param < 24) {
              const auxIdx = Math.floor(param / 3);
              const sub = param % 3;
              if (sub === 0) chObj.auxSends[auxIdx].on = val === 1;
              else if (sub === 1) chObj.auxSends[auxIdx].pre = val === 1;
              else if (sub === 2) chObj.auxSends[auxIdx].level = val;
              this.broadcastChannelUpdate('ch', channel + 1, { auxSends: chObj.auxSends });
            }
            break;
          case EL_INPUT_DELAY:
            if (param === 0) chObj.delayOn = val === 1;
            else if (param === 3) chObj.delayTime = val;
            this.broadcastChannelUpdate('ch', channel + 1, {
              delayOn: chObj.delayOn,
              delayTime: chObj.delayTime,
            });
            break;
        }
      }

      // AUX 1..8
      if (channel >= 0 && channel < 8) {
        const auxObj = this.state.auxes[channel];
        if (element === EL_AUX_FADER && param === 0) {
          auxObj.fader = val;
          this.broadcastChannelUpdate('aux', channel + 1, { fader: val });
        } else if (element === EL_AUX_ON && param === 0) {
          auxObj.on = val === 1;
          this.broadcastChannelUpdate('aux', channel + 1, { on: auxObj.on });
        } else if (element === EL_AUX_PAN && param === 0) {
          auxObj.pan = val;
          this.broadcastChannelUpdate('aux', channel + 1, { pan: val });
        } else if (element === EL_AUX_EQ) {
          this.applyEQParam(auxObj.eq, param, val);
          this.broadcastChannelUpdate('aux', channel + 1, { eq: auxObj.eq });
        } else if (element === EL_AUX_COMP) {
          this.applyCompParam(auxObj.comp, param, val);
          this.broadcastChannelUpdate('aux', channel + 1, { comp: auxObj.comp });
        }
      }

      // BUS 1..8
      if (channel >= 0 && channel < 8) {
        const busObj = this.state.buses[channel];
        if (element === EL_BUS_FADER && param === 0) {
          busObj.fader = val;
          this.broadcastChannelUpdate('bus', channel + 1, { fader: val });
        } else if (element === EL_BUS_ON && param === 0) {
          busObj.on = val === 1;
          this.broadcastChannelUpdate('bus', channel + 1, { on: busObj.on });
        } else if (element === EL_BUS_PAN && param === 0) {
          busObj.pan = val;
          this.broadcastChannelUpdate('bus', channel + 1, { pan: val });
        } else if (element === EL_BUS_EQ) {
          this.applyEQParam(busObj.eq, param, val);
          this.broadcastChannelUpdate('bus', channel + 1, { eq: busObj.eq });
        } else if (element === EL_BUS_COMP) {
          this.applyCompParam(busObj.comp, param, val);
          this.broadcastChannelUpdate('bus', channel + 1, { comp: busObj.comp });
        }
      }

      // STEREO OUT
      if (element === EL_STEREO_FADER && param === 0) {
        this.state.stereo.fader = val;
        this.broadcastChannelUpdate('stereo', 1, { fader: val });
      } else if (element === EL_STEREO_ON && param === 0) {
        this.state.stereo.on = val === 1;
        this.broadcastChannelUpdate('stereo', 1, { on: this.state.stereo.on });
      } else if (element === EL_STEREO_PAN && param === 0) {
        this.state.stereo.pan = val;
        this.broadcastChannelUpdate('stereo', 1, { pan: val });
      } else if (element === EL_STEREO_EQ) {
        this.applyEQParam(this.state.stereo.eq, param, val);
        this.broadcastChannelUpdate('stereo', 1, { eq: this.state.stereo.eq });
      } else if (element === EL_STEREO_COMP) {
        this.applyCompParam(this.state.stereo.comp, param, val);
        this.broadcastChannelUpdate('stereo', 1, { comp: this.state.stereo.comp });
      }
    }

    // 5. Device Specific 01V96 Parameters (Model 0x0D)
    if (modelId === MODEL_01V96) {
      // Input Patch (dt=2, el=1, p=0)
      if (dataType === 2 && element === 1 && param === 0 && channel >= 0 && channel < 32) {
        this.state.channels[channel].inputPatch = val;
        this.broadcastChannelUpdate('ch', channel + 1, { inputPatch: val });
      }
      // Short Channel Name (dt=2, el=4, p=0..3)
      else if (dataType === 2 && element === 4 && param >= 0 && param < 4 && channel >= 0 && channel < 32) {
        const chars = this.channelNameChars.get(channel) ?? ['C', 'H', ' ', ' '];
        chars[param] = val > 31 ? String.fromCharCode(val) : ' ';
        this.channelNameChars.set(channel, chars);
        const name = chars.join('').trim() || `CH${channel + 1}`;
        this.state.channels[channel].name = name;
        this.broadcastChannelUpdate('ch', channel + 1, { name });
      }
      // Omni Out Patch (dt=2, el=6, p=0)
      else if (dataType === 2 && element === 6 && param === 0 && channel >= 0 && channel < 4) {
        this.state.setup.omniOutPatch[channel] = val;
        this.broadcastPatch({ setup: this.state.setup });
      }
      // Solo Channel On (dt=3, el=46, p=0)
      else if (dataType === 3 && element === 46 && param === 0 && channel >= 0 && channel < 32) {
        this.state.channels[channel].solo = val === 1;
        this.broadcastChannelUpdate('ch', channel + 1, { solo: val === 1 });
      }
      // LCD Screen Change on Mixer (dt=4, el=1, p=0)
      else if (dataType === 4 && element === 1 && param === 0) {
        this.state.setup.lcdScreenNo = val;
        this.broadcastPatch({ setup: this.state.setup });
      }
      // Selected Channel on Mixer hardware (dt=4, el=9, p=24)
      else if (dataType === 4 && element === 9 && param === 24) {
        if (val >= 0 && val < 32) {
          this.state.selectedChannel = val + 1;
          this.broadcastPatch({ selectedChannel: this.state.selectedChannel });
          this.syncChannelStrip(this.state.selectedChannel);
        }
      }
      // Scene Memory Now / Recall on Mixer (dt=4, el=10, p=0 or p=1)
      else if (dataType === 4 && element === 10 && (param === 0 || param === 1)) {
        this.state.sceneNumber = val;
        this.broadcastPatch({ sceneNumber: val });
        this.scheduleSceneResync();
      }
    }
  }

  public async handleClientCommand(cmd: ClientCommand): Promise<void> {
    switch (cmd.type) {
      case 'set_fader': {
        const ch = cmd.id - 1;
        const val = Math.max(0, Math.min(1023, Math.round(cmd.value)));
        if (cmd.target === 'ch' && this.state.channels[ch]) {
          this.state.channels[ch].fader = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch, val));
          this.broadcastChannelUpdate('ch', cmd.id, { fader: val });
        } else if (cmd.target === 'aux' && this.state.auxes[ch]) {
          this.state.auxes[ch].fader = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_FADER, 0, ch, val));
          this.broadcastChannelUpdate('aux', cmd.id, { fader: val });
        } else if (cmd.target === 'bus' && this.state.buses[ch]) {
          this.state.buses[ch].fader = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_FADER, 0, ch, val));
          this.broadcastChannelUpdate('bus', cmd.id, { fader: val });
        } else if (cmd.target === 'stereo') {
          this.state.stereo.fader = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_FADER, 0, 0, val));
          this.broadcastChannelUpdate('stereo', 1, { fader: val });
        }
        break;
      }

      case 'set_on': {
        const ch = cmd.id - 1;
        const numVal = cmd.value ? 1 : 0;
        if (cmd.target === 'ch' && this.state.channels[ch]) {
          this.state.channels[ch].on = cmd.value;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch, numVal));
          this.broadcastChannelUpdate('ch', cmd.id, { on: cmd.value });
        } else if (cmd.target === 'aux' && this.state.auxes[ch]) {
          this.state.auxes[ch].on = cmd.value;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_ON, 0, ch, numVal));
          this.broadcastChannelUpdate('aux', cmd.id, { on: cmd.value });
        } else if (cmd.target === 'bus' && this.state.buses[ch]) {
          this.state.buses[ch].on = cmd.value;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_ON, 0, ch, numVal));
          this.broadcastChannelUpdate('bus', cmd.id, { on: cmd.value });
        } else if (cmd.target === 'stereo') {
          this.state.stereo.on = cmd.value;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_ON, 0, 0, numVal));
          this.broadcastChannelUpdate('stereo', 1, { on: cmd.value });
        }
        break;
      }

      case 'set_solo': {
        const ch = cmd.id - 1;
        if (this.state.channels[ch]) {
          this.state.channels[ch].solo = cmd.value;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 46, 0, ch, cmd.value ? 1 : 0));
          this.broadcastChannelUpdate('ch', cmd.id, { solo: cmd.value });
        }
        break;
      }

      case 'set_pan': {
        const ch = cmd.id - 1;
        const val = Math.max(-63, Math.min(63, Math.round(cmd.value)));
        if (cmd.target === 'ch' && this.state.channels[ch]) {
          this.state.channels[ch].pan = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch, val));
          this.broadcastChannelUpdate('ch', cmd.id, { pan: val });
        } else if (cmd.target === 'aux' && this.state.auxes[ch]) {
          this.state.auxes[ch].pan = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_PAN, 0, ch, val));
          this.broadcastChannelUpdate('aux', cmd.id, { pan: val });
        } else if (cmd.target === 'bus' && this.state.buses[ch]) {
          this.state.buses[ch].pan = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_PAN, 0, ch, val));
          this.broadcastChannelUpdate('bus', cmd.id, { pan: val });
        } else if (cmd.target === 'stereo') {
          this.state.stereo.pan = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_PAN, 0, 0, val));
          this.broadcastChannelUpdate('stereo', 1, { pan: val });
        }
        break;
      }

      case 'set_phase': {
        const ch = cmd.id - 1;
        if (this.state.channels[ch]) {
          this.state.channels[ch].phase = cmd.value;
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch, cmd.value ? 1 : 0)
          );
          this.broadcastChannelUpdate('ch', cmd.id, { phase: cmd.value });
        }
        break;
      }

      case 'set_att': {
        const ch = cmd.id - 1;
        const val = Math.max(-960, Math.min(180, Math.round(cmd.value)));
        if (this.state.channels[ch]) {
          this.state.channels[ch].att = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch, val));
          this.broadcastChannelUpdate('ch', cmd.id, { att: val });
        }
        break;
      }

      case 'set_pair': {
        const ch = cmd.id - 1;
        if (this.state.channels[ch]) {
          this.state.channels[ch].pair = cmd.value;
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch, cmd.value ? 1 : 0)
          );
          this.broadcastChannelUpdate('ch', cmd.id, { pair: cmd.value });
        }
        break;
      }

      case 'set_name': {
        const ch = cmd.id - 1;
        if (this.state.channels[ch]) {
          const clean = cmd.name.slice(0, 4).padEnd(4, ' ');
          this.state.channels[ch].name = cmd.name.slice(0, 4).trim() || `CH${cmd.id}`;
          for (let p = 0; p < 4; p++) {
            await this.transport.sendSysEx(
              buildParamChange(MODEL_01V96, 2, 4, p, ch, clean.charCodeAt(p))
            );
          }
          this.broadcastChannelUpdate('ch', cmd.id, { name: this.state.channels[ch].name });
        }
        break;
      }

      case 'set_eq': {
        const ch = cmd.id - 1;
        const paramIdx = EQ_PARAM_MAP[cmd.param];
        if (paramIdx === undefined) break;
        const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);

        if (cmd.target === 'ch' && this.state.channels[ch]) {
          this.applyEQParam(this.state.channels[ch].eq, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, paramIdx, ch, numVal)
          );
          this.broadcastChannelUpdate('ch', cmd.id, { eq: this.state.channels[ch].eq });
        } else if (cmd.target === 'aux' && this.state.auxes[ch]) {
          this.applyEQParam(this.state.auxes[ch].eq, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_EQ, paramIdx, ch, numVal)
          );
          this.broadcastChannelUpdate('aux', cmd.id, { eq: this.state.auxes[ch].eq });
        } else if (cmd.target === 'bus' && this.state.buses[ch]) {
          this.applyEQParam(this.state.buses[ch].eq, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_EQ, paramIdx, ch, numVal)
          );
          this.broadcastChannelUpdate('bus', cmd.id, { eq: this.state.buses[ch].eq });
        } else if (cmd.target === 'stereo') {
          this.applyEQParam(this.state.stereo.eq, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_EQ, paramIdx, 0, numVal)
          );
          this.broadcastChannelUpdate('stereo', 1, { eq: this.state.stereo.eq });
        }
        break;
      }

      case 'set_gate': {
        const ch = cmd.id - 1;
        const paramIdx = GATE_PARAM_MAP[cmd.param];
        if (paramIdx === undefined || !this.state.channels[ch]) break;
        const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
        this.applyGateParam(this.state.channels[ch].gate, paramIdx, numVal);
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, paramIdx, ch, numVal)
        );
        this.broadcastChannelUpdate('ch', cmd.id, { gate: this.state.channels[ch].gate });
        break;
      }

      case 'set_comp': {
        const ch = cmd.id - 1;
        const paramIdx = COMP_PARAM_MAP[cmd.param];
        if (paramIdx === undefined) break;
        const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);

        if (cmd.target === 'ch' && this.state.channels[ch]) {
          this.applyCompParam(this.state.channels[ch].comp, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, paramIdx, ch, numVal)
          );
          this.broadcastChannelUpdate('ch', cmd.id, { comp: this.state.channels[ch].comp });
        } else if (cmd.target === 'stereo') {
          this.applyCompParam(this.state.stereo.comp, paramIdx, numVal);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_COMP, paramIdx, 0, numVal)
          );
          this.broadcastChannelUpdate('stereo', 1, { comp: this.state.stereo.comp });
        }
        break;
      }

      case 'set_routing': {
        const ch = cmd.id - 1;
        const chObj = this.state.channels[ch];
        if (!chObj) break;
        const numVal = cmd.value ? 1 : 0;
        let paramIdx = 0;
        if (cmd.target === 'stereo') {
          chObj.routing.stereo = cmd.value;
          paramIdx = 0;
        } else if (cmd.target === 'direct') {
          chObj.routing.direct = cmd.value;
          paramIdx = 2;
        } else if (cmd.target === 'bus' && cmd.busIndex !== undefined) {
          chObj.routing.bus[cmd.busIndex] = cmd.value;
          paramIdx = 3 + cmd.busIndex;
        }
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, paramIdx, ch, numVal)
        );
        this.broadcastChannelUpdate('ch', cmd.id, { routing: chObj.routing });
        break;
      }

      case 'set_aux_send': {
        const ch = cmd.chId - 1;
        const auxIdx = cmd.auxId - 1;
        const chObj = this.state.channels[ch];
        if (!chObj || !chObj.auxSends[auxIdx]) break;

        let sub = 0;
        let numVal = 0;
        if (cmd.param === 'on') {
          sub = 0;
          chObj.auxSends[auxIdx].on = Boolean(cmd.value);
          numVal = cmd.value ? 1 : 0;
        } else if (cmd.param === 'pre') {
          sub = 1;
          chObj.auxSends[auxIdx].pre = Boolean(cmd.value);
          numVal = cmd.value ? 1 : 0;
        } else if (cmd.param === 'level') {
          sub = 2;
          numVal = Math.max(0, Math.min(1023, Math.round(Number(cmd.value))));
          chObj.auxSends[auxIdx].level = numVal;
        }
        const paramIdx = auxIdx * 3 + sub;
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, paramIdx, ch, numVal)
        );
        this.broadcastChannelUpdate('ch', cmd.chId, { auxSends: chObj.auxSends });
        break;
      }

      case 'set_delay': {
        const ch = cmd.id - 1;
        const chObj = this.state.channels[ch];
        if (!chObj) break;
        chObj.delayOn = cmd.on;
        chObj.delayTime = Math.max(0, Math.min(1000, Math.round(cmd.time)));
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 0, ch, cmd.on ? 1 : 0)
        );
        await this.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 3, ch, chObj.delayTime)
        );
        this.broadcastChannelUpdate('ch', cmd.id, {
          delayOn: chObj.delayOn,
          delayTime: chObj.delayTime,
        });
        break;
      }

      case 'select_channel': {
        const id = Math.max(1, Math.min(32, cmd.id));
        this.state.selectedChannel = id;
        await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 9, 24, 0, id - 1));
        this.broadcastPatch({ selectedChannel: id });
        await this.syncChannelStrip(id);
        const pairCh = id % 2 === 1 ? id + 1 : id - 1;
        if (pairCh >= 1 && pairCh <= 32) {
          await this.syncChannelStrip(pairCh);
        }
        break;
      }

      case 'set_dual_view': {
        this.state.dualChannelView = cmd.enabled;
        this.broadcastPatch({ dualChannelView: cmd.enabled });
        break;
      }

      case 'recall_scene': {
        const pgm = Math.max(0, Math.min(99, cmd.sceneNumber));
        this.state.sceneNumber = pgm;
        await this.transport.sendSysEx(buildSceneRecallSysEx(pgm));
        await this.transport.sendSysEx([0xc0, pgm]);
        this.broadcastPatch({ sceneNumber: pgm });
        this.scheduleSceneResync();
        break;
      }

      case 'store_scene': {
        const pgm = Math.max(0, Math.min(99, cmd.sceneNumber));
        if (cmd.title) {
          const clean = cmd.title.slice(0, 16).padEnd(16, ' ');
          this.state.sceneTitle = cmd.title.slice(0, 16).trim();
          for (let p = 0; p < 16; p++) {
            await this.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0, clean.charCodeAt(p))
            );
          }
        }
        await this.transport.sendSysEx(buildSceneStoreSysEx(pgm));
        this.state.sceneNumber = pgm;
        this.broadcastPatch({ sceneNumber: pgm, sceneTitle: this.state.sceneTitle });
        break;
      }

      case 'set_effect': {
        const fxIdx = Math.max(0, Math.min(3, cmd.rackId - 1));
        const fx = this.state.effects[fxIdx];
        if (!fx) break;
        const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
        if (cmd.param === 'bypass') {
          fx.bypass = Boolean(cmd.value);
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, fxIdx, numVal));
        } else if (cmd.param === 'mix') {
          fx.mix = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 48, fxIdx, numVal));
        } else if (cmd.param === 'type') {
          fx.type = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 49, fxIdx, numVal));
        } else if (cmd.param.startsWith('param')) {
          const pNo = Number(cmd.param.slice(5)) - 1;
          if (pNo >= 0 && pNo < 8) {
            fx.params[pNo] = numVal;
            await this.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 16 + pNo, fxIdx, numVal)
            );
          }
        }
        this.broadcastPatch({ effects: this.state.effects });
        break;
      }

      case 'set_geq': {
        const uIdx = Math.max(0, Math.min(3, cmd.unitId - 1));
        const geq = this.state.geqs[uIdx];
        if (!geq) break;
        if (cmd.param === 'on') {
          geq.on = Boolean(cmd.value);
          await this.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 0, uIdx, geq.on ? 1 : 0)
          );
        } else if (cmd.param === 'flat') {
          geq.bands.fill(0);
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 3, uIdx, 1));
        } else if (cmd.param === 'band' && cmd.bandIndex !== undefined) {
          const b = Math.max(0, Math.min(30, cmd.bandIndex));
          const val = Math.max(-150, Math.min(150, Math.round(Number(cmd.value))));
          geq.bands[b] = val;
          await this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 4 + b, uIdx, val));
        }
        this.broadcastPatch({ geqs: this.state.geqs });
        break;
      }

      case 'set_input_patch': {
        const ch = Math.max(0, Math.min(31, cmd.chId - 1));
        this.state.channels[ch].inputPatch = cmd.sourcePort;
        await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 2, 1, 0, ch, cmd.sourcePort));
        this.broadcastChannelUpdate('ch', cmd.chId, { inputPatch: cmd.sourcePort });
        break;
      }

      case 'set_omni_patch': {
        const omni = Math.max(0, Math.min(3, cmd.omniId - 1));
        this.state.setup.omniOutPatch[omni] = cmd.sourceBus;
        await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 2, 6, 0, omni, cmd.sourceBus));
        this.broadcastPatch({ setup: this.state.setup });
        break;
      }

      case 'set_lcd_screen': {
        this.state.setup.lcdScreenNo = cmd.screenNo;
        await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 1, 0, 0, cmd.screenNo));
        if (cmd.tabNo !== undefined) {
          this.state.setup.lcdTabNo = cmd.tabNo;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 1, 4, 0, cmd.tabNo));
        }
        this.broadcastPatch({ setup: this.state.setup });
        break;
      }

      case 'set_setup_param': {
        const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
        if (cmd.param === 'meterInputPoint') {
          this.state.setup.meterInputPoint = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 0, 0, numVal));
        } else if (cmd.param === 'meterOutputPoint') {
          this.state.setup.meterOutputPoint = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 1, 0, numVal));
        } else if (cmd.param === 'peakHold') {
          this.state.setup.peakHold = Boolean(cmd.value);
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 6, 0, numVal));
        } else if (cmd.param === 'wordClockMaster') {
          this.state.setup.wordClockMaster = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 35, 0, 0, numVal));
        } else if (cmd.param === 'brightness') {
          this.state.setup.brightness = numVal;
          await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 59, 0, 0, numVal));
        }
        this.broadcastPatch({ setup: this.state.setup });
        break;
      }

      case 'sync_channel_strip': {
        await this.syncChannelStrip(cmd.id);
        break;
      }

      case 'sync_all': {
        await this.initialSync();
        this.broadcastState();
        break;
      }

      case 'trigger_demo_wave': {
        if (cmd.mode === 'stop' || this.state.demoWaveActive) {
          await this.stopDemoWave();
        } else {
          await this.startDemoWave(cmd.mode ?? 'sine');
        }
        break;
      }
    }
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
          this.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch, val));
        }
      }

      this.broadcastCallback({ type: 'wave_frame', faders: faderUpdates });

      if (step >= 180) {
        await this.stopDemoWave();
      }
    }, 40);
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

  private applyEQParam(eq: ChannelEQState, paramIdx: number, val: number): void {
    const key = INV_EQ_MAP[paramIdx];
    switch (key) {
      case 'mode': eq.mode = val; break;
      case 'on': eq.on = val === 1; break;
      case 'hpfOn': eq.hpfOn = val === 1; break;
      case 'lpfOn': eq.lpfOn = val === 1; break;
      case 'lowQ': eq.low.q = val; break;
      case 'lowF': eq.low.freq = val; break;
      case 'lowG': eq.low.gain = val; break;
      case 'lowMidQ': eq.lowMid.q = val; break;
      case 'lowMidF': eq.lowMid.freq = val; break;
      case 'lowMidG': eq.lowMid.gain = val; break;
      case 'hiMidQ': eq.hiMid.q = val; break;
      case 'hiMidF': eq.hiMid.freq = val; break;
      case 'hiMidG': eq.hiMid.gain = val; break;
      case 'highQ': eq.high.q = val; break;
      case 'highF': eq.high.freq = val; break;
      case 'highG': eq.high.gain = val; break;
    }
  }

  private applyGateParam(gate: ChannelGateState, paramIdx: number, val: number): void {
    const key = INV_GATE_MAP[paramIdx];
    switch (key) {
      case 'on': gate.on = val === 1; break;
      case 'type': gate.type = val; break;
      case 'attack': gate.attack = val; break;
      case 'range': gate.range = val; break;
      case 'hold': gate.hold = val; break;
      case 'decay': gate.decay = val; break;
      case 'threshold': gate.threshold = val; break;
    }
  }

  private applyCompParam(comp: ChannelCompState, paramIdx: number, val: number): void {
    const key = INV_COMP_MAP[paramIdx];
    switch (key) {
      case 'on': comp.on = val === 1; break;
      case 'type': comp.type = val; break;
      case 'attack': comp.attack = val; break;
      case 'release': comp.release = val; break;
      case 'ratio': comp.ratio = val; break;
      case 'gain': comp.gain = val; break;
      case 'knee': comp.knee = val; break;
      case 'threshold': comp.threshold = val; break;
    }
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
    this.broadcastCallback({ type: 'channel_update', target, id, changes });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
