import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWidgetContent } from '../client/components/channel-layout/WidgetRenderer.js';
import { ALL_CORE_WIDGET_IDS } from '../client/components/channel-layout/defaultPresets.js';
import { WidgetId } from '../client/components/channel-layout/layoutTypes.js';
import { InputChannelState } from '../shared/types.js';

function createMockChannel(id: number = 1): InputChannelState {
  return {
    id,
    name: `CH${id}`,
    customLabel: 'Vocal 1',
    on: true,
    solo: false,
    fader: 823,
    pan: 0,
    phase: false,
    att: 0,
    pair: false,
    meterIn: 10,
    meterOut: 10,
    grDb: 0,
    eq: {
      on: true,
      mode: 0,
      hpfOn: false,
      lpfOn: false,
      low: { q: 41, freq: 36, gain: 0 },
      lowMid: { q: 23, freq: 65, gain: 0 },
      hiMid: { q: 23, freq: 92, gain: 0 },
      high: { q: 41, freq: 112, gain: 0 },
    },
    gate: {
      on: false,
      type: 0,
      threshold: -260,
      range: -560,
      attack: 10,
      hold: 60,
      decay: 44,
    },
    comp: {
      on: false,
      type: 0,
      threshold: -200,
      ratio: 5,
      attack: 30,
      release: 40,
      gain: 0,
      knee: 2,
    },
    routing: {
      stereo: true,
      direct: false,
      bus: [false, false, false, false, false, false, false, false],
    },
    auxSends: Array.from({ length: 8 }, () => ({
      on: true,
      pre: true,
      level: 0,
    })),
    delayOn: false,
    delayTime: 0,
    inputPatch: 0,
    directOutPatch: 0,
  };
}

describe('WidgetRenderer (src/client/components/channel-layout/WidgetRenderer.tsx)', () => {
  const ch = createMockChannel(1);
  const sendCommand = vi.fn();
  const auxNames = ['Aux 1', 'Aux 2', 'Aux 3', 'Aux 4', 'Aux 5', 'Aux 6', 'Aux 7', 'Aux 8'];
  const busNames = ['Bus 1', 'Bus 2', 'Bus 3', 'Bus 4', 'Bus 5', 'Bus 6', 'Bus 7', 'Bus 8'];

  it('renders valid React elements for all 14 core widget IDs', () => {
    for (const widgetId of ALL_CORE_WIDGET_IDS) {
      const element = renderWidgetContent(
        widgetId,
        ch,
        undefined,
        'direct',
        sendCommand,
        auxNames,
        busNames
      );

      expect(React.isValidElement(element)).toBe(true);
      expect(element).not.toBeNull();
    }
  });

  it('renders valid React elements for additional composite widgets (eq_bands, meter_preamp, aux_sends)', () => {
    const compositeWidgets: WidgetId[] = ['eq_bands', 'meter_preamp', 'aux_sends'];

    for (const widgetId of compositeWidgets) {
      const element = renderWidgetContent(
        widgetId,
        ch,
        ch, // with savedCh
        'scene_compare',
        sendCommand,
        auxNames,
        busNames
      );

      expect(React.isValidElement(element)).toBe(true);
    }
  });

  it('returns null for unknown / invalid widget ID', () => {
    const element = renderWidgetContent(
      'invalid_widget_xyz' as WidgetId,
      ch,
      undefined,
      'direct',
      sendCommand
    );

    expect(element).toBeNull();
  });

  it('safely handles missing auxNames and busNames', () => {
    const auxElement = renderWidgetContent(
      'aux_1_2',
      ch,
      undefined,
      'direct',
      sendCommand,
      undefined,
      undefined
    );

    expect(React.isValidElement(auxElement)).toBe(true);

    const routingElement = renderWidgetContent(
      'routing',
      ch,
      undefined,
      'direct',
      sendCommand
    );

    expect(React.isValidElement(routingElement)).toBe(true);
  });
});
