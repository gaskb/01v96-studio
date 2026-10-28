export const APP_VERSION = '0.6.0';
export const UI_VERSION = '0.6.0';
export const API_VERSION = '0.6.0';

export type ControlMode = 'knobs' | 'sliders';

export type MixerLayer =
  | 'all32'
  | 'ch1-16'
  | 'ch17-32'
  | 'stin-aux'
  | 'bus-master';

export type WorkspaceView =
  | 'console'       // Traditional 16-Fader + Upper Channel Strip
  | 'channel-overview' // Full Single or Dual/Stereo Channel Strip View (Everything at once)
  | 'effects-geq'   // Effects Rack 1-4 (VCM) + 31-Band Graphic EQ
  | 'patch-io'      // Input Patch, Output Patch (Omni, Bus, Aux, Slot)
  | 'setup-lcd';    // Mixer LCD Screen Navigator, Metering Point, Clock & Preferences

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
  id: number;        // 1..32
  name: string;
  on: boolean;       // Channel ON (Unmuted)
  solo: boolean;
  fader: number;     // 0..1023 (823 = 0.0 dB)
  pan: number;       // -63..+63 (0 = Center)
  phase: boolean;    // false = Normal, true = Reverse
  att: number;       // -960..+180 (-96.0 .. +18.0 dB)
  pair: boolean;
  meterIn: number;   // 0..255 Pre-DSP Input Level
  meterOut: number;  // 0..255 Post-DSP/Post-Fader Output Level
  grDb: number;      // Current Gain Reduction in dB (0..24)
  eq: ChannelEQState;
  gate: ChannelGateState;
  comp: ChannelCompState;
  routing: ChannelRoutingState;
  auxSends: ChannelAuxSend[]; // 8 AUX sends
  delayOn: boolean;
  delayTime: number; // samples/ms raw
  inputPatch: number; // Assigned physical input port index
  directOutPatch: number;
}

export interface OutputChannelState {
  id: number;        // 1..8
  name: string;
  on: boolean;
  solo: boolean;
  fader: number;     // 0..1023
  pan: number;       // -63..+63 balance
  meterIn: number;
  meterOut: number;
  eq: ChannelEQState;
  comp: ChannelCompState;
}

export interface EffectRackState {
  id: number;        // 1..4
  name: string;
  type: number;      // Effect algorithm index
  bypass: boolean;
  mix: number;       // 0..100%
  params: number[];  // 8 primary parameters
}

export interface GEQUnitState {
  id: number;        // 1..4
  on: boolean;
  bands: number[];   // 31 bands (-150..+150 => -15..+15 dB)
}

export interface MixerSetupState {
  lcdScreenNo: number;      // Physical LCD screen ID
  lcdTabNo: number;         // Physical LCD tab
  meterInputPoint: number;  // 0 = PRE EQ, 1 = PRE FADER, 2 = POST ON
  meterOutputPoint: number; // 0 = PRE EQ, 1 = PRE FADER, 2 = POST ON
  peakHold: boolean;
  wordClockMaster: number;  // 0 = Int 44.1k, 1 = Int 48k, 2 = Int 88.2k, 3 = Int 96k, 4 = ADAT, 5 = Slot, 6 = WordClock
  brightness: number;       // LCD Contrast/Brightness
  omniOutPatch: number[];   // 4 Omni Outs patch assignments
}

export interface MixerState {
  connected: boolean;
  connectionMode: 'usb-direct' | 'simulated';
  deviceName: string;
  sceneNumber: number;
  sceneTitle: string;
  sceneModified: boolean;
  selectedChannel: number; // 1..32
  dualChannelView: boolean; // Single vs Dual/Stereo Pair Channel View
  deepPair: boolean;       // Sync EQ, dynamics, and strip params across paired channels
  activeLayer: number;     // 0 = 1-16, 1 = 17-32, 2 = Master/AUX/BUS, 3 = Remote
  demoWaveActive: boolean;
  channels: InputChannelState[];  // 32 input channels
  savedChannels: InputChannelState[]; // 32 input channels scene snapshot (last stored/synced values)
  auxes: OutputChannelState[];    // 8 AUX masters
  buses: OutputChannelState[];    // 8 BUS masters
  stereo: OutputChannelState;     // Master L/R
  effects: EffectRackState[];     // 4 internal VCM/REV-X effects processors
  geqs: GEQUnitState[];           // 4 31-band GEQ units
  setup: MixerSetupState;
}

export type { ClientCommand } from './validators.js';

export interface WidgetLayoutItem {
  id: string;
  colStart?: number;
  rowStart?: number;
  colSpan: number;
  rowSpan?: number;
  visible: boolean;
  minHeight?: number;
}

export interface ChannelLayoutConfig {
  presetName?: string;
  gridCols?: number;
  gridRows?: number;
  items: WidgetLayoutItem[];
}

export interface LayoutStorageData {
  activeLayout?: ChannelLayoutConfig;
  presets: ChannelLayoutConfig[];
}

export interface SceneBackupLabels {
  ch?: Record<string | number, string>;
  aux?: Record<string | number, string>;
  bus?: Record<string | number, string>;
}

export interface SceneBackupData {
  number: number;
  title: string;
  channels: InputChannelState[];
  auxes: OutputChannelState[];
  buses: OutputChannelState[];
  stereo?: OutputChannelState;
  effects?: EffectRackState[];
  labels?: SceneBackupLabels;
}

export interface MixerBackupPackage {
  format: '01v96-studio-backup';
  version: string;
  timestamp: string;
  appVersion?: string;
  uiVersion?: string;
  apiVersion?: string;
  metadata?: {
    name?: string;
    author?: string;
    description?: string;
  };
  global?: {
    layouts?: LayoutStorageData;
    activeLayer?: number;
    dualChannelView?: boolean;
    deepPair?: boolean;
  };
  scenes: Record<string, SceneBackupData>;
}

export interface RestoreSceneItem {
  sourceSceneNumber: number;
  targetSceneNumber: number;
}

export interface RestorePlan {
  restoreGlobal?: boolean;
  writeHardware?: boolean;
  scenes: RestoreSceneItem[];
}

export interface RestoreRequest {
  package: MixerBackupPackage;
  plan: RestorePlan;
}

export interface RestoreResult {
  ok: boolean;
  restoredScenes: number[];
  restoredGlobal: boolean;
  message?: string;
}
