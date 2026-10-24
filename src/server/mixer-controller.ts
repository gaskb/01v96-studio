import {
  ChannelCompState,
  ChannelEQState,
  ChannelGateState,
  ClientCommand,
  InputChannelState,
  MixerState,
  OutputChannelState,
} from '../shared/types.js';
import {
  buildMeterRequest,
  buildParamChange,
  buildParamRequest,
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
    meter: 0,
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
    meter: 0,
    eq: createDefaultEQ(),
    comp: createDefaultComp(),
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
  private savedFadersBeforeWave: number[] = [];
  private sceneTitleChars: string[] = Array(16).fill(' ');
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
      selectedChannel: 1,
      activeLayer: 0,
      demoWaveActive: false,
      channels: Array.from({ length: 32 }, (_, i) => createInputChannel(i + 1)),
      auxes: Array.from({ length: 8 }, (_, i) => createOutputChannel(i + 1, 'AUX')),
      buses: Array.from({ length: 8 }, (_, i) => createOutputChannel(i + 1, 'BUS')),
      stereo: {
        ...createOutputChannel(1, 'ST'),
        name: 'STEREO L/R',
      },
    };

    for (let i = 0; i < 32; i++) {
      this.channelNameChars.set(i, (`CH${i + 1}    `).slice(0, 4).split(''));
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

    // Request live meters every 5 seconds to keep the 01V96 meter stream alive
    this.meterInterval = setInterval(() => {
      if (this.transport.isConnected() && !this.state.demoWaveActive) {
        this.transport.sendSysEx(buildMeterRequest());
      }
    }, 5000);

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
    this.transport.disconnect();
  }

  async initialSync(): Promise<void> {
    if (!this.transport.isConnected()) return;
    console.log('🔄 Synchronizing state from Yamaha 01V96 VCM...');

    // Start live meter stream
    await this.transport.sendSysEx(buildMeterRequest());

    // Query Scene Title (16 chars)
    for (let p = 0; p < 16; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0));
    }

    // Query Faders, On, Pan, Phase, Att for all 32 input channels
    for (let ch = 0; ch < 32; ch++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch));
      await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 3, 46, 0, ch)); // Solo
      for (let p = 0; p < 4; p++) {
        await this.transport.sendSysEx(buildParamRequest(MODEL_01V96, 2, 4, p, ch)); // Short Name
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

    // Sync full Channel Strip for Selected Channel (Channel 1)
    await this.syncChannelStrip(this.state.selectedChannel);
    console.log('✅ Initial synchronization complete!');
  }

  async syncChannelStrip(channelId: number): Promise<void> {
    if (!this.transport.isConnected()) return;
    const ch = Math.max(0, Math.min(31, channelId - 1));

    // EQ parameters (1..15)
    for (let p = 1; p <= 15; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, p, ch));
    }
    // Gate parameters
    for (const p of Object.values(GATE_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, p, ch));
    }
    // Comp parameters
    for (const p of Object.values(COMP_PARAM_MAP)) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, p, ch));
    }
    await this.delay(8);
    // Routing (0..10)
    for (let p = 0; p <= 10; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, p, ch));
    }
    // AUX Sends 1..8 (0..23)
    for (let p = 0; p < 24; p++) {
      await this.transport.sendSysEx(buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, p, ch));
    }
  }

  public handleIncomingMidi(msg: number[]): void {
    // Program Change (2 bytes: 0xCn, pgm)
    if (msg.length === 2 && (msg[0] & 0xf0) === 0xc0) {
      this.state.sceneNumber = msg[1] + 1;
      this.broadcastState();
      this.initialSync();
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

    // 1. Live Meter Packet (Model 0x0D, DataType 0x21)
    if (modelId === MODEL_01V96 && dataType === 0x21 && msg.length >= 71) {
      this.skipNextMeter = !this.skipNextMeter;
      if (this.skipNextMeter) return;

      const meters: Record<string, number> = {};
      const data = msg.slice(9, -1);
      for (let ch = 0; ch < 32; ch++) {
        const raw = data[2 * ch] ?? 0;
        const level = convertMeterByte(raw);
        this.state.channels[ch].meter = level;
        meters[`ch${ch + 1}`] = level;
      }
      this.broadcastCallback({ type: 'meters', meters });
      return;
    }

    if (subStatus !== 0x10 || msg.length < 14) return;

    const dataBytes = msg.slice(9, 13);
    const val = dataBytesToInt(dataBytes);

    // 2. Universal Parameters (Model 0x7F, DataType 0x01)
    if (modelId === MODEL_UNIVERSAL && dataType === 0x01) {
      if (element === EL_SCENE_TITLE && param >= 0 && param < 16) {
        this.sceneTitleChars[param] = val > 31 ? String.fromCharCode(val) : ' ';
        this.state.sceneTitle = this.sceneTitleChars.join('').trim() || 'Scene';
        this.broadcastPatch({ sceneTitle: this.state.sceneTitle });
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

    // 3. Device Specific 01V96 Parameters (Model 0x0D)
    if (modelId === MODEL_01V96) {
      // Short Channel Name (dt=2, el=4, p=0..3)
      if (dataType === 2 && element === 4 && param >= 0 && param < 4 && channel >= 0 && channel < 32) {
        const chars = this.channelNameChars.get(channel) ?? ['C', 'H', ' ', ' '];
        chars[param] = val > 31 ? String.fromCharCode(val) : ' ';
        this.channelNameChars.set(channel, chars);
        const name = chars.join('').trim() || `CH${channel + 1}`;
        this.state.channels[channel].name = name;
        this.broadcastChannelUpdate('ch', channel + 1, { name });
      }
      // Solo Channel On (dt=3, el=46, p=0)
      else if (dataType === 3 && element === 46 && param === 0 && channel >= 0 && channel < 32) {
        this.state.channels[channel].solo = val === 1;
        this.broadcastChannelUpdate('ch', channel + 1, { solo: val === 1 });
      }
      // Selected Channel on Mixer hardware (dt=4, el=9, p=24)
      else if (dataType === 4 && element === 9 && param === 24) {
        if (val >= 0 && val < 32) {
          this.state.selectedChannel = val + 1;
          this.broadcastPatch({ selectedChannel: this.state.selectedChannel });
          this.syncChannelStrip(this.state.selectedChannel);
        }
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

      case 'select_channel': {
        const id = Math.max(1, Math.min(32, cmd.id));
        this.state.selectedChannel = id;
        // Also select the channel physically on the 01V96 console!
        await this.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 9, 24, 0, id - 1));
        this.broadcastPatch({ selectedChannel: id });
        await this.syncChannelStrip(id);
        break;
      }

      case 'recall_scene': {
        const pgm = Math.max(0, Math.min(99, cmd.sceneNumber));
        this.state.sceneNumber = pgm;
        // Send standard MIDI Program Change on Channel 1 (0xC0, pgm)
        await this.transport.sendSysEx([0xc0, pgm]);
        this.broadcastPatch({ sceneNumber: pgm });
        setTimeout(() => this.initialSync(), 400);
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

    // Save current fader positions for channels 1..32
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

      // Automatically stop and restore after ~8 seconds (200 steps at 40ms) if user doesn't stop manually
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

    // Restore original faders!
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
