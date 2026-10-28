import * as usb from 'usb';

export const YAMAHA_VID = 0x0499;
export const YAMAHA_01V96_PID = 0x5008;

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

  onMessage(cb: (msg: number[]) => void): void {
    this.onMessageCallback = cb;
  }

  onStatusChange(cb: (connected: boolean) => void): void {
    this.onStatusChangeCallback = cb;
  }

  isConnected(): boolean {
    return this.connected;
  }

  connect(): boolean {
    try {
      const dev = usb.findByIds(YAMAHA_VID, YAMAHA_01V96_PID);
      if (!dev) {
        this.setConnected(false);
        return false;
      }

      dev.open();
      const iface = dev.interface(0);
      try {
        if (process.platform === 'linux' && iface.isKernelDriverActive()) {
          iface.detachKernelDriver();
        }
      } catch {
        // Ignore on macOS
      }

      try {
        iface.claim();
      } catch (claimErr) {
        try {
          dev.close();
        } catch {
          // ignore
        }
        throw claimErr;
      }

      const outEp = iface.endpoints.find((e): e is usb.OutEndpoint => e.direction === 'out');
      const inEp = iface.endpoints.find((e): e is usb.InEndpoint => e.direction === 'in');

      if (!outEp || !inEp) {
        try {
          iface.release(true, () => {});
        } catch {
          // ignore
        }
        try {
          dev.close();
        } catch {
          // ignore
        }
        throw new Error('Could not find USB bulk IN/OUT endpoints on 01V96');
      }

      this.device = dev;
      this.iface = iface;
      this.outEndpoint = outEp;
      this.inEndpoint = inEp;
      outEp.timeout = 500;

      inEp.on('data', (data: Buffer) => {
        if (this.onMessageCallback) {
          this.parser.parseChunk(data, this.onMessageCallback);
        }
      });

      inEp.on('error', (err) => {
        console.error('[USB IN Error]', err?.message || err);
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
      console.log('✅ Connected directly via USB to YAMAHA 01V96 VCM (0x0499:0x5008)');
      return true;
    } catch (err) {
      console.warn('⚠️ Could not open Yamaha 01V96 USB device:', (err as Error).message);
      this.setConnected(false);
      return false;
    }
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

  sendSysEx(sysex: number[], priority: 'high' | 'low' = 'high'): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected || !this.outEndpoint) {
        resolve();
        return;
      }
      const packet = encodeSysExToUsbMidi(sysex, 0);
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
