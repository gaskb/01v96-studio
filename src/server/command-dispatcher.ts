import { ClientCommand, MixerState } from '../shared/types.js';
import { getPairedChannelIndex } from '../shared/converters.js';
import { applyCompParam, applyEQParam, applyGateParam } from './param-helpers.js';
import {
  buildParamChange,
  buildSceneRecallSysEx,
  buildSceneStoreSysEx,
  COMP_PARAM_MAP,
  EL_AUX_EQ,
  EL_AUX_FADER,
  EL_AUX_ON,
  EL_AUX_PAN,
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
  EQ_PARAM_MAP,
  GATE_PARAM_MAP,
  MODEL_01V96,
  MODEL_UNIVERSAL,
} from './protocol.js';
import { SceneArchiveStorage } from './scene-archive-storage.js';
import { SceneLabelsStorage } from './scene-labels-storage.js';
import { YamahaUsbTransport } from './usb-transport.js';

export interface CommandDispatcherContext {
  state: MixerState;
  transport: YamahaUsbTransport;
  dirtyParams: Set<string>;
  labelsStorage: SceneLabelsStorage;
  archiveStorage?: SceneArchiveStorage;
  broadcastChannelUpdate: (
    target: 'ch' | 'aux' | 'bus' | 'stereo',
    id: number,
    changes: Record<string, unknown>
  ) => void;
  broadcastPatch: (patch: Partial<MixerState>) => void;
  broadcastState: () => void;
  applySceneLabels: (sceneNo: number) => void;
  scheduleSceneResync: () => void;
  syncChannelStrip: (id: number) => Promise<void>;
  initialSync: () => Promise<void>;
  startDemoWave: (mode?: 'sine' | 'bounce' | 'v-shape') => Promise<void>;
  stopDemoWave: () => Promise<void>;
}

