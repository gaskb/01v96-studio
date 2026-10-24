// Yamaha 01V96 VCM SysEx Protocol Builder & Parser

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;
export const YAMAHA_ID = 0x43;
export const SUB_PARAM_CHANGE = 0x10;
export const SUB_PARAM_REQUEST = 0x30;
export const GROUP_DIGITAL_MIXER = 0x3e;
export const MODEL_UNIVERSAL = 0x7f;
export const MODEL_01V96 = 0x0d;

/**
 * Encodes a signed 28-bit integer into four 7-bit MIDI data bytes [d0, d1, d2, d3]
 */
export function intToDataBytes(val: number): [number, number, number, number] {
  const v = Math.round(val);
  const unsigned = v < 0 ? (1 << 28) + v : v;
  return [
    (unsigned >> 21) & 0x7f,
    (unsigned >> 14) & 0x7f,
    (unsigned >> 7) & 0x7f,
    unsigned & 0x7f,
  ];
}

/**
 * Decodes four 7-bit MIDI data bytes [d0, d1, d2, d3] into a signed 28-bit integer
 */
export function dataBytesToInt(d: number[]): number {
  if (d.length < 4) return 0;
  let val = ((d[0] & 0x7f) << 21) | ((d[1] & 0x7f) << 14) | ((d[2] & 0x7f) << 7) | (d[3] & 0x7f);
  if (val & (1 << 27)) {
    val -= 1 << 28;
  }
  return val;
}

export function buildParamChange(
  modelId: number,
  dataType: number,
  element: number,
  param: number,
  channel: number,
  value: number
): number[] {
  const [d0, d1, d2, d3] = intToDataBytes(value);
  return [
    SYSEX_START,
    YAMAHA_ID,
    SUB_PARAM_CHANGE,
    GROUP_DIGITAL_MIXER,
    modelId,
    dataType,
    element,
    param,
    channel,
    d0,
    d1,
    d2,
    d3,
    SYSEX_END,
  ];
}

export function buildParamRequest(
  modelId: number,
  dataType: number,
  element: number,
  param: number,
  channel: number
): number[] {
  return [
    SYSEX_START,
    YAMAHA_ID,
    SUB_PARAM_REQUEST,
    GROUP_DIGITAL_MIXER,
    modelId,
    dataType,
    element,
    param,
    channel,
    SYSEX_END,
  ];
}

export function buildMeterRequest(): number[] {
  // Requests 32 input meters from 01V96
  return [
    SYSEX_START,
    YAMAHA_ID,
    SUB_PARAM_REQUEST,
    GROUP_DIGITAL_MIXER,
    MODEL_01V96,
    0x21,
    0x00,
    0x00,
    0x00,
    0x00,
    0x1f,
    SYSEX_END,
  ];
}

export function convertMeterByte(rawLevel: number): number {
  // 0..32 nonlinear meter scale -> 0..255
  return Math.min(Math.round((Math.pow(rawLevel, 2) / Math.pow(32, 2)) * 255), 255);
}

// Element constants on Universal Model (0x7F, DataType 0x01)
export const EL_SCENE_TITLE = 1;
export const EL_INPUT_PHASE = 23;
export const EL_INPUT_PAIR = 24;
export const EL_INPUT_ON = 26;
export const EL_INPUT_PAN = 27;
export const EL_INPUT_FADER = 28;
export const EL_INPUT_ATT = 29;
export const EL_INPUT_GATE = 30;
export const EL_INPUT_COMP = 31;
export const EL_INPUT_EQ = 32;
export const EL_INPUT_DELAY = 33;
export const EL_INPUT_ROUTING = 34;
export const EL_INPUT_AUX = 35;

export const EL_BUS_ON = 41;
export const EL_BUS_PAN = 42;
export const EL_BUS_FADER = 43;
export const EL_BUS_COMP = 45;
export const EL_BUS_EQ = 46;

export const EL_AUX_ON = 54;
export const EL_AUX_PAN = 56;
export const EL_AUX_FADER = 57;
export const EL_AUX_COMP = 59;
export const EL_AUX_EQ = 60;

export const EL_STEREO_ON = 77;
export const EL_STEREO_PAN = 78;
export const EL_STEREO_FADER = 79;
export const EL_STEREO_COMP = 81;
export const EL_STEREO_EQ = 82;

// EQ parameter indices (same for Input 32, Bus 46, Aux 60, Stereo 82)
export const EQ_PARAM_MAP: Record<string, number> = {
  mode: 0,
  lowQ: 1,
  lowF: 2,
  lowG: 3,
  hpfOn: 4,
  lowMidQ: 5,
  lowMidF: 6,
  lowMidG: 7,
  hiMidQ: 8,
  hiMidF: 9,
  hiMidG: 10,
  highQ: 11,
  highF: 12,
  highG: 13,
  lpfOn: 14,
  on: 15,
};

// Gate parameter indices (Element 30)
export const GATE_PARAM_MAP: Record<string, number> = {
  on: 0,
  type: 5,
  attack: 6,
  range: 7,
  hold: 8,
  decay: 9,
  threshold: 10,
};

// Comp parameter indices (Element 31, 45, 59, 81)
export const COMP_PARAM_MAP: Record<string, number> = {
  on: 1,
  type: 3,
  attack: 4,
  release: 5,
  ratio: 6,
  gain: 7,
  knee: 8,
  threshold: 9,
};
