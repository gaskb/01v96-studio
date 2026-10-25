import { describe, expect, it } from 'vitest';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  faderToDbString,
  formatEqQ,
  formatPan,
  freqHzToEqIndex,
} from '../shared/converters.js';
import { calcBandDbAtFreq, resolveResetValue } from '../client/components/InteractiveEQ.js';
import { resolveKnobReset } from '../client/components/RotaryKnob.js';
import { computePostDspMeter, MixerController } from '../server/mixer-controller.js';
import {
  buildMeterRequest,
  buildParamChange,
  buildSceneRecallSysEx,
  dataBytesToInt,
  EL_EFFECT,
  EL_GEQ,
  EL_INPUT_EQ,
  EL_INPUT_FADER,
  intToDataBytes,
  MODEL_01V96,
  MODEL_UNIVERSAL,
} from '../server/protocol.js';
import { encodeSysExToUsbMidi, UsbMidiStreamParser } from '../server/usb-transport.js';

describe('Yamaha 01V96 Protocol & Converters (v0.2.1)', () => {
  it('encodes and decodes signed 28-bit SysEx integers accurately', () => {
    for (const val of [0, 1, 823, 1023, -1, -180, -310, -540, 180]) {
      const bytes = intToDataBytes(val);
      expect(bytes).toHaveLength(4);
      expect(bytes.every((b) => b >= 0 && b <= 0x7f)).toBe(true);
      expect(dataBytesToInt(bytes)).toBe(val);
    }
  });

  it('encodes SysEx messages into 4-byte USB-MIDI 1.0 event packets and parses them back', () => {
    const sysex = buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, 0, 823);
    const usbPacket = encodeSysExToUsbMidi(sysex, 0);
    expect(usbPacket.length % 4).toBe(0);

    const parser = new UsbMidiStreamParser();
    const received: number[][] = [];
    parser.parseChunk(usbPacket, (msg) => received.push(msg));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(sysex);
  });

  it('handles fragmented SysEx across multiple 64-byte USB bulk chunks and ignores zero padding', () => {
    const meterReq = buildMeterRequest();
    const packet = encodeSysExToUsbMidi(meterReq, 0);
    const padded = Buffer.alloc(64, 0);
    packet.copy(padded, 0);

    const parser = new UsbMidiStreamParser();
    const received: number[][] = [];
    parser.parseChunk(padded, (msg) => received.push(msg));
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(meterReq);
  });

  it('renders High Band Q=42 as flat 0 dB High Shelf when Gain=0 (no false LPF roll-off above 5kHz)', () => {
    // On Yamaha 01V96, High Band Q=42 with Gain=0 dB and LPF off is a High Shelf at 0 dB (flat!)
    const dbAt10k = calcBandDbAtFreq(10000, 10000, 0, 42, 'high', false, false);
    expect(dbAt10k).toBe(0);

    // When Gain is +6 dB on High Shelf (Q=42, lpfOn=false), it boosts high frequencies
    const boostAt15k = calcBandDbAtFreq(15000, 8000, 6, 42, 'high', false, false);
    expect(boostAt15k).toBeGreaterThan(3);
  });

  it('converts fader, frequency, Q, and pan values properly', () => {
    expect(faderToDbString(0)).toBe('-∞ dB');
    expect(faderToDbString(823)).toBe('0.0 dB');
    expect(faderToDbString(1023)).toBe('+10.0 dB');

    const hz = eqIndexToFreqHz(72);
    expect(freqHzToEqIndex(hz)).toBe(72);
    expect(eqIndexToQValue(41)).toBeCloseTo(0.707, 2);
    expect(formatEqQ(41, 'low')).toBe('L.Shelf');
    expect(formatEqQ(42, 'high')).toBe('H.Shelf');
    expect(formatEqQ(43, 'high')).toBe('LPF');
    expect(formatPan(0)).toBe('C');
    expect(formatPan(-25)).toBe('L25');
    expect(formatPan(30)).toBe('R30');
  });

  it('computes Pre-DSP IN vs Post-DSP OUT levels and Compressor/Gate Gain Reduction', () => {
    const controller = new MixerController(() => {});
    const ch = controller.state.channels[0];
    ch.fader = 823; // 0 dB
    ch.on = true;
    ch.comp.on = true;
    ch.comp.threshold = -300; // -30.0 dB
    ch.comp.ratio = 11;       // 6:1
    ch.comp.gain = 20;        // +2.0 dB

    const res = computePostDspMeter(ch, 220);
    expect(res.grDb).toBeGreaterThan(0);
    expect(res.meterOut).toBeGreaterThan(0);

    ch.on = false;
    expect(computePostDspMeter(ch, 220).meterOut).toBe(0);
  });

  it('detects hardware Scene Recall (Program Change, Universal 0x10, and 01V96 0x0D MemSceneNow)', () => {
    const broadcasts: any[] = [];
    const controller = new MixerController((msg) => broadcasts.push(msg));

    controller.handleIncomingMidi([0xc0, 5]);
    expect(controller.state.sceneNumber).toBe(5);

    const sceneSysEx = buildSceneRecallSysEx(12);
    controller.handleIncomingMidi(sceneSysEx);
    expect(controller.state.sceneNumber).toBe(12);

    const hwSceneSysEx = buildParamChange(MODEL_01V96, 4, 10, 0, 0, 19);
    controller.handleIncomingMidi(hwSceneSysEx);
    expect(controller.state.sceneNumber).toBe(19);
  });

  it('handles Effects, GEQ, Patch I/O, LCD Menu, and Dual Channel View commands', async () => {
    const controller = new MixerController(() => {});

    await controller.handleClientCommand({ type: 'set_dual_view', enabled: true });
    expect(controller.state.dualChannelView).toBe(true);

    await controller.handleClientCommand({
      type: 'set_effect',
      rackId: 2,
      param: 'mix',
      value: 75,
    });
    expect(controller.state.effects[1].mix).toBe(75);

    await controller.handleClientCommand({
      type: 'set_geq',
      unitId: 1,
      param: 'band',
      bandIndex: 10,
      value: 65,
    });
    expect(controller.state.geqs[0].bands[10]).toBe(65);

    await controller.handleClientCommand({
      type: 'set_input_patch',
      chId: 4,
      sourcePort: 18,
    });
    expect(controller.state.channels[3].inputPatch).toBe(18);

    await controller.handleClientCommand({
      type: 'set_lcd_screen',
      screenNo: 7,
    });
    expect(controller.state.setup.lcdScreenNo).toBe(7);

    controller.handleIncomingMidi(buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, 0, 1));
    expect(controller.state.effects[0].bypass).toBe(true);

    controller.handleIncomingMidi(buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 8, 0, -40));
    expect(controller.state.effects[0].bypass).toBe(true);
    expect(controller.state.geqs[0].bands[4]).toBe(-40);
  });

  it('preserves Channel 12 memorized scene EQ (-6.0 dB) when synced and restores it on double-click', async () => {
    const broadcasts: any[] = [];
    const controller = new MixerController((msg) => broadcasts.push(msg));

    // Hardware mixer sends Channel 12 (index 11) LowMid Gain (param 7) = -60 (-6.0 dB) during scene/channel sync
    const ch12SyncMsg = buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, 7, 11, -60);
    controller.handleIncomingMidi(ch12SyncMsg);

    expect(controller.state.channels[11].eq.lowMid.gain).toBe(-60);
    expect(controller.state.savedChannels[11].eq.lowMid.gain).toBe(-60);

    // User moves Channel 12 LowMid Gain to +45 (+4.5 dB) in the WebApp
    await controller.handleClientCommand({
      type: 'set_eq',
      target: 'ch',
      id: 12,
      param: 'lowMidG',
      value: 45,
    });

    expect(controller.state.channels[11].eq.lowMid.gain).toBe(45);
    // Saved scene value MUST still be -60 (-6.0 dB)!
    expect(controller.state.savedChannels[11].eq.lowMid.gain).toBe(-60);

    // Double-clicking restores -60 (-6.0 dB), NOT 0!
    const resetVal = resolveResetValue(
      controller.state.channels[11].eq.lowMid.gain,
      controller.state.savedChannels[11].eq.lowMid.gain,
      0
    );
    expect(resetVal).toBe(-60);

    const knobResetVal = resolveKnobReset(
      controller.state.channels[11].eq.lowMid.gain,
      controller.state.savedChannels[11].eq.lowMid.gain,
      0
    );
    expect(knobResetVal).toBe(-60);

    // Shift + Double-click forces factory default (0.0 dB)
    expect(resolveResetValue(45, -60, 0, true)).toBe(0);
  });
});
