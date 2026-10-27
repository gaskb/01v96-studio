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
