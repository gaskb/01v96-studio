import { describe, expect, it } from 'vitest';
import {
  COMP_RATIOS,
  eqIndexToFreqHz,
  eqIndexToQValue,
  faderToDbString,
  formatEqQ,
  formatFreqHz,
  formatPan,
  freqHzToEqIndex,
} from '../shared/converters.js';

describe('Shared Audio Converters (src/shared/converters.ts)', () => {
  describe('faderToDbString', () => {
    it('returns -∞ dB for values <= 0', () => {
      expect(faderToDbString(0)).toBe('-∞ dB');
      expect(faderToDbString(-10)).toBe('-∞ dB');
    });

    it('formats values in the upper range (>= 423) accurately', () => {
      // 1023 -> +10.0 dB
      expect(faderToDbString(1023)).toBe('+10.0 dB');
      // 823 -> 0.0 dB (not +0.0 dB)
      expect(faderToDbString(823)).toBe('0.0 dB');
      // 623 -> -10.0 dB
      expect(faderToDbString(623)).toBe('-10.0 dB');
      // 423 -> -20.0 dB
      expect(faderToDbString(423)).toBe('-20.0 dB');
    });

    it('formats values in the mid range (123 <= val < 423)', () => {
      // 123 -> -50.0 dB
      expect(faderToDbString(123)).toBe('-50.0 dB');
      // Midpoint between 123 and 423: 273 -> -35.0 dB
      expect(faderToDbString(273)).toBe('-35.0 dB');
    });

    it('formats values in the lower range (0 < val < 123)', () => {
      const dbStr = faderToDbString(50);
      expect(dbStr).toMatch(/^-\d+ dB$/);
      expect(parseInt(dbStr.replace(' dB', ''), 10)).toBeLessThan(-50);
    });
  });

  describe('eqIndexToFreqHz & freqHzToEqIndex', () => {
    it('clamps values below min (0) and above max (119)', () => {
      expect(eqIndexToFreqHz(-5)).toBeCloseTo(21.2, 1);
      expect(eqIndexToFreqHz(150)).toBeCloseTo(20000, 1);
    });

    it('clamps input frequency to [21.2, 20000] in freqHzToEqIndex', () => {
      expect(freqHzToEqIndex(10)).toBe(0);
      expect(freqHzToEqIndex(30000)).toBe(119);
    });

    it('converts indices back and forth with consistency', () => {
      for (const idx of [0, 20, 50, 75, 100, 119]) {
        const hz = eqIndexToFreqHz(idx);
        const backIdx = freqHzToEqIndex(hz);
        expect(backIdx).toBe(idx);
      }
    });
  });

  describe('formatFreqHz', () => {
    it('formats frequencies >= 10000 Hz with 1 decimal place in kHz', () => {
      expect(formatFreqHz(10000)).toBe('10.0 kHz');
      expect(formatFreqHz(16500)).toBe('16.5 kHz');
    });

    it('formats frequencies between 1000 Hz and 9999 Hz with 2 decimal places in kHz', () => {
      expect(formatFreqHz(1000)).toBe('1.00 kHz');
      expect(formatFreqHz(2540)).toBe('2.54 kHz');
    });

    it('formats frequencies between 100 Hz and 999 Hz with 0 decimal places in Hz', () => {
      expect(formatFreqHz(250)).toBe('250 Hz');
      expect(formatFreqHz(999)).toBe('999 Hz');
    });

    it('formats frequencies < 100 Hz with 1 decimal place in Hz', () => {
      expect(formatFreqHz(45.6)).toBe('45.6 Hz');
      expect(formatFreqHz(21.2)).toBe('21.2 Hz');
    });
  });

  describe('eqIndexToQValue & formatEqQ', () => {
    it('returns 0.707 for shelf/filter modes (index >= 41)', () => {
      expect(eqIndexToQValue(41)).toBe(0.707);
      expect(eqIndexToQValue(42)).toBe(0.707);
    });

    it('calculates logarithmic Q values between 0.10 and 10.0', () => {
      expect(eqIndexToQValue(0)).toBeCloseTo(0.1, 2);
      expect(eqIndexToQValue(40)).toBeCloseTo(10.0, 1);
    });

    it('formats EQ Q labels correctly for shelf and cut modes', () => {
      expect(formatEqQ(41, 'low')).toBe('L.Shelf');
      expect(formatEqQ(41, 'high')).toBe('H.Shelf');
      expect(formatEqQ(42, 'low')).toBe('HPF');
      expect(formatEqQ(42, 'high')).toBe('H.Shelf');
      expect(formatEqQ(43, 'high')).toBe('LPF');
      expect(formatEqQ(20, 'lowMid')).toBe(eqIndexToQValue(20).toFixed(2));
    });
  });

  describe('COMP_RATIOS & formatPan', () => {
    it('provides standard compression ratios up to infinity:1', () => {
      expect(COMP_RATIOS).toHaveLength(16);
      expect(COMP_RATIOS[0]).toBe('1:1');
      expect(COMP_RATIOS[COMP_RATIOS.length - 1]).toBe('∞:1');
    });

    it('formats pan correctly for Center, Left, and Right', () => {
      expect(formatPan(0)).toBe('C');
      expect(formatPan(-16)).toBe('L16');
      expect(formatPan(32)).toBe('R32');
    });
  });
});
