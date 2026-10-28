import { describe, expect, it } from 'vitest';
import { validateClientCommand } from '../shared/validators.js';

describe('Zod ClientCommand Validation (P2)', () => {
  it('accepts valid set_fader command', () => {
    const res = validateClientCommand({
      type: 'set_fader',
      target: 'ch',
      id: 1,
      value: 823,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.type).toBe('set_fader');
      expect((res.data as any).value).toBe(823);
    }
  });

  it('rejects set_fader with NaN, negative, or >1023 values', () => {
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: NaN }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: -1 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: 1024 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 1, value: Infinity }).success).toBe(false);
  });

  it('rejects invalid channel id (0, 33, non-integer)', () => {
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 0, value: 500 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 33, value: 500 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_fader', target: 'ch', id: 2.5, value: 500 }).success).toBe(false);
  });

  it('rejects invalid target on set_fader', () => {
    expect(validateClientCommand({ type: 'set_fader', target: 'master_bus', id: 1, value: 500 }).success).toBe(false);
  });

  it('validates set_pan bounds (-63 to 63)', () => {
    expect(validateClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: -63 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: 0 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: 63 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: -64 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_pan', target: 'ch', id: 1, value: 64 }).success).toBe(false);
  });

  it('validates set_att bounds (-960 to 180, allowing negative attenuation)', () => {
    expect(validateClientCommand({ type: 'set_att', id: 1, value: -960 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: -360 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: -10 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: 0 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: 180 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: -961 }).success).toBe(false);
    expect(validateClientCommand({ type: 'set_att', id: 1, value: 181 }).success).toBe(false);
  });

  it('validates set_comp and set_delay commands', () => {
    expect(
      validateClientCommand({ type: 'set_comp', target: 'ch', id: 3, param: 'on', value: true }).success
    ).toBe(true);
    expect(
      validateClientCommand({ type: 'set_comp', id: 3, param: 'on', value: true }).success
    ).toBe(true);
    expect(
      validateClientCommand({ type: 'set_delay', id: 1, on: true, time: 250 }).success
    ).toBe(true);
    expect(
      validateClientCommand({ type: 'set_delay', id: 1, on: false, time: 1001 }).success
    ).toBe(false);
  });

  it('validates sceneNumber bounds (0 to 99)', () => {
    expect(validateClientCommand({ type: 'recall_scene', sceneNumber: 0 }).success).toBe(true);
    expect(validateClientCommand({ type: 'recall_scene', sceneNumber: 99 }).success).toBe(true);
    expect(validateClientCommand({ type: 'recall_scene', sceneNumber: 100 }).success).toBe(false);
    expect(validateClientCommand({ type: 'recall_scene', sceneNumber: -1 }).success).toBe(false);
  });

  it('validates set_name length and targets', () => {
    expect(validateClientCommand({ type: 'set_name', target: 'ch', id: 1, name: 'Vocal 1' }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_name', target: 'aux', id: 2, name: 'Monitor' }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_name', target: 'bus', id: 3, name: 'Drums' }).success).toBe(true);
    // Over 32 characters should be rejected
    expect(
      validateClientCommand({
        type: 'set_name',
        target: 'ch',
        id: 1,
        name: 'A'.repeat(33),
      }).success
    ).toBe(false);
  });

  it('validates set_routing requiring busIndex for bus target', () => {
    // Valid stereo and direct routing
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'stereo', value: true }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'direct', value: false }).success).toBe(true);

    // Bus routing with valid busIndex (0..7)
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'bus', busIndex: 0, value: true }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'bus', busIndex: 7, value: false }).success).toBe(true);

    // Bus routing missing busIndex MUST be rejected
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'bus', value: true }).success).toBe(false);
    // Invalid busIndex out of bounds
    expect(validateClientCommand({ type: 'set_routing', id: 1, target: 'bus', busIndex: 8, value: true }).success).toBe(false);
  });

  it('validates set_effect parameters', () => {
    expect(validateClientCommand({ type: 'set_effect', rackId: 1, param: 'mix', value: 50 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_effect', rackId: 2, param: 'param1', value: 120 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_effect', rackId: 3, param: 'param8', value: 0 }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_effect', rackId: 4, param: 'bypass', value: true }).success).toBe(true);
    expect(validateClientCommand({ type: 'set_effect', rackId: 1, param: 'invalid_param', value: 10 }).success).toBe(false);
  });

  it('rejects malformed or empty payloads', () => {
    expect(validateClientCommand(null).success).toBe(false);
    expect(validateClientCommand(undefined).success).toBe(false);
    expect(validateClientCommand({}).success).toBe(false);
    expect(validateClientCommand({ type: 'unknown_command' }).success).toBe(false);
  });
});
