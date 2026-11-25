import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../server/index.js';
import { buildParamRequest, EL_INPUT_FADER, MODEL_UNIVERSAL } from '../server/protocol.js';
import {
  buildDiagnosticHints,
  extractLibUsbErrorCode,
  formatHexId,
  scanUsbDevices,
  YAMAHA_01V96_PID,
  YAMAHA_VID,
} from '../server/usb-transport.js';

describe('USB Diagnostics & Discovery Helpers', () => {
  it('formats hex IDs and extracts libusb error codes accurately', () => {
    expect(formatHexId(YAMAHA_VID)).toBe('0x0499');
    expect(formatHexId(YAMAHA_01V96_PID)).toBe('0x5008');
    expect(extractLibUsbErrorCode('Error: LIBUSB_ERROR_ACCESS on claim')).toBe('LIBUSB_ERROR_ACCESS');
    expect(extractLibUsbErrorCode('LIBUSB_ERROR_BUSY')).toBe('LIBUSB_ERROR_BUSY');
    expect(extractLibUsbErrorCode('Device not found')).toBe('NO_DEVICE');
    expect(extractLibUsbErrorCode('Could not find endpoints')).toBe('NO_ENDPOINTS');
    expect(extractLibUsbErrorCode(null)).toBeNull();
  });

  it('scans mocked USB devices, filtering Yamaha devices and matching known PIDs', () => {
    const fakeDevices: any[] = [
      {
        busNumber: 1,
        deviceAddress: 2,
        deviceDescriptor: { idVendor: 0x05ac, idProduct: 0x1234 }, // Apple (ignored)
      },
      {
        busNumber: 2,
        deviceAddress: 5,
        deviceDescriptor: { idVendor: YAMAHA_VID, idProduct: YAMAHA_01V96_PID },
        configDescriptor: {
          interfaces: [
            [
              {
                bInterfaceClass: 0xff,
                bInterfaceSubClass: 0x00,
                endpoints: [{ bEndpointAddress: 0x01 }, { bEndpointAddress: 0x81 }],
              },
            ],
          ],
        },
      },
      {
        busNumber: 2,
        deviceAddress: 6,
        deviceDescriptor: { idVendor: YAMAHA_VID, idProduct: 0x1509 }, // 01V96i
        configDescriptor: { interfaces: [] },
      },
    ];

    const result = scanUsbDevices(() => fakeDevices);
    expect(result.totalUsbDevices).toBe(3);
    expect(result.yamahaDevices).toHaveLength(2);
    expect(result.yamahaDevices[0].isKnown01V96).toBe(true);
    expect(result.yamahaDevices[0].pid).toBe('0x5008');
    expect(result.yamahaDevices[0].endpointsSummary[0]).toContain('ep0x1(OUT)');
    expect(result.yamahaDevices[0].endpointsSummary[0]).toContain('ep0x81(IN)');
    expect(result.yamahaDevices[1].isKnown01V96).toBe(false);
    expect(result.yamahaDevices[1].matchedModel).toContain('01V96i');
  });

  it('handles USB device list exceptions gracefully (error path)', () => {
    const result = scanUsbDevices(() => {
      throw new Error('LIBUSB_ERROR_IO');
    });
    expect(result.totalUsbDevices).toBe(0);
    expect(result.yamahaDevices).toEqual([]);
    expect(result.scanError).toContain('LIBUSB_ERROR_IO');
  });

  it('produces actionable hints for macOS driver conflict, Linux udev, Docker, and alternate PID', () => {
    const macAccess = buildDiagnosticHints({
      platform: 'darwin',
      inDocker: false,
      connected: false,
      totalUsbDevices: 5,
      yamahaDevices: [],
      lastError: 'LIBUSB_ERROR_ACCESS',
      lastErrorCode: 'LIBUSB_ERROR_ACCESS',
    });
    expect(macAccess.some((h) => h.title.includes('macOS'))).toBe(true);

    const linuxAccess = buildDiagnosticHints({
      platform: 'linux',
      inDocker: false,
      connected: false,
      totalUsbDevices: 4,
      yamahaDevices: [],
      lastError: 'LIBUSB_ERROR_ACCESS',
      lastErrorCode: 'LIBUSB_ERROR_ACCESS',
    });
    expect(linuxAccess.some((h) => h.detail.includes('udev'))).toBe(true);

    const dockerNoUsb = buildDiagnosticHints({
      platform: 'linux',
      inDocker: true,
      connected: false,
      totalUsbDevices: 0,
      yamahaDevices: [],
      lastError: null,
      lastErrorCode: null,
    });
    expect(dockerNoUsb.some((h) => h.title.includes('Docker'))).toBe(true);

    const otherPid = buildDiagnosticHints({
      platform: 'darwin',
      inDocker: false,
      connected: false,
      totalUsbDevices: 2,
      yamahaDevices: [
        {
          vid: '0x0499',
          pid: '0x1509',
          vidNum: YAMAHA_VID,
          pidNum: 0x1509,
          busNumber: 1,
          deviceAddress: 3,
          isYamaha: true,
          isKnown01V96: false,
          matchedModel: 'Yamaha 01V96i (USB Audio/MIDI)',
          interfaceCount: 3,
          endpointsSummary: [],
        },
      ],
      lastError: null,
      lastErrorCode: null,
    });
    expect(otherPid.some((h) => h.title.includes('PID diverso'))).toBe(true);
  });

  it('encodes custom MIDI channel in buildParamRequest with clamping', () => {
    const ch1 = buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, 0, 1);
    const ch3 = buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, 0, 3);
    const chClamped = buildParamRequest(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, 0, 99);
    expect(ch1[2]).toBe(0x30);
    expect(ch3[2]).toBe(0x32);
    expect(chClamped[2]).toBe(0x3f);
  });
});

