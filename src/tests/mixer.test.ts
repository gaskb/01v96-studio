import { describe, expect, it } from 'vitest';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  faderToDbString,
  formatEqQ,
  formatPan,
  freqHzToEqIndex,
} from '../shared/converters.js';
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

describe('Yamaha 01V96 Protocol & Converters (v0.2.0)', () => {
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

  it('converts fader, frequency, Q, and pan values properly', () => {
    expect(faderToDbString(0)).toBe('-∞ dB');
    expect(faderToDbString(823)).toBe('0.0 dB');
    expect(faderToDbString(1023)).toBe('+10.0 dB');

    const hz = eqIndexToFreqHz(72);
    expect(freqHzToEqIndex(hz)).toBe(72);
    expect(eqIndexToQValue(41)).toBeCloseTo(0.707, 2);
    expect(formatEqQ(41, 'low')).toBe('L.Shelf');
    expect(formatEqQ(42, 'high')).toBe('LPF');
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

    // When channel is muted, meterOut should be 0
    ch.on = false;
    expect(computePostDspMeter(ch, 220).meterOut).toBe(0);
  });

  it('detects hardware Scene Recall (Program Change, Universal 0x10, and 01V96 0x0D MemSceneNow)', () => {
    const broadcasts: any[] = [];
    const controller = new MixerController((msg) => broadcasts.push(msg));

    // 1. Standard MIDI Program Change (0xC0, 5)
    controller.handleIncomingMidi([0xc0, 5]);
    expect(controller.state.sceneNumber).toBe(5);

    // 2. Universal Scene Recall SysEx (0x7F, 0x10)
    const sceneSysEx = buildSceneRecallSysEx(12);
    controller.handleIncomingMidi(sceneSysEx);
    expect(controller.state.sceneNumber).toBe(12);

    // 3. 01V96 Hardware MemSceneNow (0x0D, dt=4, el=10, p=0)
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

    // Incoming Effect parameter change
    controller.handleIncomingMidi(buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, 0, 1));
    expect(controller.state.effects[0].bypass).toBe(true);

    // Incoming GEQ band change
    controller.handleIncomingMidi(buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 8, 0, -40));
    expect(controller.state.geqs[0].bands[4]).toBe(-40);
  });
});
