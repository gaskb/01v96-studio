export type WidgetId =
  | 'meter_vertical'
  | 'eq_graph'
  | 'eq_high'
  | 'eq_himid'
  | 'eq_lomid'
  | 'eq_low'
  | 'preamp'
  | 'compressor'
  | 'gate'
  | 'aux_1_2'
  | 'aux_3_4'
  | 'aux_5_6'
  | 'aux_7_8'
  | 'routing'
  // Backward compatibility aliases
  | 'meter_preamp'
  | 'eq_bands'
  | 'aux_sends';

export interface WidgetLayoutItem {
  id: WidgetId;
  colStart?: number; // 1..gridCols horizontal coordinate in rack grid
  rowStart?: number; // 1..gridRows vertical coordinate in rack grid
  colSpan: number; // 1..gridCols width
  rowSpan?: number; // 1..gridRows height
  visible: boolean;
  minHeight?: number;
}

export interface ChannelLayoutConfig {
  presetName?: string;
  gridCols?: number; // 12..36 (default: 24)
  gridRows?: number; // 1..6 (default: 4)
  items: WidgetLayoutItem[];
}

export interface WidgetMeta {
  id: WidgetId;
  name: string;
  shortName: string;
  category: 'metering' | 'eq' | 'dynamics' | 'sends' | 'routing';
  color: string;
  description: string;
  defaultHeight: number; // 1, 2, or 4
}

export const WIDGET_META_MAP: Record<WidgetId, WidgetMeta> = {
  meter_vertical: {
    id: 'meter_vertical',
    name: 'Indicatori di Livello (IN / GR / OUT)',
    shortName: 'METERS',
    category: 'metering',
    color: '#06b6d4',
    description: 'Torre LED verticale di livello Pre/Post DSP e Gain Reduction',
    defaultHeight: 4,
  },
  meter_preamp: {
    id: 'meter_preamp',
    name: 'Indicatori di Livello',
    shortName: 'METERS',
    category: 'metering',
    color: '#06b6d4',
    description: 'Indicatori di livello Pre/Post DSP',
    defaultHeight: 4,
  },
  eq_graph: {
    id: 'eq_graph',
    name: 'Analizzatore di Spettro & Curva EQ',
    shortName: 'SPETTRO EQ',
    category: 'eq',
    color: '#38bdf8',
    description: 'Display grafico FFT interattivo della risposta in frequenza a 4 bande',
    defaultHeight: 2,
  },
  eq_high: {
    id: 'eq_high',
    name: 'EQ Banda HIGH (Acuti)',
    shortName: 'EQ HIGH',
    category: 'eq',
    color: '#06b6d4',
    description: 'Banda acuta dell\'equalizzatore (Gain, Freq, Q / Shelf / HPF)',
    defaultHeight: 1,
  },
  eq_himid: {
    id: 'eq_himid',
    name: 'EQ Banda HI-MID (Medio-Acuti)',
    shortName: 'EQ HI-MID',
    category: 'eq',
    color: '#10b981',
    description: 'Banda medio-alta dell\'equalizzatore (Gain, Freq, Q)',
    defaultHeight: 1,
  },
  eq_lomid: {
    id: 'eq_lomid',
    name: 'EQ Banda LO-MID (Medio-Bassi)',
    shortName: 'EQ LO-MID',
    category: 'eq',
    color: '#f59e0b',
    description: 'Banda medio-bassa dell\'equalizzatore (Gain, Freq, Q)',
    defaultHeight: 1,
  },
  eq_low: {
    id: 'eq_low',
    name: 'EQ Banda LOW (Bassi)',
    shortName: 'EQ LOW',
    category: 'eq',
    color: '#ef4444',
    description: 'Banda grave dell\'equalizzatore (Gain, Freq, Q / Shelf / LPF)',
    defaultHeight: 1,
  },
  eq_bands: {
    id: 'eq_bands',
    name: 'Stack 4 Bande Parametriche EQ',
    shortName: '4-BAND EQ',
    category: 'eq',
    color: '#a855f7',
    description: 'Tutte le 4 bande EQ insieme',
    defaultHeight: 4,
  },
  preamp: {
    id: 'preamp',
    name: 'Preamp (ATTEN & PAN)',
    shortName: 'PREAMP',
    category: 'dynamics',
    color: '#22d3ee',
    description: 'Attenuazione di ingresso (ATTEN) e bilanciamento stereo (PAN)',
    defaultHeight: 2,
  },
  compressor: {
    id: 'compressor',
    name: 'Compressore Dinamico',
    shortName: 'COMPRESSOR',
    category: 'dynamics',
    color: '#22d3ee',
    description: 'Modulo dinamiche: Threshold, Ratio, Gain Makeup, Release e toggle ON/OFF',
    defaultHeight: 2,
  },
  gate: {
    id: 'gate',
    name: 'Noise Gate Dinamico',
    shortName: 'NOISE GATE',
    category: 'dynamics',
    color: '#f59e0b',
    description: 'Modulo dinamiche: Threshold, Range, Attack, Decay e toggle ON/OFF',
    defaultHeight: 2,
  },
  aux_1_2: {
    id: 'aux_1_2',
    name: 'Aux Sends 1 & 2',
    shortName: 'AUX 1-2',
    category: 'sends',
    color: '#eab308',
    description: 'Coppia mandate ausiliarie Aux 1 e Aux 2 con selettori PRE/POST',
    defaultHeight: 1,
  },
  aux_3_4: {
    id: 'aux_3_4',
    name: 'Aux Sends 3 & 4',
    shortName: 'AUX 3-4',
    category: 'sends',
    color: '#eab308',
    description: 'Coppia mandate ausiliarie Aux 3 e Aux 4 con selettori PRE/POST',
    defaultHeight: 1,
  },
  aux_5_6: {
    id: 'aux_5_6',
    name: 'Aux Sends 5 & 6',
    shortName: 'AUX 5-6',
    category: 'sends',
    color: '#eab308',
    description: 'Coppia mandate ausiliarie Aux 5 e Aux 6 con selettori PRE/POST',
    defaultHeight: 1,
  },
  aux_7_8: {
    id: 'aux_7_8',
    name: 'Aux Sends 7 & 8',
    shortName: 'AUX 7-8',
    category: 'sends',
    color: '#eab308',
    description: 'Coppia mandate ausiliarie Aux 7 e Aux 8 con selettori PRE/POST',
    defaultHeight: 1,
  },
  aux_sends: {
    id: 'aux_sends',
    name: 'Aux Sends 1 — 8',
    shortName: 'AUX 1-8',
    category: 'sends',
    color: '#eab308',
    description: 'Tutte le 8 mandate ausiliarie insieme',
    defaultHeight: 4,
  },
  routing: {
    id: 'routing',
    name: 'Bus Routing & Delay',
    shortName: 'ROUTING',
    category: 'routing',
    color: '#f43f5e',
    description: 'Routing uscite Stereo L/R, Direct Out, Bus 1-8 e delay di ingresso',
    defaultHeight: 4,
  },
};
