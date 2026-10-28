import { MixerState } from '../shared/types.js';
import { computePostDspMeter } from './dsp-meter-simulator.js';
import {
  applyCompParam,
  applyEQParam,
  applyGateParam,
  INV_COMP_MAP,
  INV_EQ_MAP,
  INV_GATE_MAP,
} from './param-helpers.js';
import {
  convertMeterByte,
  dataBytesToInt,
  EL_AUX_COMP,
  EL_AUX_EQ,
  EL_AUX_FADER,
  EL_AUX_ON,
  EL_AUX_PAN,
  EL_BUS_COMP,
  EL_BUS_EQ,
  EL_BUS_FADER,
  EL_BUS_ON,
  EL_BUS_PAN,
  EL_EFFECT,
  EL_GEQ,
  EL_INPUT_ATT,
  EL_INPUT_AUX,
  EL_INPUT_COMP,
  EL_INPUT_DELAY,
  EL_INPUT_EQ,
  EL_INPUT_FADER,
  EL_INPUT_GATE,
  EL_INPUT_ON,
  EL_INPUT_PAIR,
  EL_INPUT_PAN,
  EL_INPUT_PHASE,
  EL_INPUT_ROUTING,
  EL_SCENE_TITLE,
  EL_STEREO_COMP,
  EL_STEREO_EQ,
  EL_STEREO_FADER,
  EL_STEREO_ON,
  EL_STEREO_PAN,
  MODEL_01V96,
  MODEL_UNIVERSAL,
  SYSEX_END,
  SYSEX_START,
  YAMAHA_ID,
} from './protocol.js';
import { SceneLabelsStorage } from './scene-labels-storage.js';

// Reusable 98-byte binary meter buffer: [0]: 'M' (0x4D), [1..32]: in, [33..64]: out, [65..96]: gr*10, [97]: stereo
const binaryMeterBuffer = Buffer.alloc(98);
binaryMeterBuffer[0] = 0x4d;

export interface InboundContext {
  state: MixerState;
  dirtyParams: Set<string>;
  sceneTitleChars: string[];
  effectTitleChars: Map<number, string[]>;
  channelNameChars: Map<number, string[]>;
  labelsStorage: SceneLabelsStorage;
  broadcastPatch: (patch: Partial<MixerState>) => void;
  broadcastChannelUpdate: (
    target: 'ch' | 'aux' | 'bus' | 'stereo',
    id: number,
    changes: Record<string, unknown>
  ) => void;
  broadcastMeters: (msg: unknown) => void;
  applySceneLabels: (sceneNo: number) => void;
  scheduleSceneResync: () => void;
  syncChannelStrip: (id: number) => Promise<void>;
}

