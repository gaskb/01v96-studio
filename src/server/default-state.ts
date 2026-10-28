import {
  ChannelCompState,
  ChannelEQState,
  ChannelGateState,
  EffectRackState,
  GEQUnitState,
  InputChannelState,
  MixerState,
  OutputChannelState,
} from '../shared/types.js';

export function createDefaultEQ(): ChannelEQState {
  return {
    on: true,
    mode: 0,
    hpfOn: false,
    lpfOn: false,
    low: { q: 41, freq: 36, gain: 0 }, // Low Shelf ~125 Hz, 0 dB
    lowMid: { q: 23, freq: 65, gain: 0 }, // Peaking ~800 Hz, 0 dB
    hiMid: { q: 23, freq: 92, gain: 0 }, // Peaking ~3.5 kHz, 0 dB
    high: { q: 41, freq: 112, gain: 0 }, // High Shelf ~10 kHz, 0 dB
  };
}

export function createDefaultGate(): ChannelGateState {
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

export function createDefaultComp(): ChannelCompState {
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

export function createInputChannel(id: number): InputChannelState {
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

export function createOutputChannel(id: number, prefix: string): OutputChannelState {
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

export function createEffectRack(id: number): EffectRackState {
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

export function createGEQUnit(id: number): GEQUnitState {
  return {
    id,
    on: true,
    bands: Array(31).fill(0),
  };
}

export function createInitialMixerState(): MixerState {
  return {
    connected: false,
    connectionMode: 'simulated',
    deviceName: 'YAMAHA 01V96 VCM',
    sceneNumber: 1,
    sceneTitle: 'Vintage',
    sceneModified: false,
    selectedChannel: 1,
    dualChannelView: false,
    deepPair: false,
    activeLayer: 0,
    demoWaveActive: false,
    channels: Array.from({ length: 32 }, (_, i) => createInputChannel(i + 1)),
    savedChannels: Array.from({ length: 32 }, (_, i) => createInputChannel(i + 1)),
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
      meterInputPoint: 1, // PRE FADER
      meterOutputPoint: 2, // POST ON
      peakHold: false,
      wordClockMaster: 1, // 48 kHz Internal
      brightness: 64,
      omniOutPatch: [1, 2, 3, 4],
    },
  };
}
