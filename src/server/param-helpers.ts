import { ChannelCompState, ChannelEQState, ChannelGateState } from '../shared/types.js';
import { COMP_PARAM_MAP, EQ_PARAM_MAP, GATE_PARAM_MAP } from './protocol.js';

export const INV_EQ_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(EQ_PARAM_MAP).map(([k, v]) => [v, k])
);
export const INV_GATE_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(GATE_PARAM_MAP).map(([k, v]) => [v, k])
);
export const INV_COMP_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(COMP_PARAM_MAP).map(([k, v]) => [v, k])
);

export function applyEQParam(eq: ChannelEQState, paramIdx: number, val: number): void {
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

export function applyGateParam(gate: ChannelGateState, paramIdx: number, val: number): void {
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

export function applyCompParam(comp: ChannelCompState, paramIdx: number, val: number): void {
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

export function extractEQParams(eq: ChannelEQState): Array<[number, number]> {
  return [
    [EQ_PARAM_MAP.mode, eq.mode],
    [EQ_PARAM_MAP.on, eq.on ? 1 : 0],
    [EQ_PARAM_MAP.hpfOn, eq.hpfOn ? 1 : 0],
    [EQ_PARAM_MAP.lpfOn, eq.lpfOn ? 1 : 0],
    [EQ_PARAM_MAP.lowQ, eq.low.q],
    [EQ_PARAM_MAP.lowF, eq.low.freq],
    [EQ_PARAM_MAP.lowG, eq.low.gain],
    [EQ_PARAM_MAP.lowMidQ, eq.lowMid.q],
    [EQ_PARAM_MAP.lowMidF, eq.lowMid.freq],
    [EQ_PARAM_MAP.lowMidG, eq.lowMid.gain],
    [EQ_PARAM_MAP.hiMidQ, eq.hiMid.q],
    [EQ_PARAM_MAP.hiMidF, eq.hiMid.freq],
    [EQ_PARAM_MAP.hiMidG, eq.hiMid.gain],
    [EQ_PARAM_MAP.highQ, eq.high.q],
    [EQ_PARAM_MAP.highF, eq.high.freq],
    [EQ_PARAM_MAP.highG, eq.high.gain],
  ];
}

export function extractGateParams(gate: ChannelGateState): Array<[number, number]> {
  return [
    [GATE_PARAM_MAP.on, gate.on ? 1 : 0],
    [GATE_PARAM_MAP.type, gate.type],
    [GATE_PARAM_MAP.attack, gate.attack],
    [GATE_PARAM_MAP.range, gate.range],
    [GATE_PARAM_MAP.hold, gate.hold],
    [GATE_PARAM_MAP.decay, gate.decay],
    [GATE_PARAM_MAP.threshold, gate.threshold],
  ];
}

export function extractCompParams(comp: ChannelCompState): Array<[number, number]> {
  return [
    [COMP_PARAM_MAP.on, comp.on ? 1 : 0],
    [COMP_PARAM_MAP.type, comp.type],
    [COMP_PARAM_MAP.attack, comp.attack],
    [COMP_PARAM_MAP.release, comp.release],
    [COMP_PARAM_MAP.ratio, comp.ratio],
    [COMP_PARAM_MAP.gain, comp.gain],
    [COMP_PARAM_MAP.knee, comp.knee],
    [COMP_PARAM_MAP.threshold, comp.threshold],
  ];
}