export function handleIncomingMidi(msg: number[], ctx: InboundContext): void {
  // 1. Standard MIDI Program Change (0xCn, pgm) -> Scene changed on mixer!
  if (msg.length === 2 && (msg[0] & 0xf0) === 0xc0) {
    ctx.state.sceneNumber = msg[1];
    ctx.applySceneLabels(ctx.state.sceneNumber);
    ctx.broadcastPatch({ sceneNumber: ctx.state.sceneNumber });
    ctx.scheduleSceneResync();
    return;
  }

  if (
    msg.length < 10 ||
    msg[0] !== SYSEX_START ||
    msg[1] !== YAMAHA_ID ||
    msg[msg.length - 1] !== SYSEX_END
  ) {
    return;
  }

  const subStatus = msg[2] & 0xf0;
  const modelId = msg[4];
  const dataType = msg[5];
  const element = msg[6];
  const param = msg[7];
  const channel = msg[8];

  // 2. Universal Scene Recall / Store notification (Model 0x7F, DataType 0x10)
  if (modelId === MODEL_UNIVERSAL && dataType === 0x10) {
    const sceneNo = msg.length >= 11 ? ((msg[8] & 0x7f) << 7) | (msg[9] & 0x7f) : msg[8];
    ctx.state.sceneNumber = sceneNo;
    ctx.applySceneLabels(sceneNo);
    ctx.broadcastPatch({ sceneNumber: sceneNo });
    ctx.scheduleSceneResync();
    return;
  }

  // 3. Live Meter Packet (Model 0x0D, DataType 0x21)
  if (modelId === MODEL_01V96 && dataType === 0x21 && msg.length >= 25) {
    if (element === 0 && msg.length >= 71) {
      const metersIn: Record<string, number> = {};
      const metersOut: Record<string, number> = {};
      const grs: Record<string, number> = {};
      const data = msg.slice(9, -1);

      let stereoLSum = 0;
      for (let ch = 0; ch < 32; ch++) {
        const raw = data[2 * ch] ?? 0;
        const levelIn = convertMeterByte(raw);
        const chObj = ctx.state.channels[ch];
        chObj.meterIn = levelIn;

        const { meterOut, grDb } = computePostDspMeter(chObj, levelIn);
        chObj.meterOut = meterOut;
        chObj.grDb = grDb;

        binaryMeterBuffer[1 + ch] = levelIn;
        binaryMeterBuffer[33 + ch] = meterOut;
        binaryMeterBuffer[65 + ch] = Math.min(255, Math.round(grDb * 10));

        if (chObj.routing.stereo && chObj.on) {
          stereoLSum += Math.pow(meterOut / 255, 2);
        }
      }

      // Compute Stereo Master meter if not explicitly received
      const stLevel = Math.min(
        255,
        Math.round(Math.sqrt(stereoLSum) * 255 * (ctx.state.stereo.fader / 823))
      );
      ctx.state.stereo.meterIn = stLevel;
      ctx.state.stereo.meterOut = ctx.state.stereo.on ? stLevel : 0;
      binaryMeterBuffer[97] = ctx.state.stereo.meterOut;

      ctx.broadcastMeters(binaryMeterBuffer);
    }
    return;
  }

  if (subStatus !== 0x10 || msg.length < 14) return;

  const dataBytes = msg.slice(9, 13);
  const val = dataBytesToInt(dataBytes);

  // 4. Universal Parameters (Model 0x7F, DataType 0x01)
  if (modelId === MODEL_UNIVERSAL && dataType === 0x01) {
    if (element === EL_SCENE_TITLE && param >= 0 && param < 16) {
      ctx.sceneTitleChars[param] = val > 31 ? String.fromCharCode(val) : ' ';
      ctx.state.sceneTitle = ctx.sceneTitleChars.join('').trim() || 'Scene';
      ctx.broadcastPatch({ sceneTitle: ctx.state.sceneTitle });
      return;
    }

    // Effect Rack 1..4 (Element 88)
    if (element === EL_EFFECT && channel >= 0 && channel < 4) {
      const fx = ctx.state.effects[channel];
      if (param >= 0 && param < 16) {
        const chars = ctx.effectTitleChars.get(channel) ?? Array(16).fill(' ');
        chars[param] = val > 31 ? String.fromCharCode(val) : ' ';
        ctx.effectTitleChars.set(channel, chars);
        fx.name = chars.join('').trim() || `EFFECT ${channel + 1}`;
      } else if (param >= 16 && param < 24) {
        fx.params[param - 16] = val;
      } else if (param === 48) {
        fx.mix = val;
      } else if (param === 49) {
        fx.type = val;
      } else if (param === 52) {
        fx.bypass = val === 1;
      }
      ctx.broadcastPatch({ effects: ctx.state.effects });
      return;
    }

    // GEQ 1..4 (Element 87)
    if (element === EL_GEQ && channel >= 0 && channel < 4) {
      const geq = ctx.state.geqs[channel];
      if (param === 0) {
        geq.on = val === 1;
      } else if (param >= 4 && param <= 34) {
        geq.bands[param - 4] = val;
      }
      ctx.broadcastPatch({ geqs: ctx.state.geqs });
      return;
    }

    // Input channel parameters
    if (channel >= 0 && channel < 32) {
      const chId = channel + 1;
      const chObj = ctx.state.channels[channel];
      const savedObj = ctx.state.savedChannels[channel];
      switch (element) {
        case EL_INPUT_FADER:
          if (param === 0) {
            chObj.fader = val;
            if (!ctx.dirtyParams.has(`ch${chId}:fader`)) {
              savedObj.fader = val;
            }
            ctx.broadcastChannelUpdate('ch', chId, { fader: val });
          }
          break;
        case EL_INPUT_ON:
          if (param === 0) {
            chObj.on = val === 1;
            if (!ctx.dirtyParams.has(`ch${chId}:on`)) {
              savedObj.on = chObj.on;
            }
            ctx.broadcastChannelUpdate('ch', chId, { on: chObj.on });
          }
          break;
        case EL_INPUT_PAN:
          if (param === 0) {
            chObj.pan = val;
            if (!ctx.dirtyParams.has(`ch${chId}:pan`)) {
              savedObj.pan = val;
            }
            ctx.broadcastChannelUpdate('ch', chId, { pan: val });
          }
          break;
        case EL_INPUT_PHASE:
          if (param === 0) {
            chObj.phase = val === 1;
            if (!ctx.dirtyParams.has(`ch${chId}:phase`)) {
              savedObj.phase = chObj.phase;
            }
            ctx.broadcastChannelUpdate('ch', chId, { phase: chObj.phase });
          }
          break;
        case EL_INPUT_ATT:
          if (param === 0) {
            chObj.att = val;
            if (!ctx.dirtyParams.has(`ch${chId}:att`)) {
              savedObj.att = val;
            }
            ctx.broadcastChannelUpdate('ch', chId, { att: val });
          }
          break;
        case EL_INPUT_PAIR:
          if (param === 0) {
            chObj.pair = val === 1;
            ctx.broadcastChannelUpdate('ch', chId, { pair: chObj.pair });
          }
          break;
        case EL_INPUT_EQ: {
          const eqKey = INV_EQ_MAP[param];
          applyEQParam(chObj.eq, param, val);
          if (eqKey && !ctx.dirtyParams.has(`ch${chId}:eq:${eqKey}`)) {
            applyEQParam(savedObj.eq, param, val);
          }
          ctx.broadcastChannelUpdate('ch', chId, { eq: chObj.eq });
          break;
        }
        case EL_INPUT_GATE: {
          const gateKey = INV_GATE_MAP[param];
          applyGateParam(chObj.gate, param, val);
          if (gateKey && !ctx.dirtyParams.has(`ch${chId}:gate:${gateKey}`)) {
            applyGateParam(savedObj.gate, param, val);
          }
          ctx.broadcastChannelUpdate('ch', chId, { gate: chObj.gate });
          break;
        }
        case EL_INPUT_COMP: {
          const compKey = INV_COMP_MAP[param];
          applyCompParam(chObj.comp, param, val);
          if (compKey && !ctx.dirtyParams.has(`ch${chId}:comp:${compKey}`)) {
            applyCompParam(savedObj.comp, param, val);
          }
          ctx.broadcastChannelUpdate('ch', chId, { comp: chObj.comp });
          break;
        }
        case EL_INPUT_ROUTING:
          if (param === 0) chObj.routing.stereo = val === 1;
          else if (param === 2) chObj.routing.direct = val === 1;
          else if (param >= 3 && param <= 10) chObj.routing.bus[param - 3] = val === 1;
          ctx.broadcastChannelUpdate('ch', chId, { routing: chObj.routing });
          break;
        case EL_INPUT_AUX:
          if (param >= 0 && param < 24) {
            const auxIdx = Math.floor(param / 3);
            const sub = param % 3;
            if (sub === 0) chObj.auxSends[auxIdx].on = val === 1;
            else if (sub === 1) chObj.auxSends[auxIdx].pre = val === 1;
            else if (sub === 2) {
              chObj.auxSends[auxIdx].level = val;
              if (!ctx.dirtyParams.has(`ch${chId}:aux:${auxIdx + 1}:level`)) {
                savedObj.auxSends[auxIdx].level = val;
              }
            }
            ctx.broadcastChannelUpdate('ch', chId, { auxSends: chObj.auxSends });
          }
          break;
        case EL_INPUT_DELAY:
          if (param === 0) chObj.delayOn = val === 1;
          else if (param === 3) {
            chObj.delayTime = val;
            if (!ctx.dirtyParams.has(`ch${chId}:delayTime`)) {
              savedObj.delayTime = val;
            }
          }
          ctx.broadcastChannelUpdate('ch', chId, {
            delayOn: chObj.delayOn,
            delayTime: chObj.delayTime,
          });
          break;
      }
    }

    // AUX 1..8
    if (channel >= 0 && channel < 8) {
      const auxObj = ctx.state.auxes[channel];
      if (element === EL_AUX_FADER && param === 0) {
        auxObj.fader = val;
        ctx.broadcastChannelUpdate('aux', channel + 1, { fader: val });
      } else if (element === EL_AUX_ON && param === 0) {
        auxObj.on = val === 1;
        ctx.broadcastChannelUpdate('aux', channel + 1, { on: auxObj.on });
      } else if (element === EL_AUX_PAN && param === 0) {
        auxObj.pan = val;
        ctx.broadcastChannelUpdate('aux', channel + 1, { pan: val });
      } else if (element === EL_AUX_EQ) {
        applyEQParam(auxObj.eq, param, val);
        ctx.broadcastChannelUpdate('aux', channel + 1, { eq: auxObj.eq });
      } else if (element === EL_AUX_COMP) {
        applyCompParam(auxObj.comp, param, val);
        ctx.broadcastChannelUpdate('aux', channel + 1, { comp: auxObj.comp });
      }
    }

    // BUS 1..8
    if (channel >= 0 && channel < 8) {
      const busObj = ctx.state.buses[channel];
      if (element === EL_BUS_FADER && param === 0) {
        busObj.fader = val;
        ctx.broadcastChannelUpdate('bus', channel + 1, { fader: val });
      } else if (element === EL_BUS_ON && param === 0) {
        busObj.on = val === 1;
        ctx.broadcastChannelUpdate('bus', channel + 1, { on: busObj.on });
      } else if (element === EL_BUS_PAN && param === 0) {
        busObj.pan = val;
        ctx.broadcastChannelUpdate('bus', channel + 1, { pan: val });
      } else if (element === EL_BUS_EQ) {
        applyEQParam(busObj.eq, param, val);
        ctx.broadcastChannelUpdate('bus', channel + 1, { eq: busObj.eq });
      } else if (element === EL_BUS_COMP) {
        applyCompParam(busObj.comp, param, val);
        ctx.broadcastChannelUpdate('bus', channel + 1, { comp: busObj.comp });
      }
    }

    // STEREO OUT
    if (element === EL_STEREO_FADER && param === 0) {
      ctx.state.stereo.fader = val;
      ctx.broadcastChannelUpdate('stereo', 1, { fader: val });
    } else if (element === EL_STEREO_ON && param === 0) {
      ctx.state.stereo.on = val === 1;
      ctx.broadcastChannelUpdate('stereo', 1, { on: ctx.state.stereo.on });
    } else if (element === EL_STEREO_PAN && param === 0) {
      ctx.state.stereo.pan = val;
      ctx.broadcastChannelUpdate('stereo', 1, { pan: val });
    } else if (element === EL_STEREO_EQ) {
      applyEQParam(ctx.state.stereo.eq, param, val);
      ctx.broadcastChannelUpdate('stereo', 1, { eq: ctx.state.stereo.eq });
    } else if (element === EL_STEREO_COMP) {
      applyCompParam(ctx.state.stereo.comp, param, val);
      ctx.broadcastChannelUpdate('stereo', 1, { comp: ctx.state.stereo.comp });
    }
  }

  // 5. Device Specific 01V96 Parameters (Model 0x0D)
  if (modelId === MODEL_01V96) {
    // Input Patch (dt=2, el=1, p=0)
    if (dataType === 2 && element === 1 && param === 0 && channel >= 0 && channel < 32) {
      ctx.state.channels[channel].inputPatch = val;
      ctx.broadcastChannelUpdate('ch', channel + 1, { inputPatch: val });
    }
    // Short Channel Name (dt=2, el=4, p=0..3)
    else if (
      dataType === 2 &&
      element === 4 &&
      param >= 0 &&
      param < 4 &&
      channel >= 0 &&
      channel < 32
    ) {
      const chars = ctx.channelNameChars.get(channel) ?? ['C', 'H', ' ', ' '];
      chars[param] = val > 31 ? String.fromCharCode(val) : ' ';
      ctx.channelNameChars.set(channel, chars);
      const shortName = chars.join('').trim() || `CH${channel + 1}`;
      const currentName = ctx.state.channels[channel].name;
      const storedName = ctx.labelsStorage.getChannelStoredName(ctx.state.sceneNumber, channel + 1);

      if (storedName) {
        // Keep stored custom name for this scene
      } else if (
        currentName &&
        currentName !== `CH${channel + 1}` &&
        currentName.startsWith(shortName)
      ) {
        // Keep rich name if it matches short name prefix
      } else {
        ctx.state.channels[channel].name = shortName;
        ctx.broadcastChannelUpdate('ch', channel + 1, { name: shortName });
      }
    }
    // Omni Out Patch (dt=2, el=6, p=0)
    else if (dataType === 2 && element === 6 && param === 0 && channel >= 0 && channel < 4) {
      ctx.state.setup.omniOutPatch[channel] = val;
      ctx.broadcastPatch({ setup: ctx.state.setup });
    }
    // Solo Channel On (dt=3, el=46, p=0)
    else if (dataType === 3 && element === 46 && param === 0 && channel >= 0 && channel < 32) {
      ctx.state.channels[channel].solo = val === 1;
      ctx.broadcastChannelUpdate('ch', channel + 1, { solo: val === 1 });
    }
    // LCD Screen Change on Mixer (dt=4, el=1, p=0)
    else if (dataType === 4 && element === 1 && param === 0) {
      ctx.state.setup.lcdScreenNo = val;
      ctx.broadcastPatch({ setup: ctx.state.setup });
    }
    // Selected Channel on Mixer hardware (dt=4, el=9, p=24)
    else if (dataType === 4 && element === 9 && param === 24) {
      if (val >= 0 && val < 32) {
        ctx.state.selectedChannel = val + 1;
        ctx.broadcastPatch({ selectedChannel: ctx.state.selectedChannel });
        ctx.syncChannelStrip(ctx.state.selectedChannel);
      }
    }
    // Scene Memory Now / Recall on Mixer (dt=4, el=10, p=0 or p=1)
    else if (dataType === 4 && element === 10 && (param === 0 || param === 1)) {
      ctx.state.sceneNumber = val;
      ctx.applySceneLabels(val);
      ctx.broadcastPatch({ sceneNumber: val });
      ctx.scheduleSceneResync();
    }
  }
}
