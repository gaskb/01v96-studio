import fs from 'fs';
import * as usb from 'usb';
import {
  APP_VERSION,
  DiagnosticHint,
  UsbDeviceInfo,
  UsbDiagnosticsReport,
} from '../shared/types.js';

export const YAMAHA_VID = 0x0499;
export const YAMAHA_01V96_PID = 0x5008;

export const KNOWN_YAMAHA_MIXER_PIDS: Record<number, string> = {
  0x5008: 'Yamaha 01V96 / 01V96V2 / 01V96 VCM',
  0x1509: 'Yamaha 01V96i (USB Audio/MIDI)',
};

export function formatHexId(id: number): string {
  return `0x${(id & 0xffff).toString(16).padStart(4, '0')}`;
}

export function detectDocker(): boolean {
  try {
    if (process.env.CONTAINER === 'docker' || process.env.DOCKER === 'true') {
      return true;
    }
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

export function extractLibUsbErrorCode(errMsg: string | null): string | null {
  if (!errMsg) return null;
  const match = errMsg.match(/LIBUSB_[A-Z0-9_]+/);
  if (match) return match[0];
  if (errMsg.toLowerCase().includes('no_device') || errMsg.toLowerCase().includes('not found')) {
    return 'NO_DEVICE';
  }
  if (errMsg.toLowerCase().includes('endpoints')) {
    return 'NO_ENDPOINTS';
  }
  return 'USB_ERROR';
}

export interface UsbScanResult {
  totalUsbDevices: number;
  yamahaDevices: UsbDeviceInfo[];
  scanError?: string;
}

export function scanUsbDevices(
  deviceListProvider: () => usb.Device[] = () => usb.getDeviceList()
): UsbScanResult {
  try {
    const devices = deviceListProvider();
    const yamahaDevices: UsbDeviceInfo[] = [];

    for (const dev of devices) {
      const desc = dev.deviceDescriptor;
      if (!desc) continue;
      const vidNum = desc.idVendor;
      const pidNum = desc.idProduct;
      const isYamaha = vidNum === YAMAHA_VID;
      if (!isYamaha) continue;

      let interfaceCount = 0;
      const endpointsSummary: string[] = [];
      try {
        const cfg = dev.configDescriptor;
        if (cfg && Array.isArray(cfg.interfaces)) {
          interfaceCount = cfg.interfaces.length;
          cfg.interfaces.forEach((altSettings, ifaceIdx) => {
            const firstAlt = altSettings?.[0];
            if (!firstAlt) return;
            const eps = (firstAlt.endpoints || []).map((ep) => {
              const dir = (ep.bEndpointAddress & 0x80) !== 0 ? 'IN' : 'OUT';
              return `ep0x${ep.bEndpointAddress.toString(16)}(${dir})`;
            });
            endpointsSummary.push(
              `if#${ifaceIdx} cls=0x${firstAlt.bInterfaceClass.toString(16)}/sub=0x${firstAlt.bInterfaceSubClass.toString(16)} [${eps.join(', ')}]`
            );
          });
        }
      } catch {
        // Descriptor inspection may fail on locked devices; still report VID/PID
      }

      const matchedModel = KNOWN_YAMAHA_MIXER_PIDS[pidNum] ?? null;
      yamahaDevices.push({
        vid: formatHexId(vidNum),
        pid: formatHexId(pidNum),
        vidNum,
        pidNum,
        busNumber: dev.busNumber ?? 0,
        deviceAddress: dev.deviceAddress ?? 0,
        isYamaha: true,
        isKnown01V96: pidNum === YAMAHA_01V96_PID,
        matchedModel,
        interfaceCount,
        endpointsSummary,
      });
    }

    return {
      totalUsbDevices: devices.length,
      yamahaDevices,
    };
  } catch (err) {
    return {
      totalUsbDevices: 0,
      yamahaDevices: [],
      scanError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildDiagnosticHints(params: {
  platform: string;
  inDocker: boolean;
  connected: boolean;
  totalUsbDevices: number;
  yamahaDevices: UsbDeviceInfo[];
  lastError: string | null;
  lastErrorCode: string | null;
}): DiagnosticHint[] {
  const hints: DiagnosticHint[] = [];
  const { platform, inDocker, connected, totalUsbDevices, yamahaDevices, lastErrorCode } = params;

  if (connected) {
    hints.push({
      severity: 'ok',
      title: 'Connessione USB attiva',
      detail:
        'Il mixer è collegato e aperto via libusb. Se i fader o i meter non rispondono, usa "Testa Handshake SysEx" per verificare DIO/SETUP → MIDI/HOST e MIDI → SETUP sul mixer.',
    });
    return hints;
  }

  if (inDocker && totalUsbDevices === 0) {
    hints.push({
      severity: 'error',
      title: 'Container Docker senza accesso USB',
      detail:
        'Nessun dispositivo USB visibile nel container. Su macOS/Windows Docker Desktop non supporta il passthrough USB: avvia 01V96 Studio nativamente con "npm start". Su Linux verifica "privileged: true" e "/dev/bus/usb:/dev/bus/usb" in docker-compose.yml.',
    });
  }

  if (lastErrorCode === 'LIBUSB_ERROR_ACCESS' || lastErrorCode === 'LIBUSB_ERROR_BUSY') {
    if (platform === 'darwin') {
      hints.push({
        severity: 'error',
        title: 'Conflitto driver Yamaha USB-MIDI / CoreMIDI su macOS',
        detail:
          'macOS o il driver ufficiale Yamaha USB-MIDI ha già impegnato la porta USB del mixer, bloccando l\'accesso diretto di libusb (LIBUSB_ERROR_ACCESS). Chiudi Studio Manager / DAW aperte; se il driver Yamaha USB-MIDI è installato in /Library/Audio/MIDI Drivers/, macOS aggancia automaticamente il mixer impedendo il claim via libusb.',
      });
    } else if (platform === 'linux') {
      hints.push({
        severity: 'error',
        title: 'Permessi USB insufficienti su Linux',
        detail:
          'Aggiungi la regola udev (/etc/udev/rules.d/99-yamaha-01v96.rules con MODE="0666", GROUP="audio") e verifica che l\'utente appartenga ai gruppi audio e plugdev.',
      });
    } else {
      hints.push({
        severity: 'error',
        title: 'Accesso USB negato dal sistema operativo',
        detail:
          'Un altro programma o driver di sistema sta bloccando il dispositivo USB (LIBUSB_ERROR_ACCESS/BUSY). Chiudi Studio Manager o altre app MIDI.',
      });
    }
  }

  const hasClassic01V96 = yamahaDevices.some((d) => d.pidNum === YAMAHA_01V96_PID);
  const otherYamaha = yamahaDevices.filter((d) => d.pidNum !== YAMAHA_01V96_PID);

  if (!hasClassic01V96 && otherYamaha.length > 0) {
    const pids = otherYamaha.map((d) => `${d.pid}${d.matchedModel ? ` (${d.matchedModel})` : ''}`).join(', ');
    hints.push({
      severity: 'warn',
      title: 'Rilevato dispositivo Yamaha con PID diverso da 0x5008',
      detail: `Trovato: ${pids}. Lo 01V96 / V2 / VCM usa PID 0x5008; modelli come 01V96i usano un PID diverso. Puoi provare a connetterti selezionando il dispositivo rilevato qui sotto.`,
    });
  }

  if (yamahaDevices.length === 0 && !(inDocker && totalUsbDevices === 0)) {
    hints.push({
      severity: 'warn',
      title: 'Nessun dispositivo Yamaha (VID 0x0499) rilevato dal sistema',
      detail:
        'Il sistema operativo non vede alcun mixer Yamaha sulla porta USB. Verifica che il mixer sia acceso, controlla il cavo USB Type-B e — su Mac USB-C — prova un adattatore o cavo USB-B→USB-C diretto bypassando hub multiporta economici.',
    });
  }

  return hints;
}

/**
 * Encodes a raw MIDI / SysEx byte array into 4-byte USB-MIDI 1.0 Event Packets
 */
export function encodeSysExToUsbMidi(sysex: number[], cable = 0): Buffer {
  const packets: number[] = [];
  const prefix = (cable & 0x0f) << 4;
  let i = 0;
  const n = sysex.length;

  // Handle non-SysEx standard MIDI messages (e.g. Program Change 0xCn)
  if (n > 0 && sysex[0] !== 0xf0) {
    const status = sysex[0] & 0xf0;
    const cin = status >> 4;
    packets.push(
      prefix | cin,
      sysex[0] ?? 0,
      sysex[1] ?? 0,
      sysex[2] ?? 0
    );
    return Buffer.from(packets);
  }

  while (i < n) {
    const rem = n - i;
    if (rem > 3) {
      packets.push(prefix | 0x04, sysex[i], sysex[i + 1], sysex[i + 2]);
      i += 3;
    } else if (rem === 3) {
      packets.push(prefix | 0x07, sysex[i], sysex[i + 1], sysex[i + 2]);
      i += 3;
    } else if (rem === 2) {
      packets.push(prefix | 0x06, sysex[i], sysex[i + 1], 0x00);
      i += 2;
    } else if (rem === 1) {
      packets.push(prefix | 0x05, sysex[i], 0x00, 0x00);
      i += 1;
    }
  }

  return Buffer.from(packets);
}

/**
 * Stateful parser that extracts complete SysEx (F0..F7) and Program Change messages
 * from incoming 64-byte USB-MIDI bulk buffers.
 */
export class UsbMidiStreamParser {
  private currentSysEx: number[] = [];
  private inSysEx = false;

  parseChunk(buf: Buffer, onMessage: (msg: number[]) => void): void {
    for (let i = 0; i + 3 < buf.length; i += 4) {
      const header = buf[i];
      if (header === 0) continue;
      const cin = header & 0x0f;
      const b1 = buf[i + 1];
      const b2 = buf[i + 2];
      const b3 = buf[i + 3];

      if (cin === 0x04) {
        // SysEx start or continue (3 bytes)
        this.pushSysExByte(b1, onMessage);
        this.pushSysExByte(b2, onMessage);
        this.pushSysExByte(b3, onMessage);
      } else if (cin === 0x05) {
        // SysEx ends with 1 byte
        this.pushSysExByte(b1, onMessage);
      } else if (cin === 0x06) {
        // SysEx ends with 2 bytes
        this.pushSysExByte(b1, onMessage);
        this.pushSysExByte(b2, onMessage);
      } else if (cin === 0x07) {
        // SysEx ends with 3 bytes
        this.pushSysExByte(b1, onMessage);
        this.pushSysExByte(b2, onMessage);
        this.pushSysExByte(b3, onMessage);
      } else if (cin === 0x0c) {
        // Program Change (2 bytes)
        onMessage([b1, b2]);
      } else if (cin === 0x0b) {
        // Control Change (3 bytes)
        onMessage([b1, b2, b3]);
      }
    }
  }

  private pushSysExByte(byte: number, onMessage: (msg: number[]) => void): void {
    if (byte === 0xf0) {
      this.currentSysEx = [0xf0];
      this.inSysEx = true;
    } else if (this.inSysEx) {
      this.currentSysEx.push(byte);
      if (byte === 0xf7) {
        this.inSysEx = false;
        onMessage(this.currentSysEx);
        this.currentSysEx = [];
      }
    }
  }
}

interface QueueItem {
  chunks: Buffer[];
  resolve: () => void;
  key?: string;
}

export class YamahaUsbTransport {
  private device: usb.Device | null = null;
  private iface: usb.Interface | null = null;
  private outEndpoint: usb.OutEndpoint | null = null;
  private inEndpoint: usb.InEndpoint | null = null;
  private parser = new UsbMidiStreamParser();
  private connected = false;
  private onMessageCallback: ((msg: number[]) => void) | null = null;
  private onStatusChangeCallback: ((connected: boolean) => void) | null = null;
  private highQueue: QueueItem[] = [];
  private lowQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private readonly PACING_MS = 1;
  private defaultCable = 0;
  private targetPid = YAMAHA_01V96_PID;
  private activePid: number | null = null;
  private activeInterfaceIndex: number | null = null;
  private lastError: string | null = null;
  private lastErrorCode: string | null = null;
  private lastAttemptAt: string | null = null;

  onMessage(cb: (msg: number[]) => void): void {
    this.onMessageCallback = cb;
  }

  onStatusChange(cb: (connected: boolean) => void): void {
    this.onStatusChangeCallback = cb;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDefaultCable(): number {
    return this.defaultCable;
  }

  setDefaultCable(cable: number): void {
    if (Number.isInteger(cable) && cable >= 0 && cable <= 7) {
      this.defaultCable = cable;
    }
  }

  getLastError(): { message: string | null; code: string | null; at: string | null } {
    return {
      message: this.lastError,
      code: this.lastErrorCode,
      at: this.lastAttemptAt,
    };
  }

  connect(pidOverride?: number): boolean {
    this.lastAttemptAt = new Date().toISOString();
    if (typeof pidOverride === 'number' && Number.isInteger(pidOverride) && pidOverride > 0) {
      this.targetPid = pidOverride;
    }
    const pid = this.targetPid;

    try {
      const dev = usb.findByIds(YAMAHA_VID, pid);
      if (!dev) {
        this.lastError = `Yamaha USB device (${formatHexId(YAMAHA_VID)}:${formatHexId(pid)}) not found`;
        this.lastErrorCode = 'NO_DEVICE';
        this.setConnected(false);
        return false;
      }

      dev.open();

      // Locate an interface that exposes both IN and OUT bulk/interrupt endpoints
      // (interface 0 for classic 01V96/V2/VCM; higher index on composite devices like 01V96i)
      const allIfaces = dev.interfaces ?? [dev.interface(0)];
      let chosenIface: usb.Interface | null = null;
      let chosenIfaceIdx = 0;
      let outEp: usb.OutEndpoint | undefined;
      let inEp: usb.InEndpoint | undefined;

      for (let idx = 0; idx < allIfaces.length; idx++) {
        const candidate = allIfaces[idx];
        const cOut = candidate.endpoints.find((e): e is usb.OutEndpoint => e.direction === 'out');
        const cIn = candidate.endpoints.find((e): e is usb.InEndpoint => e.direction === 'in');
        if (cOut && cIn) {
          chosenIface = candidate;
          chosenIfaceIdx = candidate.interfaceNumber ?? idx;
          outEp = cOut;
          inEp = cIn;
          break;
        }
      }

      if (!chosenIface || !outEp || !inEp) {
        try {
          dev.close();
        } catch {
          // ignore
        }
        throw new Error(`Could not find USB IN/OUT endpoints on ${formatHexId(YAMAHA_VID)}:${formatHexId(pid)}`);
      }

      try {
        if (process.platform === 'linux' && chosenIface.isKernelDriverActive()) {
          chosenIface.detachKernelDriver();
        }
      } catch {
        // Ignore on macOS
      }

      try {
        chosenIface.claim();
      } catch (claimErr) {
        try {
          dev.close();
        } catch {
          // ignore
        }
        throw claimErr;
      }

      this.device = dev;
      this.iface = chosenIface;
      this.outEndpoint = outEp;
      this.inEndpoint = inEp;
      this.activePid = pid;
      this.activeInterfaceIndex = chosenIfaceIdx;
      this.lastError = null;
      this.lastErrorCode = null;
      outEp.timeout = 500;

      inEp.on('data', (data: Buffer) => {
        if (this.onMessageCallback) {
          this.parser.parseChunk(data, this.onMessageCallback);
        }
      });

      inEp.on('error', (err) => {
        console.error('[USB IN Error]', err?.message || err);
        const errMsg = err?.message || '';
        this.lastError = errMsg || 'USB IN error';
        this.lastErrorCode = extractLibUsbErrorCode(errMsg);
        if (
          errMsg.includes('LIBUSB_ERROR_NO_DEVICE') ||
          errMsg.includes('LIBUSB_ERROR_NOT_FOUND') ||
          errMsg.includes('device not open')
        ) {
          this.disconnect();
          return;
        }
        inEp.clearHalt(() => {
          if (!this.connected) return;
          try {
            if (this.inEndpoint && !(this.inEndpoint as any).pollActive) {
              this.inEndpoint.startPoll(3, 64);
            }
          } catch (restartErr) {
            console.error('Failed to restart USB IN poll:', restartErr);
            this.disconnect();
          }
        });
      });

      // Clear any residual stalls from previous sessions before starting poll
      inEp.clearHalt(() => {});
      outEp.clearHalt(() => {});

      inEp.startPoll(3, 64);
      this.setConnected(true);
      const modelName = KNOWN_YAMAHA_MIXER_PIDS[pid] ?? `Yamaha USB (${formatHexId(pid)})`;
      console.log(
        `✅ Connected directly via USB to ${modelName} (${formatHexId(YAMAHA_VID)}:${formatHexId(pid)}, if#${chosenIfaceIdx})`
      );
      return true;
    } catch (err) {
      const msg = (err as Error).message || String(err);
      this.lastError = msg;
      this.lastErrorCode = extractLibUsbErrorCode(msg);
      console.warn('⚠️ Could not open Yamaha 01V96 USB device:', msg);
      this.setConnected(false);
      return false;
    }
  }

  getDiagnostics(
    midiChannel = 1,
    deviceListProvider?: () => usb.Device[]
  ): UsbDiagnosticsReport {
    const scan = scanUsbDevices(deviceListProvider);
    const inDocker = detectDocker();
    const platform = process.platform;
    const effectiveLastError = this.lastError ?? scan.scanError ?? null;
    const effectiveErrorCode =
      this.lastErrorCode ?? (scan.scanError ? extractLibUsbErrorCode(scan.scanError) : null);

    const activeDevice =
      this.connected && this.activePid !== null
        ? {
            vid: formatHexId(YAMAHA_VID),
            pid: formatHexId(this.activePid),
            model: KNOWN_YAMAHA_MIXER_PIDS[this.activePid] ?? `Yamaha USB (${formatHexId(this.activePid)})`,
            interfaceIndex: this.activeInterfaceIndex ?? 0,
            cable: this.defaultCable,
            midiChannel,
          }
        : null;

    const hints = buildDiagnosticHints({
      platform,
      inDocker,
      connected: this.connected,
      totalUsbDevices: scan.totalUsbDevices,
      yamahaDevices: scan.yamahaDevices,
      lastError: effectiveLastError,
      lastErrorCode: effectiveErrorCode,
    });

    return {
      timestamp: new Date().toISOString(),
      platform,
      arch: process.arch,
      nodeVersion: process.version,
      inDocker,
      appVersion: APP_VERSION,
      connected: this.connected,
      connectionMode: this.connected ? 'usb-direct' : 'simulated',
      activeDevice,
      lastError: effectiveLastError,
      lastErrorCode: effectiveErrorCode,
      lastAttemptAt: this.lastAttemptAt,
      totalUsbDevices: scan.totalUsbDevices,
      yamahaDevices: scan.yamahaDevices,
      hints,
    };
  }

  getQueueLength(): number {
    return this.highQueue.length + this.lowQueue.length;
  }

  getHighQueueLength(): number {
    return this.highQueue.length;
  }

  getLowQueueLength(): number {
    return this.lowQueue.length;
  }

  clearLowPriorityQueue(): void {
    while (this.lowQueue.length > 0) {
      this.lowQueue.shift()?.resolve();
    }
  }

  sendSysEx(
    sysex: number[],
    priority: 'high' | 'low' = 'high',
    cable: number = this.defaultCable
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected || !this.outEndpoint) {
        resolve();
        return;
      }
      const packet = encodeSysExToUsbMidi(sysex, cable);
      // Split into 64-byte chunks if larger than maxPacketSize
      const chunks: Buffer[] = [];
      for (let i = 0; i < packet.length; i += 64) {
        chunks.push(packet.subarray(i, i + 64));
      }

      let key: string | undefined;
      // Coalescing: key parameter changes by (model, elem, param, channel)
      if (sysex.length >= 8 && sysex[0] === 0xf0 && sysex[1] === 0x43) {
        key = `${sysex[3]}:${sysex[4]}:${sysex[5]}:${sysex[6]}`;
      }

      if (priority === 'high') {
        if (key) {
          const existingIdx = this.highQueue.findIndex((item) => item.key === key);
          if (existingIdx !== -1) {
            const old = this.highQueue[existingIdx];
            this.highQueue[existingIdx] = { chunks, resolve, key };
            old.resolve();
            this.processQueue();
            return;
          }
        }
        this.highQueue.push({ chunks, resolve, key });
      } else {
        this.lowQueue.push({ chunks, resolve });
      }
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.highQueue.length > 0 || this.lowQueue.length > 0) {
      // High priority always processed first
      const item = this.highQueue.length > 0 ? this.highQueue.shift() : this.lowQueue.shift();
      if (!item) break;

      if (!this.connected || !this.outEndpoint) {
        item.resolve();
        continue;
      }

      for (const chunk of item.chunks) {
        if (!this.outEndpoint) break;
        await new Promise<void>((resChunk) => {
          this.outEndpoint!.transfer(chunk, (err) => {
            if (err) {
              console.error('[USB OUT Error]', err.message);
              this.outEndpoint?.clearHalt(() => {});
              const errMsg = err.message || '';
              if (
                errMsg.includes('LIBUSB_ERROR_NO_DEVICE') ||
                errMsg.includes('LIBUSB_ERROR_NOT_FOUND') ||
                errMsg.includes('device not open') ||
                errMsg.includes('LIBUSB_TRANSFER_ERROR')
              ) {
                this.disconnect();
              }
            }
            resChunk();
          });
        });
      }

      item.resolve();

      const totalRemaining = this.highQueue.length + this.lowQueue.length;
      if (this.PACING_MS > 0 && totalRemaining > 0) {
        await new Promise((r) => setTimeout(r, this.PACING_MS));
      }
    }

    this.isProcessingQueue = false;
  }

  disconnect(): void {
    try {
      if (this.inEndpoint && (this.inEndpoint as any).pollActive) {
        this.inEndpoint.stopPoll(() => {
          this.cleanupDevice();
        });
      } else {
        this.cleanupDevice();
      }
    } catch {
      this.cleanupDevice();
    }
  }

  private cleanupDevice(): void {
    while (this.highQueue.length > 0) {
      this.highQueue.shift()?.resolve();
    }
    while (this.lowQueue.length > 0) {
      this.lowQueue.shift()?.resolve();
    }
    this.isProcessingQueue = false;

    try {
      if (this.iface) {
        this.iface.release(true, () => {
          try {
            this.device?.close();
          } catch {
            // ignore
          }
        });
      }
    } catch {
      // ignore
    } finally {
      this.device = null;
      this.iface = null;
      this.outEndpoint = null;
      this.inEndpoint = null;
      this.activePid = null;
      this.activeInterfaceIndex = null;
      this.setConnected(false);
    }
  }

  private setConnected(val: boolean): void {
    if (this.connected !== val) {
      this.connected = val;
      this.onStatusChangeCallback?.(val);
    }
  }
}
