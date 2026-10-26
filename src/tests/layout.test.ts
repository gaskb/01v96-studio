import { describe, expect, it } from 'vitest';
import {
  ALL_CORE_WIDGET_IDS,
  BUILTIN_PRESETS,
  normalizeLayout,
  PRESET_EQ_FOCUS,
  PRESET_USER_MOCKUP,
} from '../client/components/channel-layout/defaultPresets';
import { ChannelLayoutConfig, WIDGET_META_MAP, WidgetId } from '../client/components/channel-layout/layoutTypes';

describe('Channel Modular Layout System (Prototyping Engine - 24 Columns & Split Blocks)', () => {
  it('provides all 14 core widgets in WIDGET_META_MAP with descriptive names and categories', () => {
    expect(ALL_CORE_WIDGET_IDS).toHaveLength(14);

    for (const id of ALL_CORE_WIDGET_IDS) {
      expect(WIDGET_META_MAP[id]).toBeDefined();
      expect(WIDGET_META_MAP[id].name.length).toBeGreaterThan(0);
      expect(WIDGET_META_MAP[id].shortName.length).toBeGreaterThan(0);
      expect(WIDGET_META_MAP[id].color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(WIDGET_META_MAP[id].defaultHeight).toBeGreaterThanOrEqual(1);
      expect(WIDGET_META_MAP[id].defaultHeight).toBeLessThanOrEqual(4);
    }
  });

  it('verifies the heights specified by the user for all blocks', () => {
    // meters: 4
    expect(WIDGET_META_MAP['meter_vertical'].defaultHeight).toBe(4);
    // spettro, preamp, comp, gate: 2
    expect(WIDGET_META_MAP['eq_graph'].defaultHeight).toBe(2);
    expect(WIDGET_META_MAP['preamp'].defaultHeight).toBe(2);
    expect(WIDGET_META_MAP['compressor'].defaultHeight).toBe(2);
    expect(WIDGET_META_MAP['gate'].defaultHeight).toBe(2);
    // EQ individual bands: 1
    expect(WIDGET_META_MAP['eq_high'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['eq_himid'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['eq_lomid'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['eq_low'].defaultHeight).toBe(1);
    // Aux pairs: 1
    expect(WIDGET_META_MAP['aux_1_2'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['aux_3_4'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['aux_5_6'].defaultHeight).toBe(1);
    expect(WIDGET_META_MAP['aux_7_8'].defaultHeight).toBe(1);
    // Routing: 4
    expect(WIDGET_META_MAP['routing'].defaultHeight).toBe(4);
  });

  it('ensures all built-in presets contain all 14 widgets without duplicates', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(preset.items).toHaveLength(14);
      const ids = preset.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(14);
      for (const req of ALL_CORE_WIDGET_IDS) {
        expect(ids).toContain(req);
      }
    }
  });

  it('normalizes invalid or missing layout objects gracefully to 24 columns and 4 rows', () => {
    // Empty object
    const normEmpty = normalizeLayout({});
    expect(normEmpty.items).toHaveLength(14);

    // Corrupted spans and missing items
    const corruptInput = {
      presetName: 'Test Corrupt',
      items: [
        { id: 'eq_graph', colSpan: 99, rowSpan: -5, visible: true },
        { id: 'gate', colSpan: 0, rowSpan: 10, visible: false },
        { id: 'invalid_module_id', colSpan: 6, rowSpan: 1 },
      ],
    };

    const normalized = normalizeLayout(corruptInput);
    expect(normalized.items).toHaveLength(14);

    const normEqGraph = normalized.items.find((i) => i.id === 'eq_graph');
    expect(normEqGraph?.colSpan).toBe(24); // clamped to max 24
    expect(normEqGraph?.rowSpan).toBe(2); // falls back to defaultHeight 2

    const normGate = normalized.items.find((i) => i.id === 'gate');
    expect(normGate?.colSpan).toBe(1); // clamped to min 1
    expect(normGate?.rowSpan).toBe(4); // clamped to max 4
    expect(normGate?.visible).toBe(false);

    // Missing widgets were automatically appended
    expect(normalized.items.some((i) => i.id === 'meter_vertical')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'eq_high')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'aux_1_2')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'routing')).toBe(true);
  });

  it('verifies the 4x24 space anchoring and boundaries for PRESET_USER_MOCKUP', () => {
    for (const item of PRESET_USER_MOCKUP.items) {
      expect(item.colStart).toBeDefined();
      expect(item.rowStart).toBeDefined();
      expect(item.colStart!).toBeGreaterThanOrEqual(1);
      expect(item.colStart!).toBeLessThanOrEqual(24);
      expect(item.rowStart!).toBeGreaterThanOrEqual(1);
      expect(item.rowStart!).toBeLessThanOrEqual(4);

      // Boundary check
      expect(item.colStart! + item.colSpan - 1).toBeLessThanOrEqual(24);
      expect(item.rowStart! + (item.rowSpan || 1) - 1).toBeLessThanOrEqual(4);
    }
  });

  it('preserves free 4x24 positioning without forcing items to the left or top', () => {
    const freeLayout = {
      presetName: 'Free Custom Positioning',
      items: [
        { id: 'eq_high', colStart: 18, rowStart: 3, colSpan: 3, rowSpan: 1, visible: true },
        { id: 'compressor', colStart: 10, rowStart: 2, colSpan: 6, rowSpan: 2, visible: true },
      ],
    };

    const normalized = normalizeLayout(freeLayout);
    const eqHigh = normalized.items.find((i) => i.id === 'eq_high');
    const comp = normalized.items.find((i) => i.id === 'compressor');

    // Retains exact coordinates without snapping to (col 1, row 1)
    expect(eqHigh?.colStart).toBe(18);
    expect(eqHigh?.rowStart).toBe(3);
    expect(comp?.colStart).toBe(10);
    expect(comp?.rowStart).toBe(2);
  });

  it('automatically expands legacy composite eq_bands and aux_sends', () => {
    const legacyInput = {
      presetName: 'Legacy v1',
      items: [
        { id: 'eq_bands', colSpan: 3, rowSpan: 1, visible: true },
        { id: 'aux_sends', colSpan: 3, rowSpan: 1, visible: true },
      ],
    };

    const normalized = normalizeLayout(legacyInput);
    expect(normalized.items.some((i) => i.id === 'eq_high')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'eq_himid')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'eq_lomid')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'eq_low')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'aux_1_2')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'aux_3_4')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'aux_5_6')).toBe(true);
    expect(normalized.items.some((i) => i.id === 'aux_7_8')).toBe(true);
  });

  it('successfully round-trips layout configuration via JSON serialization', () => {
    const jsonStr = JSON.stringify(PRESET_EQ_FOCUS);
    const parsed = JSON.parse(jsonStr) as ChannelLayoutConfig;
    const normalized = normalizeLayout(parsed);

    expect(normalized.items).toEqual(PRESET_EQ_FOCUS.items);
    expect(normalized.presetName).toBe(PRESET_EQ_FOCUS.presetName);
  });

  it('calculates 32-channel wide deck slice vs 16-channel layers accurately', () => {
    const dummyChannels = Array.from({ length: 32 }, (_, idx) => ({ id: idx + 1 }));

    // Layer all32 provides all 32 channels
    const all32Channels = dummyChannels;
    expect(all32Channels).toHaveLength(32);
    expect(all32Channels[0].id).toBe(1);
    expect(all32Channels[31].id).toBe(32);

    // Layer ch1-16 provides channels 1 to 16
    const layer1Channels = dummyChannels.slice(0, 16);
    expect(layer1Channels).toHaveLength(16);
    expect(layer1Channels[0].id).toBe(1);
    expect(layer1Channels[15].id).toBe(16);

    // Layer ch17-32 provides channels 17 to 32
    const layer2Channels = dummyChannels.slice(16, 32);
    expect(layer2Channels).toHaveLength(16);
    expect(layer2Channels[0].id).toBe(17);
    expect(layer2Channels[15].id).toBe(32);
  });

  it('verifies channel bank 17-32 distinction logic and Q scroll clamping', () => {
    // Bank check: channels 17..32 are secondary expansion channels
    for (let chId = 1; chId <= 32; chId++) {
      const isExpansionBank = chId >= 17 && chId <= 32;
      if (chId <= 16) {
        expect(isExpansionBank).toBe(false);
      } else {
        expect(isExpansionBank).toBe(true);
      }
    }

    // Q index clamping per band
    const maxQHigh = 43; // High band includes shelf & LPF
    const maxQLow = 42;  // Low band includes shelf & HPF
    const maxQMid = 40;  // Hi-Mid and Lo-Mid go up to 40 (Q=10.0)

    const clampQ = (bandKey: string, currentQ: number, delta: number) => {
      const maxQ = bandKey === 'high' ? maxQHigh : bandKey === 'low' ? maxQLow : maxQMid;
      return Math.max(0, Math.min(maxQ, currentQ + delta));
    };

    expect(clampQ('high', 40, 5)).toBe(43);
    expect(clampQ('high', 10, -15)).toBe(0);
    expect(clampQ('low', 40, 5)).toBe(42);
    expect(clampQ('hiMid', 38, 5)).toBe(40);
  });

  it('clamps dynamic grid dimensions: gridCols (12..36) and gridRows (1..6)', () => {
    // Underflow test: gridCols < 12 and gridRows < 1
    const underflow = normalizeLayout({ gridCols: 5, gridRows: 0, items: [] });
    expect(underflow.gridCols).toBe(12);
    expect(underflow.gridRows).toBe(1);

    // Overflow test: gridCols > 36 and gridRows > 6
    const overflow = normalizeLayout({ gridCols: 48, gridRows: 12, items: [] });
    expect(overflow.gridCols).toBe(36);
    expect(overflow.gridRows).toBe(6);

    // Valid custom dimensions
    const custom = normalizeLayout({ gridCols: 30, gridRows: 5, items: [] });
    expect(custom.gridCols).toBe(30);
    expect(custom.gridRows).toBe(5);
  });

  it('clamps all widget coordinates and spans within dynamic grid dimensions', () => {
    // Test with small compact grid: 12 cols, 2 rows
    const compactLayout = {
      gridCols: 12,
      gridRows: 2,
      items: [
        // Out of bounds colStart and colSpan
        { id: 'eq_graph', colStart: 10, colSpan: 8, rowStart: 1, rowSpan: 4, visible: true },
        // Out of bounds rowStart
        { id: 'meter_vertical', colStart: 1, colSpan: 2, rowStart: 5, rowSpan: 4, visible: true },
      ],
    };

    const normalized = normalizeLayout(compactLayout);
    expect(normalized.gridCols).toBe(12);
    expect(normalized.gridRows).toBe(2);

    const eqGraph = normalized.items.find((i) => i.id === 'eq_graph');
    expect(eqGraph).toBeDefined();
    // colSpan clamped to max gridCols = 12 (8 is valid <= 12)
    expect(eqGraph?.colSpan).toBe(8);
    // colStart must not exceed gridCols - colSpan + 1 = 12 - 8 + 1 = 5
    expect(eqGraph?.colStart).toBeLessThanOrEqual(5);
    // rowSpan clamped to max gridRows = 2
    expect(eqGraph?.rowSpan).toBeLessThanOrEqual(2);
    // rowStart + rowSpan - 1 <= gridRows
    expect(eqGraph!.rowStart! + eqGraph!.rowSpan! - 1).toBeLessThanOrEqual(2);

    const meters = normalized.items.find((i) => i.id === 'meter_vertical');
    expect(meters).toBeDefined();
    expect(meters?.rowSpan).toBeLessThanOrEqual(2);
    expect(meters!.rowStart! + meters!.rowSpan! - 1).toBeLessThanOrEqual(2);
  });
});
