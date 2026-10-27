import { ChannelLayoutConfig, WIDGET_META_MAP, WidgetId, WidgetLayoutItem } from './layoutTypes';

export const STORAGE_KEY_LAYOUT = '01v96_channel_layout_v5';

export const ALL_CORE_WIDGET_IDS: WidgetId[] = [
  'meter_vertical',
  'eq_graph',
  'compressor',
  'eq_high',
  'eq_himid',
  'eq_lomid',
  'eq_low',
  'preamp',
  'gate',
  'aux_1_2',
  'aux_3_4',
  'aux_5_6',
  'aux_7_8',
  'routing',
];

export const PRESET_USER_MOCKUP: ChannelLayoutConfig = {
  presetName: 'Studio Console Integrata (Spazio 4x24)',
  gridCols: 24,
  gridRows: 4,
  items: [
    { id: 'meter_vertical', colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 4, visible: true },
    { id: 'eq_graph', colStart: 2, rowStart: 1, colSpan: 8, rowSpan: 2, visible: true },
    { id: 'compressor', colStart: 2, rowStart: 3, colSpan: 8, rowSpan: 2, visible: true },
    { id: 'eq_high', colStart: 10, rowStart: 1, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_himid', colStart: 10, rowStart: 2, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_lomid', colStart: 10, rowStart: 3, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_low', colStart: 10, rowStart: 4, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'preamp', colStart: 13, rowStart: 1, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'gate', colStart: 13, rowStart: 3, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'aux_1_2', colStart: 16, rowStart: 1, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_3_4', colStart: 16, rowStart: 2, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_5_6', colStart: 16, rowStart: 3, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_7_8', colStart: 16, rowStart: 4, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'routing', colStart: 21, rowStart: 1, colSpan: 4, rowSpan: 4, visible: true },
  ],
};

export const PRESET_CLASSIC_4COL: ChannelLayoutConfig = {
  presetName: 'Bande Separate & Dinamiche (4x24)',
  gridCols: 24,
  gridRows: 4,
  items: [
    { id: 'meter_vertical', colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 4, visible: true },
    { id: 'eq_graph', colStart: 2, rowStart: 1, colSpan: 7, rowSpan: 2, visible: true },
    { id: 'compressor', colStart: 2, rowStart: 3, colSpan: 7, rowSpan: 2, visible: true },
    { id: 'eq_high', colStart: 9, rowStart: 1, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'eq_himid', colStart: 9, rowStart: 2, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'eq_lomid', colStart: 9, rowStart: 3, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'eq_low', colStart: 9, rowStart: 4, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'preamp', colStart: 13, rowStart: 1, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'gate', colStart: 13, rowStart: 3, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'aux_1_2', colStart: 16, rowStart: 1, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_3_4', colStart: 16, rowStart: 2, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_5_6', colStart: 16, rowStart: 3, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'aux_7_8', colStart: 16, rowStart: 4, colSpan: 5, rowSpan: 1, visible: true },
    { id: 'routing', colStart: 21, rowStart: 1, colSpan: 4, rowSpan: 4, visible: true },
  ],
};

export const PRESET_EQ_FOCUS: ChannelLayoutConfig = {
  presetName: 'Focus EQ Spettro Wide (4x24)',
  gridCols: 24,
  gridRows: 4,
  items: [
    { id: 'meter_vertical', colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 4, visible: true },
    { id: 'eq_graph', colStart: 2, rowStart: 1, colSpan: 10, rowSpan: 2, visible: true },
    { id: 'compressor', colStart: 2, rowStart: 3, colSpan: 10, rowSpan: 2, visible: true },
    { id: 'eq_high', colStart: 12, rowStart: 1, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_himid', colStart: 12, rowStart: 2, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_lomid', colStart: 12, rowStart: 3, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'eq_low', colStart: 12, rowStart: 4, colSpan: 3, rowSpan: 1, visible: true },
    { id: 'preamp', colStart: 15, rowStart: 1, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'gate', colStart: 15, rowStart: 3, colSpan: 3, rowSpan: 2, visible: true },
    { id: 'aux_1_2', colStart: 18, rowStart: 1, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'aux_3_4', colStart: 18, rowStart: 2, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'aux_5_6', colStart: 18, rowStart: 3, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'aux_7_8', colStart: 18, rowStart: 4, colSpan: 4, rowSpan: 1, visible: true },
    { id: 'routing', colStart: 22, rowStart: 1, colSpan: 3, rowSpan: 4, visible: true },
  ],
};

export const BUILTIN_PRESETS: ChannelLayoutConfig[] = [
  PRESET_USER_MOCKUP,
  PRESET_CLASSIC_4COL,
  PRESET_EQ_FOCUS,
];

/**
 * Normalizes any layout configuration or imported JSON,
 * ensuring all 14 core widgets are present, spans are clamped,
 * gridCols is clamped between 12 and 36, gridRows is clamped between 1 and 6,
 * and exact coordinates are maintained within bounds.
 */