describe('Diagnostics REST API Endpoints & Error Paths', () => {
  const testPort = 19700 + Math.floor(Math.random() * 200);
  let serverInstance: ReturnType<typeof createServer>;

  beforeAll(async () => {
    serverInstance = createServer(testPort);
    await serverInstance.start();
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  it('GET /api/diagnostics/usb returns complete diagnostic report', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/diagnostics/usb`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platform).toBe(process.platform);
    expect(typeof body.totalUsbDevices).toBe('number');
    expect(Array.isArray(body.yamahaDevices)).toBe(true);
    expect(Array.isArray(body.hints)).toBe(true);
  });

  it('POST /api/diagnostics/reconnect validates pidOverride and rejects invalid values', async () => {
    const badRes = await fetch(`http://localhost:${testPort}/api/diagnostics/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidOverride: 999999 }),
    });
    expect(badRes.status).toBe(400);

    const okRes = await fetch(`http://localhost:${testPort}/api/diagnostics/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidOverride: '0x5008' }),
    });
    expect(okRes.status).toBe(200);
    const data = await okRes.json();
    expect(typeof data.connected).toBe('boolean');
    expect(data.report).toBeDefined();
  });

  it('POST /api/diagnostics/ping returns offline diagnosis when USB is disconnected and rejects invalid params', async () => {
    const badCable = await fetch(`http://localhost:${testPort}/api/diagnostics/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cable: 99 }),
    });
    expect(badCable.status).toBe(400);

    const badCh = await fetch(`http://localhost:${testPort}/api/diagnostics/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ midiChannel: 0 }),
    });
    expect(badCh.status).toBe(400);

    const offlinePing = await fetch(`http://localhost:${testPort}/api/diagnostics/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cable: 0, midiChannel: 1 }),
    });
    expect(offlinePing.status).toBe(200);
    const pingBody = await offlinePing.json();
    expect(pingBody.ok).toBe(false);
    expect(pingBody.usbConnected).toBe(false);
    expect(pingBody.diagnosis).toContain('USB');
  });

  it('POST /api/command updates usbCable and midiChannel via set_studio_settings', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'set_studio_settings',
        usbCable: 2,
        midiChannel: 4,
      }),
    });
    expect(res.status).toBe(200);
    expect(serverInstance.mixer.state.studioSettings.usbCable).toBe(2);
    expect(serverInstance.mixer.state.studioSettings.midiChannel).toBe(4);

    // Restore defaults
    await fetch(`http://localhost:${testPort}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'set_studio_settings',
        usbCable: 0,
        midiChannel: 1,
      }),
    });
  });
});
