import { eqIndexToQValue } from '../../../shared/converters';

export type BandKey = 'low' | 'lowMid' | 'hiMid' | 'high';

export const BAND_CONFIG: {
  key: BandKey;
  label: string;
  color: string;
  fill: string;
  qParam: string;
  fParam: string;
  gParam: string;
  defaultQ: number;
  defaultF: number;
  defaultG: number;
}[] = [
  {
    key: 'low',
    label: 'LOW',
    color: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.16)',
    qParam: 'lowQ',
    fParam: 'lowF',
    gParam: 'lowG',
    defaultQ: 41,
    defaultF: 36,
    defaultG: 0,
  },
  {
    key: 'lowMid',
    label: 'LO-MID',
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.16)',
    qParam: 'lowMidQ',
    fParam: 'lowMidF',
    gParam: 'lowMidG',
    defaultQ: 23,
    defaultF: 65,
    defaultG: 0,
  },
  {
    key: 'hiMid',
    label: 'HI-MID',
    color: '#10b981',
    fill: 'rgba(16, 185, 129, 0.16)',
    qParam: 'hiMidQ',
    fParam: 'hiMidF',
    gParam: 'hiMidG',
    defaultQ: 23,
    defaultF: 92,
    defaultG: 0,
  },
  {
    key: 'high',
    label: 'HIGH',
    color: '#06b6d4',
    fill: 'rgba(6, 182, 212, 0.16)',
    qParam: 'highQ',
    fParam: 'highF',
    gParam: 'highG',
    defaultQ: 42,
    defaultF: 112,
    defaultG: 0,
  },
];

// Compute biquad magnitude in dB at frequency f (Hz)
export function calcBandDbAtFreq(
  f: number,
  f0: number,
  gainDb: number,
  qIdx: number,
  bandKey: BandKey,
  _lpfOn = false,
  hpfOn = false
): number {
  const ratio = f / f0;
  if (ratio <= 0) return 0;

  if (bandKey === 'low' && (qIdx === 42 || (hpfOn && qIdx > 41))) {
    const order = Math.pow(f0 / f, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }
  if (bandKey === 'high' && qIdx === 43) {
    const order = Math.pow(f / f0, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }

  if (Math.abs(gainDb) < 0.05) return 0;

  if (bandKey === 'low' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(3.2 * x));
    return gainDb * s;
  }

  if (bandKey === 'high' && (qIdx === 41 || qIdx === 42)) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(-3.2 * x));
    return gainDb * s;
  }

  const Q = eqIndexToQValue(qIdx);
  const logRatio = Math.log2(ratio);
  const bw = 1 / Math.max(0.15, Q * 0.85);
  return gainDb * Math.exp(-Math.pow(logRatio / bw, 2));
}

/**
 * Restores the scene's memorized value (`saved`) on double-click, or `factoryDefault` if Shift/Alt is held or no saved value exists.
 */
export function resolveResetValue(
  _current: number,
  saved: number | undefined,
  factoryDefault: number,
  forceFactoryDefault = false
): number {
  if (!forceFactoryDefault && saved !== undefined) {
    return saved;
  }
  return factoryDefault;
}
