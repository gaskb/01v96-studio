import { describe, expect, it } from 'vitest';
import { YamahaUsbTransport } from '../server/usb-transport.js';

describe('YamahaUsbTransport FIFO Queue & Error Paths (P1/P2)', () => {
  it('safely resolves sendSysEx when USB transport is not connected without throwing', async () => {
    const transport = new YamahaUsbTransport();
    expect(transport.isConnected()).toBe(false);

    // Calling sendSysEx when not connected should resolve cleanly
    await expect(transport.sendSysEx([0xf0, 0x43, 0x10, 0xf7])).resolves.toBeUndefined();
  });

  it('handles disconnect and cleanup without unhandled exceptions', () => {
    const transport = new YamahaUsbTransport();
    let statusChangedTo: boolean | null = null;
    transport.onStatusChange((c) => {
      statusChangedTo = c;
    });

    transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });

  it('queues multiple concurrent sendSysEx requests and resolves them all', async () => {
    const transport = new YamahaUsbTransport();

    const p1 = transport.sendSysEx([0xf0, 0x43, 0x10, 0x3e, 0x02, 0x01, 0xf7]);
    const p2 = transport.sendSysEx([0xf0, 0x43, 0x10, 0x3e, 0x02, 0x02, 0xf7]);
    const p3 = transport.sendSysEx([0xf0, 0x43, 0x10, 0x3e, 0x02, 0x03, 0xf7]);

    await expect(Promise.all([p1, p2, p3])).resolves.toHaveLength(3);
  });

  it('manages high and low priority queues and clears low priority cleanly', async () => {
    const transport = new YamahaUsbTransport();

    // High and low priority sendSysEx resolve cleanly
    const h1 = transport.sendSysEx([0xf0, 0x43, 0x10, 0xf7], 'high');
    const l1 = transport.sendSysEx([0xf0, 0x43, 0x10, 0xf7], 'low');
    transport.clearLowPriorityQueue();

    await expect(Promise.all([h1, l1])).resolves.toBeDefined();
    expect(transport.getLowQueueLength()).toBe(0);
  });
});
