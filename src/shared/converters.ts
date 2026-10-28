// Conversion utilities for Yamaha 01V96 VCM parameter values

/**
 * Convert 0..1023 10-bit Yamaha fader value to dB string
 * On 01V96:
 * 1023 = +10.0 dB
 * 823  =   0.0 dB
 * 623  = -10.0 dB
 * 423  = -20.0 dB
 * 223  = -30.0 dB
 * 0    = -inf dB
 */
export function faderToDbString(val: number): string {
  if (val <= 0) return '-∞ dB';
  if (val >= 423) {
    const db = (val - 823) / 20;
    return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
  }
  if (val >= 123) {
    const db = -20 - ((423 - val) / 300) * 30;
    return `${db.toFixed(1)} dB`;
  }
  const db = -50 - ((123 - val) / 123) * 88;
  return `${db.toFixed(0)} dB`;
}

/**
 * Convert user-entered dB value string (e.g. "0", "-10", "+5.5", "-inf") to 0..1023 Yamaha fader value
 */
export function dbStringToFader(str: string): number {
  const clean = str.trim().toLowerCase().replace('db', '').replace('+', '').trim();
  if (clean === '-inf' || clean === '-∞' || clean === 'inf' || clean === '-infinity') return 0;
  const db = parseFloat(clean);
  if (isNaN(db)) return 823; // fallback 0.0 dB
  if (db >= 10.0) return 1023;
  if (db <= -138) return 0;
  if (db >= -20.0) {
    return Math.max(0, Math.min(1023, Math.round(db * 20 + 823)));
  }
  if (db >= -50.0) {
    return Math.max(0, Math.min(1023, Math.round(423 + (db + 20) * 10)));
  }
  const val = Math.round(123 + (db + 50) * (123 / 88));
  return Math.max(0, Math.min(1023, val));
}

/**
 * Convert Yamaha EQ Frequency index (0..119) to Hz (21.2 Hz .. 20.0 kHz)
 */
export function eqIndexToFreqHz(idx: number): number {
  const clamped = Math.max(0, Math.min(119, idx));
  // Logarithmic scale from 21.2 Hz to 20000 Hz across 120 steps (0..119)
  return 21.2 * Math.pow(20000 / 21.2, clamped / 119);
}

export function freqHzToEqIndex(hz: number): number {
  const clamped = Math.max(21.2, Math.min(20000, hz));
  const idx = Math.round(119 * (Math.log(clamped / 21.2) / Math.log(20000 / 21.2)));
  return Math.max(0, Math.min(119, idx));
}

export function formatFreqHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz`;
  }
  return `${hz.toFixed(hz < 100 ? 1 : 0)} Hz`;
}

/**
 * Convert Yamaha EQ Q index (0..42) to actual Q factor or filter label
 * 0..40 => Q from 0.10 to 10.0 (logarithmic)
 * 41 => Shelf (Low/High)
 * 42 => HPF/LPF
 */
export function eqIndexToQValue(idx: number): number {
  if (idx >= 41) return 0.707;
  const clamped = Math.max(0, Math.min(40, idx));
  return 0.1 * Math.pow(100, clamped / 40);
}

export function formatEqQ(idx: number, band: 'low' | 'lowMid' | 'hiMid' | 'high'): string {
  if (idx === 41) return band === 'low' ? 'L.Shelf' : 'H.Shelf';
  if (idx === 42) return band === 'low' ? 'HPF' : 'H.Shelf';
  if (idx === 43) return 'LPF';
  return eqIndexToQValue(idx).toFixed(2);
}

export const COMP_RATIOS = [
  '1:1', '1.1:1', '1.3:1', '1.5:1', '1.7:1', '2:1', '2.5:1', '3:1',
  '3.5:1', '4:1', '5:1', '6:1', '8:1', '10:1', '20:1', '∞:1'
];

export function formatPan(pan: number): string {
  if (pan === 0) return 'C';
  if (pan < 0) return `L${Math.abs(pan)}`;
  return `R${pan}`;
}

/**
 * Get partner channel index (0..31) for Yamaha 01V96 adjacent stereo pairs (1-2, 3-4, etc.)
 */
export function getPairedChannelIndex(channelIndex: number): number {
  return channelIndex % 2 === 0 ? channelIndex + 1 : channelIndex - 1;
}

/**
 * Get partner channel ID (1..32) for Yamaha 01V96 adjacent stereo pairs (1-2, 3-4, etc.)
 */
export function getPairedChannelId(channelId: number): number {
  return channelId % 2 === 1 ? channelId + 1 : channelId - 1;
}