function clampInt(val: unknown, min: number, max: number, defaultVal: number = min): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function dispatchClientCommand(
  cmd: ClientCommand,
  ctx: CommandDispatcherContext
): Promise<void> {
  switch (cmd.type) {
    case 'set_fader': {
      const ch = cmd.id - 1;
      const val = clampInt(cmd.value, 0, 1023, 0);
      if (cmd.target === 'ch' && ctx.state.channels[ch]) {
        ctx.dirtyParams.add(`ch${cmd.id}:fader`);
        ctx.state.channels[ch].fader = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_FADER, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { fader: val });

        if (ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.dirtyParams.add(`ch${partnerId}:fader`);
            ctx.state.channels[partnerIdx].fader = val;
            ctx.broadcastChannelUpdate('ch', partnerId, { fader: val });
          }
        }
      } else if (cmd.target === 'aux' && ctx.state.auxes[ch]) {
        ctx.state.auxes[ch].fader = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_FADER, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('aux', cmd.id, { fader: val });
      } else if (cmd.target === 'bus' && ctx.state.buses[ch]) {
        ctx.state.buses[ch].fader = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_FADER, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('bus', cmd.id, { fader: val });
      } else if (cmd.target === 'stereo') {
        ctx.state.stereo.fader = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_FADER, 0, 0, val)
        );
        ctx.broadcastChannelUpdate('stereo', 1, { fader: val });
      }
      break;
    }

    case 'set_on': {
      const ch = cmd.id - 1;
      const numVal = cmd.value ? 1 : 0;
      if (cmd.target === 'ch' && ctx.state.channels[ch]) {
        ctx.state.channels[ch].on = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ON, 0, ch, numVal)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { on: cmd.value });

        if (ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.state.channels[partnerIdx].on = cmd.value;
            ctx.broadcastChannelUpdate('ch', partnerId, { on: cmd.value });
          }
        }
      } else if (cmd.target === 'aux' && ctx.state.auxes[ch]) {
        ctx.state.auxes[ch].on = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_ON, 0, ch, numVal)
        );
        ctx.broadcastChannelUpdate('aux', cmd.id, { on: cmd.value });
      } else if (cmd.target === 'bus' && ctx.state.buses[ch]) {
        ctx.state.buses[ch].on = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_ON, 0, ch, numVal)
        );
        ctx.broadcastChannelUpdate('bus', cmd.id, { on: cmd.value });
      } else if (cmd.target === 'stereo') {
        ctx.state.stereo.on = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_ON, 0, 0, numVal)
        );
        ctx.broadcastChannelUpdate('stereo', 1, { on: cmd.value });
      }
      break;
    }

    case 'set_solo': {
      const ch = cmd.id - 1;
      if (ctx.state.channels[ch]) {
        ctx.state.channels[ch].solo = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_01V96, 3, 46, 0, ch, cmd.value ? 1 : 0)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { solo: cmd.value });
      }
      break;
    }

    case 'set_pan': {
      const ch = cmd.id - 1;
      const val = clampInt(cmd.value, -63, 63, 0);
      if (cmd.target === 'ch' && ctx.state.channels[ch]) {
        ctx.dirtyParams.add(`ch${cmd.id}:pan`);
        ctx.state.channels[ch].pan = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PAN, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { pan: val });
      } else if (cmd.target === 'aux' && ctx.state.auxes[ch]) {
        ctx.state.auxes[ch].pan = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_PAN, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('aux', cmd.id, { pan: val });
      } else if (cmd.target === 'bus' && ctx.state.buses[ch]) {
        ctx.state.buses[ch].pan = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_PAN, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('bus', cmd.id, { pan: val });
      } else if (cmd.target === 'stereo') {
        ctx.state.stereo.pan = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_PAN, 0, 0, val)
        );
        ctx.broadcastChannelUpdate('stereo', 1, { pan: val });
      }
      break;
    }

    case 'set_phase': {
      const ch = cmd.id - 1;
      if (ctx.state.channels[ch]) {
        ctx.state.channels[ch].phase = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, ch, cmd.value ? 1 : 0)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { phase: cmd.value });

        if (ctx.state.deepPair && ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.state.channels[partnerIdx].phase = cmd.value;
            await ctx.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PHASE, 0, partnerIdx, cmd.value ? 1 : 0)
            );
            ctx.broadcastChannelUpdate('ch', partnerId, { phase: cmd.value });
          }
        }
      }
      break;
    }

    case 'set_att': {
      const ch = cmd.id - 1;
      const val = clampInt(cmd.value, -960, 180, 0);
      if (ctx.state.channels[ch]) {
        ctx.dirtyParams.add(`ch${cmd.id}:att`);
        ctx.state.channels[ch].att = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, ch, val)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { att: val });

        if (ctx.state.deepPair && ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.dirtyParams.add(`ch${partnerId}:att`);
            ctx.state.channels[partnerIdx].att = val;
            await ctx.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ATT, 0, partnerIdx, val)
            );
            ctx.broadcastChannelUpdate('ch', partnerId, { att: val });
          }
        }
      }
      break;
    }

    case 'set_pair': {
      const ch = cmd.id - 1;
      if (ctx.state.channels[ch]) {
        ctx.state.channels[ch].pair = cmd.value;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_PAIR, 0, ch, cmd.value ? 1 : 0)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { pair: cmd.value });

        const partnerIdx = getPairedChannelIndex(ch);
        if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
          const partnerId = partnerIdx + 1;
          ctx.state.channels[partnerIdx].pair = cmd.value;
          ctx.broadcastChannelUpdate('ch', partnerId, { pair: cmd.value });
        }
      }
      break;
    }

    case 'set_name': {
      const target = cmd.target ?? 'ch';
      const ch = cmd.id - 1;
      const scNo = ctx.state.sceneNumber;

      if (target === 'ch' && ctx.state.channels[ch]) {
        const cleanName = cmd.name.trim().slice(0, 32) || `CH${cmd.id}`;
        ctx.state.channels[ch].name = cleanName;
        const cleanSysEx = cleanName.slice(0, 4).padEnd(4, ' ');
        for (let p = 0; p < 4; p++) {
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_01V96, 2, 4, p, ch, cleanSysEx.charCodeAt(p))
          );
        }
        ctx.labelsStorage.setLabel(scNo, 'ch', cmd.id, cleanName);
        ctx.broadcastChannelUpdate('ch', cmd.id, { name: cleanName });
      } else if (target === 'aux' && ctx.state.auxes[ch]) {
        const cleanName = cmd.name.trim().slice(0, 32) || `AUX ${cmd.id}`;
        ctx.state.auxes[ch].name = cleanName;
        ctx.labelsStorage.setLabel(scNo, 'aux', cmd.id, cleanName);
        ctx.broadcastChannelUpdate('aux', cmd.id, { name: cleanName });
      } else if (target === 'bus' && ctx.state.buses[ch]) {
        const cleanName = cmd.name.trim().slice(0, 32) || `BUS ${cmd.id}`;
        ctx.state.buses[ch].name = cleanName;
        ctx.labelsStorage.setLabel(scNo, 'bus', cmd.id, cleanName);
        ctx.broadcastChannelUpdate('bus', cmd.id, { name: cleanName });
      }
      break;
    }

    case 'set_eq': {
      const ch = cmd.id - 1;
      const paramIdx = EQ_PARAM_MAP[cmd.param];
      if (paramIdx === undefined) break;
      const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);

      if (cmd.target === 'ch' && ctx.state.channels[ch]) {
        ctx.dirtyParams.add(`ch${cmd.id}:eq:${cmd.param}`);
        applyEQParam(ctx.state.channels[ch].eq, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, paramIdx, ch, numVal)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { eq: ctx.state.channels[ch].eq });

        if (ctx.state.deepPair && ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.dirtyParams.add(`ch${partnerId}:eq:${cmd.param}`);
            applyEQParam(ctx.state.channels[partnerIdx].eq, paramIdx, numVal);
            await ctx.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_EQ, paramIdx, partnerIdx, numVal)
            );
            ctx.broadcastChannelUpdate('ch', partnerId, { eq: ctx.state.channels[partnerIdx].eq });
          }
        }
      } else if (cmd.target === 'aux' && ctx.state.auxes[ch]) {
        applyEQParam(ctx.state.auxes[ch].eq, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_AUX_EQ, paramIdx, ch, numVal)
        );
        ctx.broadcastChannelUpdate('aux', cmd.id, { eq: ctx.state.auxes[ch].eq });
      } else if (cmd.target === 'bus' && ctx.state.buses[ch]) {
        applyEQParam(ctx.state.buses[ch].eq, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_BUS_EQ, paramIdx, ch, numVal)
        );
        ctx.broadcastChannelUpdate('bus', cmd.id, { eq: ctx.state.buses[ch].eq });
      } else if (cmd.target === 'stereo') {
        applyEQParam(ctx.state.stereo.eq, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_EQ, paramIdx, 0, numVal)
        );
        ctx.broadcastChannelUpdate('stereo', 1, { eq: ctx.state.stereo.eq });
      }
      break;
    }

    case 'set_gate': {
      const ch = cmd.id - 1;
      const paramIdx = GATE_PARAM_MAP[cmd.param];
      if (paramIdx === undefined || !ctx.state.channels[ch]) break;
      const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
      ctx.dirtyParams.add(`ch${cmd.id}:gate:${cmd.param}`);
      applyGateParam(ctx.state.channels[ch].gate, paramIdx, numVal);
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, paramIdx, ch, numVal)
      );
      ctx.broadcastChannelUpdate('ch', cmd.id, { gate: ctx.state.channels[ch].gate });

      if (ctx.state.deepPair && ctx.state.channels[ch].pair) {
        const partnerIdx = getPairedChannelIndex(ch);
        if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
          const partnerId = partnerIdx + 1;
          ctx.dirtyParams.add(`ch${partnerId}:gate:${cmd.param}`);
          applyGateParam(ctx.state.channels[partnerIdx].gate, paramIdx, numVal);
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_GATE, paramIdx, partnerIdx, numVal)
          );
          ctx.broadcastChannelUpdate('ch', partnerId, { gate: ctx.state.channels[partnerIdx].gate });
        }
      }
      break;
    }

    case 'set_comp': {
      const ch = cmd.id - 1;
      const paramIdx = COMP_PARAM_MAP[cmd.param];
      if (paramIdx === undefined) break;
      const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);

      if (cmd.target === 'ch' && ctx.state.channels[ch]) {
        ctx.dirtyParams.add(`ch${cmd.id}:comp:${cmd.param}`);
        applyCompParam(ctx.state.channels[ch].comp, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, paramIdx, ch, numVal)
        );
        ctx.broadcastChannelUpdate('ch', cmd.id, { comp: ctx.state.channels[ch].comp });

        if (ctx.state.deepPair && ctx.state.channels[ch].pair) {
          const partnerIdx = getPairedChannelIndex(ch);
          if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
            const partnerId = partnerIdx + 1;
            ctx.dirtyParams.add(`ch${partnerId}:comp:${cmd.param}`);
            applyCompParam(ctx.state.channels[partnerIdx].comp, paramIdx, numVal);
            await ctx.transport.sendSysEx(
              buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_COMP, paramIdx, partnerIdx, numVal)
            );
            ctx.broadcastChannelUpdate('ch', partnerId, { comp: ctx.state.channels[partnerIdx].comp });
          }
        }
      } else if (cmd.target === 'stereo') {
        applyCompParam(ctx.state.stereo.comp, paramIdx, numVal);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_STEREO_COMP, paramIdx, 0, numVal)
        );
        ctx.broadcastChannelUpdate('stereo', 1, { comp: ctx.state.stereo.comp });
      }
      break;
    }

    case 'set_routing': {
      const ch = cmd.id - 1;
      const chObj = ctx.state.channels[ch];
      if (!chObj) break;
      const numVal = cmd.value ? 1 : 0;
      let paramIdx = 0;
      if (cmd.target === 'stereo') {
        chObj.routing.stereo = cmd.value;
        paramIdx = 0;
      } else if (cmd.target === 'direct') {
        chObj.routing.direct = cmd.value;
        paramIdx = 2;
      } else if (cmd.target === 'bus' && cmd.busIndex !== undefined) {
        chObj.routing.bus[cmd.busIndex] = cmd.value;
        paramIdx = 3 + cmd.busIndex;
      }
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, paramIdx, ch, numVal)
      );
      ctx.broadcastChannelUpdate('ch', cmd.id, { routing: chObj.routing });

      if (ctx.state.deepPair && chObj.pair) {
        const partnerIdx = getPairedChannelIndex(ch);
        if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
          const partnerObj = ctx.state.channels[partnerIdx];
          const partnerId = partnerIdx + 1;
          if (cmd.target === 'stereo') {
            partnerObj.routing.stereo = cmd.value;
          } else if (cmd.target === 'direct') {
            partnerObj.routing.direct = cmd.value;
          } else if (cmd.target === 'bus' && cmd.busIndex !== undefined) {
            partnerObj.routing.bus[cmd.busIndex] = cmd.value;
          }
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_ROUTING, paramIdx, partnerIdx, numVal)
          );
          ctx.broadcastChannelUpdate('ch', partnerId, { routing: partnerObj.routing });
        }
      }
      break;
    }

    case 'set_aux_send': {
      const ch = cmd.chId - 1;
      const auxIdx = cmd.auxId - 1;
      const chObj = ctx.state.channels[ch];
      if (!chObj || !chObj.auxSends[auxIdx]) break;

      let sub = 0;
      let numVal = 0;
      if (cmd.param === 'on') {
        sub = 0;
        chObj.auxSends[auxIdx].on = Boolean(cmd.value);
        numVal = cmd.value ? 1 : 0;
      } else if (cmd.param === 'pre') {
        sub = 1;
        chObj.auxSends[auxIdx].pre = Boolean(cmd.value);
        numVal = cmd.value ? 1 : 0;
      } else if (cmd.param === 'level') {
        sub = 2;
        numVal = clampInt(cmd.value, 0, 1023, 0);
        ctx.dirtyParams.add(`ch${cmd.chId}:aux:${cmd.auxId}:level`);
        chObj.auxSends[auxIdx].level = numVal;
      }
      const paramIdx = auxIdx * 3 + sub;
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, paramIdx, ch, numVal)
      );
      ctx.broadcastChannelUpdate('ch', cmd.chId, { auxSends: chObj.auxSends });

      if (ctx.state.deepPair && chObj.pair) {
        const partnerIdx = getPairedChannelIndex(ch);
        if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
          const partnerObj = ctx.state.channels[partnerIdx];
          const partnerId = partnerIdx + 1;
          if (cmd.param === 'on') {
            partnerObj.auxSends[auxIdx].on = Boolean(cmd.value);
          } else if (cmd.param === 'pre') {
            partnerObj.auxSends[auxIdx].pre = Boolean(cmd.value);
          } else if (cmd.param === 'level') {
            ctx.dirtyParams.add(`ch${partnerId}:aux:${cmd.auxId}:level`);
            partnerObj.auxSends[auxIdx].level = numVal;
          }
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_AUX, paramIdx, partnerIdx, numVal)
          );
          ctx.broadcastChannelUpdate('ch', partnerId, { auxSends: partnerObj.auxSends });
        }
      }
      break;
    }

    case 'set_delay': {
      const ch = cmd.id - 1;
      const chObj = ctx.state.channels[ch];
      if (!chObj) break;
      ctx.dirtyParams.add(`ch${cmd.id}:delayTime`);
      chObj.delayOn = cmd.on;
      chObj.delayTime = clampInt(cmd.time, 0, 1000, 0);
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 0, ch, cmd.on ? 1 : 0)
      );
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 3, ch, chObj.delayTime)
      );
      ctx.broadcastChannelUpdate('ch', cmd.id, {
        delayOn: chObj.delayOn,
        delayTime: chObj.delayTime,
      });

      if (ctx.state.deepPair && chObj.pair) {
        const partnerIdx = getPairedChannelIndex(ch);
        if (partnerIdx >= 0 && partnerIdx < 32 && ctx.state.channels[partnerIdx]) {
          const partnerObj = ctx.state.channels[partnerIdx];
          const partnerId = partnerIdx + 1;
          ctx.dirtyParams.add(`ch${partnerId}:delayTime`);
          partnerObj.delayOn = cmd.on;
          partnerObj.delayTime = chObj.delayTime;
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 0, partnerIdx, cmd.on ? 1 : 0)
          );
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_INPUT_DELAY, 3, partnerIdx, partnerObj.delayTime)
          );
          ctx.broadcastChannelUpdate('ch', partnerId, {
            delayOn: partnerObj.delayOn,
            delayTime: partnerObj.delayTime,
          });
        }
      }
      break;
    }

    case 'set_deep_pair': {
      ctx.state.deepPair = Boolean(cmd.enabled);
      ctx.broadcastPatch({ deepPair: ctx.state.deepPair });
      break;
    }

    case 'select_channel': {
      const id = clampInt(cmd.id, 1, 32, 1);
      ctx.state.selectedChannel = id;
      await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 9, 24, 0, id - 1));
      ctx.broadcastPatch({ selectedChannel: id });
      await ctx.syncChannelStrip(id);
      const pairCh = id % 2 === 1 ? id + 1 : id - 1;
      if (pairCh >= 1 && pairCh <= 32) {
        await ctx.syncChannelStrip(pairCh);
      }
      break;
    }

    case 'set_dual_view': {
      ctx.state.dualChannelView = cmd.enabled;
      ctx.broadcastPatch({ dualChannelView: cmd.enabled });
      break;
    }

    case 'set_layer': {
      ctx.state.activeLayer = clampInt(cmd.layer, 0, 5, 0);
      ctx.broadcastPatch({ activeLayer: ctx.state.activeLayer });
      break;
    }

    case 'recall_scene': {
      const pgm = clampInt(cmd.sceneNumber, 0, 99, 0);
      ctx.state.sceneNumber = pgm;
      await ctx.transport.sendSysEx(buildSceneRecallSysEx(pgm));
      await ctx.transport.sendSysEx([0xc0, pgm]);
      ctx.applySceneLabels(pgm);
      ctx.broadcastPatch({ sceneNumber: pgm });
      ctx.scheduleSceneResync();
      break;
    }

    case 'store_scene': {
      const pgm = clampInt(cmd.sceneNumber, 0, 99, 0);
      if (cmd.title) {
        const clean = cmd.title.slice(0, 16).padEnd(16, ' ');
        ctx.state.sceneTitle = cmd.title.slice(0, 16).trim();
        for (let p = 0; p < 16; p++) {
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_SCENE_TITLE, p, 0, clean.charCodeAt(p))
          );
        }
      }
      await ctx.transport.sendSysEx(buildSceneStoreSysEx(pgm));
      ctx.state.sceneNumber = pgm;
      ctx.dirtyParams.clear();
      ctx.state.savedChannels = structuredClone(ctx.state.channels);

      // Snapshot current names into sceneLabelsStore for this scene
      const chMap: Record<number, string> = {};
      for (const c of ctx.state.channels) chMap[c.id] = c.name;
      const auxMap: Record<number, string> = {};
      for (const a of ctx.state.auxes) auxMap[a.id] = a.name;
      const busMap: Record<number, string> = {};
      for (const b of ctx.state.buses) busMap[b.id] = b.name;

      ctx.labelsStorage.snapshotScene(pgm, { ch: chMap, aux: auxMap, bus: busMap });

      if (ctx.archiveStorage) {
        ctx.archiveStorage.archiveScene(pgm, {
          number: pgm,
          title: ctx.state.sceneTitle,
          channels: structuredClone(ctx.state.channels),
          auxes: structuredClone(ctx.state.auxes),
          buses: structuredClone(ctx.state.buses),
          stereo: structuredClone(ctx.state.stereo),
          effects: structuredClone(ctx.state.effects),
          labels: { ch: chMap, aux: auxMap, bus: busMap },
        });
      }

      ctx.broadcastState();
      break;
    }

    case 'set_effect': {
      const fxIdx = Math.max(0, Math.min(3, cmd.rackId - 1));
      const fx = ctx.state.effects[fxIdx];
      if (!fx) break;
      const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
      if (cmd.param === 'bypass') {
        fx.bypass = Boolean(cmd.value);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 52, fxIdx, numVal)
        );
      } else if (cmd.param === 'mix') {
        fx.mix = numVal;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 48, fxIdx, numVal)
        );
      } else if (cmd.param === 'type') {
        fx.type = numVal;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 49, fxIdx, numVal)
        );
      } else if (cmd.param.startsWith('param')) {
        const pNo = Number(cmd.param.slice(5)) - 1;
        if (pNo >= 0 && pNo < 8) {
          fx.params[pNo] = numVal;
          await ctx.transport.sendSysEx(
            buildParamChange(MODEL_UNIVERSAL, 1, EL_EFFECT, 16 + pNo, fxIdx, numVal)
          );
        }
      }
      ctx.broadcastPatch({ effects: ctx.state.effects });
      break;
    }

    case 'set_geq': {
      const uIdx = Math.max(0, Math.min(3, cmd.unitId - 1));
      const geq = ctx.state.geqs[uIdx];
      if (!geq) break;
      if (cmd.param === 'on') {
        geq.on = Boolean(cmd.value);
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 0, uIdx, geq.on ? 1 : 0)
        );
      } else if (cmd.param === 'flat') {
        geq.bands.fill(0);
        await ctx.transport.sendSysEx(buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 3, uIdx, 1));
      } else if (cmd.param === 'band' && cmd.bandIndex !== undefined) {
        const b = Math.max(0, Math.min(30, cmd.bandIndex));
        const val = Math.max(-150, Math.min(150, Math.round(Number(cmd.value))));
        geq.bands[b] = val;
        await ctx.transport.sendSysEx(
          buildParamChange(MODEL_UNIVERSAL, 1, EL_GEQ, 4 + b, uIdx, val)
        );
      }
      ctx.broadcastPatch({ geqs: ctx.state.geqs });
      break;
    }

    case 'set_input_patch': {
      const ch = Math.max(0, Math.min(31, cmd.chId - 1));
      ctx.state.channels[ch].inputPatch = cmd.sourcePort;
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_01V96, 2, 1, 0, ch, cmd.sourcePort)
      );
      ctx.broadcastChannelUpdate('ch', cmd.chId, { inputPatch: cmd.sourcePort });
      break;
    }

    case 'set_omni_patch': {
      const omni = Math.max(0, Math.min(3, cmd.omniId - 1));
      ctx.state.setup.omniOutPatch[omni] = cmd.sourceBus;
      await ctx.transport.sendSysEx(
        buildParamChange(MODEL_01V96, 2, 6, 0, omni, cmd.sourceBus)
      );
      ctx.broadcastPatch({ setup: ctx.state.setup });
      break;
    }

    case 'set_lcd_screen': {
      ctx.state.setup.lcdScreenNo = cmd.screenNo;
      await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 1, 0, 0, cmd.screenNo));
      if (cmd.tabNo !== undefined) {
        ctx.state.setup.lcdTabNo = cmd.tabNo;
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 1, 4, 0, cmd.tabNo));
      }
      ctx.broadcastPatch({ setup: ctx.state.setup });
      break;
    }

    case 'set_setup_param': {
      const numVal = typeof cmd.value === 'boolean' ? (cmd.value ? 1 : 0) : Math.round(cmd.value);
      if (cmd.param === 'meterInputPoint') {
        ctx.state.setup.meterInputPoint = numVal;
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 0, 0, numVal));
      } else if (cmd.param === 'meterOutputPoint') {
        ctx.state.setup.meterOutputPoint = numVal;
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 1, 0, numVal));
      } else if (cmd.param === 'peakHold') {
        ctx.state.setup.peakHold = Boolean(cmd.value);
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 12, 6, 0, numVal));
      } else if (cmd.param === 'wordClockMaster') {
        ctx.state.setup.wordClockMaster = numVal;
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 3, 35, 0, 0, numVal));
      } else if (cmd.param === 'brightness') {
        ctx.state.setup.brightness = numVal;
        await ctx.transport.sendSysEx(buildParamChange(MODEL_01V96, 4, 59, 0, 0, numVal));
      }
      ctx.broadcastPatch({ setup: ctx.state.setup });
      break;
    }

    case 'sync_channel_strip': {
      await ctx.syncChannelStrip(cmd.id);
      break;
    }

    case 'sync_all': {
      await ctx.initialSync();
      ctx.broadcastState();
      break;
    }

    case 'trigger_demo_wave': {
      if (cmd.mode === 'stop' || ctx.state.demoWaveActive) {
        await ctx.stopDemoWave();
      } else {
        await ctx.startDemoWave(cmd.mode ?? 'sine');
      }
      break;
    }
  }
}
