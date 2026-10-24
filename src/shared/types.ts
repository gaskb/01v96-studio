export const APP_VERSION = '0.1.0';
export const UI_VERSION = '0.1.0';
export const API_VERSION = '0.1.0';

export type MixerLayer =
  | 'ch1-16'
  | 'ch17-32'
  | 'stin-aux'
  | 'bus-master';

export interface EQBandState {
  q: number;       // 0..42 (0 = 0.10, 40 = 10.0, 41 = Low/High Shelf, 42 = HPF/LPF)
  freq: number;    // 0..119 (21.2 Hz .. 20.0 kHz logarithmic)
  gain: number;    // -180..+180 (-18.0 dB .. +18.0 dB)
}

export interface ChannelEQState {
  on: boolean;
  mode: number;    // 0 = Type I, 1 = Type II
  hpfOn: boolean;
  lpfOn: boolean;
  low: EQBandState;
  lowMid: EQBandState;
  hiMid: EQBandState;
  high: EQBandState;
}

export interface ChannelGateState {
  on: boolean;
  type: number;      // 0 = Gate, 1 = Ducking
  threshold: number; // -540..0 (-54.0 dB .. 0.0 dB)
  range: number;     // -700..0 (-70.0 dB .. 0.0 dB)
  attack: number;    // 0..120
  hold: number;      // 0..215
  decay: number;     // 0..159
}

export interface ChannelCompState {
  on: boolean;
  type: number;      // 0 = Comp, 1 = Expand, 2 = Comp(S), 3 = Comp(H)
  threshold: number; // -540..0 (-54.0 dB .. 0.0 dB)
  ratio: number;     // 0..15 (1:1 .. inf:1)
  attack: number;    // 0..120
  release: number;   // 0..159
  gain: number;      // 0..180 (0.0 dB .. +18.0 dB)
  knee: number;      // 0..5 (Hard, 1..5)
}

export interface ChannelRoutingState {
  stereo: boolean;
  direct: boolean;
  bus: boolean[];    // 8 buses
}

export interface ChannelAuxSend {
  on: boolean;
  pre: boolean;      // true = PRE, false = POST
  level: number;     // 0..1023
}

export interface InputChannelState {
  id: number;        // 1..32 (or 33..40 for ST IN 1L..4R)
  name: string;
  on: boolean;       // Channel ON (Unmuted)
  solo: boolean;
  fader: number;     // 0..1023 (823 = 0.0 dB)
  pan: number;       // -63..+63 (0 = Center)
  phase: boolean;    // false = Normal, true = Reverse
  att: number;       // -960..+180 (-96.0 .. +18.0 dB)
  pair: boolean;
  meter: number;     // 0..255
  eq: ChannelEQState;
  gate: ChannelGateState;
  comp: ChannelCompState;
  routing: ChannelRoutingState;
  auxSends: ChannelAuxSend[]; // 8 AUX sends
  delayOn: boolean;
  delayTime: number; // samples/ms raw
}

export interface OutputChannelState {
  id: number;        // 1..8
  name: string;
  on: boolean;
  solo: boolean;
  fader: number;     // 0..1023
  pan: number;       // -63..+63 balance
  meter: number;
  eq: ChannelEQState;
  comp: ChannelCompState;
}

export interface MixerState {
  connected: boolean;
  connectionMode: 'usb-direct' | 'bridge' | 'simulated';
  deviceName: string;
  sceneNumber: number;
  sceneTitle: string;
  selectedChannel: number; // 1..32
  activeLayer: number;     // 0 = 1-16, 1 = 17-32, 2 = Master/AUX/BUS, 3 = Remote
  demoWaveActive: boolean;
  channels: InputChannelState[];  // 32 input channels
  auxes: OutputChannelState[];    // 8 AUX masters
  buses: OutputChannelState[];    // 8 BUS masters
  stereo: OutputChannelState;     // Master L/R
}

export type ClientCommand =
  | { type: 'set_fader'; target: 'ch' | 'aux' | 'bus' | 'stereo'; id: number; value: number }
  | { type: 'set_on'; target: 'ch' | 'aux' | 'bus' | 'stereo'; id: number; value: boolean }
  | { type: 'set_solo'; target: 'ch'; id: number; value: boolean }
  | { type: 'set_pan'; target: 'ch' | 'aux' | 'bus' | 'stereo'; id: number; value: number }
  | { type: 'set_phase'; id: number; value: boolean }
  | { type: 'set_att'; id: number; value: number }
  | { type: 'set_name'; id: number; name: string }
  | { type: 'set_eq'; target: 'ch' | 'aux' | 'bus' | 'stereo'; id: number; param: string; value: number | boolean }
  | { type: 'set_gate'; id: number; param: string; value: number | boolean }
  | { type: 'set_comp'; target: 'ch' | 'aux' | 'bus' | 'stereo'; id: number; param: string; value: number | boolean }
  | { type: 'set_routing'; id: number; target: 'stereo' | 'direct' | 'bus'; busIndex?: number; value: boolean }
  | { type: 'set_aux_send'; chId: number; auxId: number; param: 'on' | 'pre' | 'level'; value: number | boolean }
  | { type: 'select_channel'; id: number }
  | { type: 'recall_scene'; sceneNumber: number }
  | { type: 'sync_channel_strip'; id: number }
  | { type: 'sync_all' }
  | { type: 'trigger_demo_wave'; mode?: 'sine' | 'bounce' | 'v-shape' | 'stop' };