export function normalizeLayout(input?: unknown): ChannelLayoutConfig {
  if (!input || typeof input !== 'object') {
    return structuredClone(PRESET_USER_MOCKUP);
  }

  const raw = input as Partial<ChannelLayoutConfig>;
  const rawGridCols = Number(raw.gridCols);
  const gridCols = Math.max(12, Math.min(36, Number.isFinite(rawGridCols) ? rawGridCols : 24));
  const rawGridRows = Number(raw.gridRows);
  const gridRows = Math.max(1, Math.min(6, Number.isFinite(rawGridRows) ? rawGridRows : 4));

  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  const existingIds = new Set<string>();
  const normalizedItems: WidgetLayoutItem[] = [];

  for (const item of rawItems) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      let id = item.id as WidgetId;
      // Backward compatibility aliases
      if (id === 'meter_preamp') id = 'meter_vertical';

      // If user had old aggregate eq_bands or aux_sends, expand them
      if (id === 'eq_bands') {
        const bands: WidgetId[] = ['eq_high', 'eq_himid', 'eq_lomid', 'eq_low'];
        let r = 1;
        for (const b of bands) {
          if (!existingIds.has(b)) {
            existingIds.add(b);
            normalizedItems.push({ id: b, colStart: 10, rowStart: Math.min(gridRows, r++), colSpan: 3, rowSpan: 1, visible: item.visible !== false });
          }
        }
        continue;
      }

      if (id === 'aux_sends') {
        const auxes: WidgetId[] = ['aux_1_2', 'aux_3_4', 'aux_5_6', 'aux_7_8'];
        let r = 1;
        for (const a of auxes) {
          if (!existingIds.has(a)) {
            existingIds.add(a);
            normalizedItems.push({ id: a, colStart: 16, rowStart: Math.min(gridRows, r++), colSpan: 5, rowSpan: 1, visible: item.visible !== false });
          }
        }
        continue;
      }

      if (id in WIDGET_META_MAP && !existingIds.has(id)) {
        existingIds.add(id);
        const parsedCol = Number(item.colSpan);
        const colSpan = Math.max(1, Math.min(gridCols, Number.isFinite(parsedCol) ? parsedCol : 2));
        const defaultHeight = WIDGET_META_MAP[id]?.defaultHeight || 1;
        const parsedRow = Number(item.rowSpan);
        const rowSpan = Math.max(1, Math.min(gridRows, Number.isFinite(parsedRow) && parsedRow > 0 ? parsedRow : Math.min(gridRows, defaultHeight)));

        const defaultItem = PRESET_USER_MOCKUP.items.find((i) => i.id === id);
        const rawColStart = Number(item.colStart);
        const rawRowStart = Number(item.rowStart);

        const colStart = Math.max(
          1,
          Math.min(
            gridCols - colSpan + 1,
            Number.isFinite(rawColStart) && rawColStart >= 1 ? rawColStart : (defaultItem?.colStart || 1)
          )
        );

        const rowStart = Math.max(
          1,
          Math.min(
            gridRows - rowSpan + 1,
            Number.isFinite(rawRowStart) && rawRowStart >= 1 ? rawRowStart : (defaultItem?.rowStart || 1)
          )
        );

        const visible = item.visible !== false;
        normalizedItems.push({
          id,
          colStart,
          rowStart,
          colSpan,
          rowSpan,
          visible,
          minHeight: typeof item.minHeight === 'number' ? item.minHeight : undefined,
        });
      }
    }
  }

  // Ensure any missing core widgets are appended with sensible defaults
  for (const wid of ALL_CORE_WIDGET_IDS) {
    if (!existingIds.has(wid)) {
      const defaultItem = PRESET_USER_MOCKUP.items.find((i) => i.id === wid);
      const meta = WIDGET_META_MAP[wid];
      const rowSpan = Math.min(gridRows, meta?.defaultHeight || 1);
      normalizedItems.push(
        defaultItem
          ? {
              ...defaultItem,
              colSpan: Math.min(gridCols, defaultItem.colSpan),
              rowSpan: Math.min(gridRows, defaultItem.rowSpan || 1),
              colStart: Math.min(gridCols - Math.min(gridCols, defaultItem.colSpan) + 1, defaultItem.colStart || 1),
              rowStart: Math.min(gridRows - Math.min(gridRows, defaultItem.rowSpan || 1) + 1, defaultItem.rowStart || 1),
            }
          : { id: wid, colStart: 1, rowStart: 1, colSpan: 2, rowSpan, visible: true }
      );
    }
  }

  return {
    presetName: typeof raw.presetName === 'string' ? raw.presetName : `Personalizzato (${gridRows}x${gridCols})`,
    gridCols,
    gridRows,
    items: normalizedItems,
  };
}

