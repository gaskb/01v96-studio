import { InputChannelState } from '../shared/types.js';

/**
 * Computes real-time Post-DSP Output Level & Gain Reduction (GR) from Input Level + Channel Strip DSP
 */
export function computePostDspMeter(
  ch: InputChannelState,
  meterIn: number
): { meterOut: number; grDb: number } {
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
