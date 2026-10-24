import { describe, expect, it } from 'vitest';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  faderToDbString,
  formatEqQ,
  formatPan,
  freqHzToEqIndex,
} from '../shared/converters.js';
import { MixerController } from '../server/mixer-controller.js';
import {
  buildMeterRequest,
  buildParamChange,
  dataBytesToInt,
  EL_INPUT_EQ,
  EL_INPUT_FADER,
  EL_INPUT_ON,
  intToDataBytes,
  MODEL_UNIVERSAL,
} from '../server/protocol.js';
import { encodeSysExToUsbMidi, UsbMidiStreamParser } from '../server/usb-transport.js';

describe('Yamaha 01V96 Protocol & Converters', () => {
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

  it('updates MixerController state on incoming SysEx and client commands (with bounds clamping)', async () => {
    const broadcasts: any[] = [];
    const controller = new MixerController((msg) => broadcasts.push(msg));

    // Incoming SysEx for Channel 3 Fader = 750
    const incomingFader = buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, 2, 750);
    controller.handleIncomingMidi(incomingFader);
    expect(controller.state.channels[2].fader).toBe(750);

    // Incoming SysEx for Channel 1 EQ Low Gain = -45 (-4.5 dB)
    const incomingEq = buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, 3, 0, -45);
    controller.handleIncomingMidi(incomingEq);
    expect(controller.state.channels[0].eq.low.gain).toBe(-45);

    // Out-of-bounds fader command should clamp to 0..1023
    await controller.handleClientCommand({
      type: 'set_fader',
      target: 'ch',
      id: 1,
      value: 9999,
    });
    expect(controller.state.channels[0].fader).toBe(1023);

    // Malformed / short MIDI messages should be safely ignored without throwing
    expect(() => controller.handleIncomingMidi([0xf0, 0x43, 0xf7])).not.toThrow();

    // Demo wave start and stop restores faders
    await controller.handleClientCommand({ type: 'trigger_demo_wave', mode: 'sine' });
    expect(controller.state.demoWaveActive).toBe(true);
    await controller.handleClientCommand({ type: 'trigger_demo_wave', mode: 'stop' });
    expect(controller.state.demoWaveActive).toBe(false);
    expect(controller.state.channels[2].fader).toBe(750);
  });
});