export function loadStoredLayout(): ChannelLayoutConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return structuredClone(PRESET_USER_MOCKUP);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LAYOUT);
    if (!raw) return structuredClone(PRESET_USER_MOCKUP);
    const parsed = JSON.parse(raw);
    return normalizeLayout(parsed);
  } catch {
    return structuredClone(PRESET_USER_MOCKUP);
  }
}

export function saveStoredLayout(layout: ChannelLayoutConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(layout));
  } catch {
    // Ignore quota or disabled storage
  }
}

export function resetStoredLayout(): ChannelLayoutConfig {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY_LAYOUT);
    } catch {
      // Ignore
    }
  }
  return structuredClone(PRESET_USER_MOCKUP);
}

export function findNextAvailablePosition(
  items: WidgetLayoutItem[],
  gridCols: number,
  gridRows: number,
  colSpan: number,
  rowSpan: number
): { colStart: number; rowStart: number } {
  // Build grid occupancy matrix
  const occupied: boolean[][] = Array.from({ length: gridRows }, () =>
    Array(gridCols).fill(false)
  );

  for (const it of items) {
    if (!it.visible) continue;
    const cs = (it.colStart || 1) - 1;
    const rs = (it.rowStart || 1) - 1;
    const ce = Math.min(gridCols, cs + it.colSpan);
    const re = Math.min(gridRows, rs + (it.rowSpan || 1));
    for (let r = rs; r < re; r++) {
      for (let c = cs; c < ce; c++) {
        if (occupied[r]) occupied[r][c] = true;
      }
    }
  }

  // Scan for first rectangular slot that fits
  for (let r = 0; r <= gridRows - rowSpan; r++) {
    for (let c = 0; c <= gridCols - colSpan; c++) {
      let fits = true;
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (occupied[r + dr][c + dc]) {
            fits = false;
            break;
          }
        }
        if (!fits) break;
      }
      if (fits) {
        return { colStart: c + 1, rowStart: r + 1 };
      }
    }
  }

  // Fallback: place at col 1, row 1
  return { colStart: 1, rowStart: 1 };
}

export function insertWidgetIntoLayout(
  layout: ChannelLayoutConfig,
  widgetId: WidgetId
): { nextLayout: ChannelLayoutConfig; alreadyExists: boolean } {
  const gridCols = layout.gridCols || 24;
  const gridRows = layout.gridRows || 4;

  const existingIdx = layout.items.findIndex((i) => i.id === widgetId);
  if (existingIdx !== -1 && layout.items[existingIdx].visible) {
    return { nextLayout: layout, alreadyExists: true };
  }

  const meta = WIDGET_META_MAP[widgetId];
  let colSpan = 4;
  let rowSpan = meta?.defaultHeight || 2;

  if (widgetId === 'meter_vu') {
    colSpan = 8;
    rowSpan = 2;
  } else if (widgetId === 'meter_vertical' || widgetId === 'meter_preamp') {
    colSpan = 1;
    rowSpan = 4;
  } else if (widgetId === 'eq_graph') {
    colSpan = 7;
    rowSpan = 2;
  } else if (widgetId === 'compressor') {
    colSpan = 6;
    rowSpan = 2;
  } else if (widgetId === 'gate') {
    colSpan = 4;
    rowSpan = 2;
  } else if (widgetId === 'preamp') {
    colSpan = 3;
    rowSpan = 2;
  } else if (widgetId === 'routing') {
    colSpan = 4;
    rowSpan = 4;
  } else if (widgetId === 'eq_bands') {
    colSpan = 4;
    rowSpan = 4;
  } else if (widgetId === 'aux_sends') {
    colSpan = 5;
    rowSpan = 4;
  } else if (widgetId.startsWith('aux_')) {
    colSpan = 5;
    rowSpan = 1;
  } else if (widgetId.startsWith('eq_')) {
    colSpan = 3;
    rowSpan = 1;
  }

  colSpan = Math.max(1, Math.min(gridCols, colSpan));
  rowSpan = Math.max(1, Math.min(gridRows, rowSpan));

  const { colStart, rowStart } = findNextAvailablePosition(
    layout.items,
    gridCols,
    gridRows,
    colSpan,
    rowSpan
  );

  let nextItems: WidgetLayoutItem[];
  if (existingIdx !== -1) {
    nextItems = layout.items.map((it, idx) =>
      idx === existingIdx
        ? {
            ...it,
            visible: true,
            colStart,
            rowStart,
            colSpan,
            rowSpan,
          }
        : it
    );
  } else {
    nextItems = [
      ...layout.items,
      {
        id: widgetId,
        colStart,
        rowStart,
        colSpan,
        rowSpan,
        visible: true,
      },
    ];
  }

  const nextLayout: ChannelLayoutConfig = {
    ...layout,
    presetName: 'Personalizzato',
    items: nextItems,
  };

  return { nextLayout, alreadyExists: false };
}
