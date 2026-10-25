import React from 'react';
import { COMP_RATIOS, faderToDbString, formatPan } from '../../shared/converters';
import { ClientCommand, InputChannelState, MixerState } from '../../shared/types';
import { FaderStrip } from './FaderStrip';
import { InOutMeterBridge } from './InOutMeterBridge';
import { InteractiveEQ } from './InteractiveEQ';

interface SingleDualChannelViewProps {
  state: MixerState;
  savedState?: MixerState | null;
  sendCommand: (cmd: ClientCommand) => void;
}

const resolveReset = (current: number, saved: number | undefined, factoryDefault: number): number => {
  if (saved !== undefined && current !== saved) {
    return saved;
  }
  return factoryDefault;
};

const handleSliderWheel = (
  e: React.WheelEvent<HTMLInputElement>,
  current: number,
  min: number,
  max: number,
  step: number,
  onChange: (val: number) => void
) => {
  e.preventDefault();
  e.stopPropagation();
  const dir = e.deltaY < 0 ? 1 : -1;
  const next = Math.max(min, Math.min(max, current + dir * step));
  if (next !== current) {
    onChange(next);
  }
};

const FullChannelColumn: React.FC<{
  ch: InputChannelState;
  savedCh?: InputChannelState;
  isSelected: boolean;
  sendCommand: (cmd: ClientCommand) => void;
}> = ({ ch, savedCh, isSelected, sendCommand }) => {
  const compRatioLabel = COMP_RATIOS[ch.comp.ratio] ?? '2:1';

  return (
    <div
      className={`flex-1 min-w-[340px] flex flex-col lg:flex-row gap-3 bg-[#0c1018] border rounded-2xl p-3.5 overflow-y-auto ${
        isSelected ? 'border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.12)]' : 'border-slate-800/90'
      }`}
    >
      {/* Left Tall Motorized Fader + Preamp Column */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <FaderStrip
          id={ch.id}
          label={`CH ${ch.id}`}
          name={ch.name}
          on={ch.on}
          solo={ch.solo}
          fader={ch.fader}
          savedFader={savedCh?.fader}
          pan={ch.pan}
          savedPan={savedCh?.pan}
          meter={ch.meterOut || ch.meterIn}
          selected={isSelected}
          onSelect={() => sendCommand({ type: 'select_channel', id: ch.id })}
          onChangeFader={(val) =>
            sendCommand({ type: 'set_fader', target: 'ch', id: ch.id, value: val })
          }
          onToggleOn={() => sendCommand({ type: 'set_on', target: 'ch', id: ch.id, value: !ch.on })}
          onToggleSolo={() =>
            sendCommand({ type: 'set_solo', target: 'ch', id: ch.id, value: !ch.solo })
          }
          onChangePan={(val) =>
            sendCommand({ type: 'set_pan', target: 'ch', id: ch.id, value: val })
          }
          onRename={(newName) => sendCommand({ type: 'set_name', id: ch.id, name: newName })}
        />

        {/* Quick Phase & Pair Buttons under Fader */}
        <button
          onClick={() => sendCommand({ type: 'set_phase', id: ch.id, value: !ch.phase })}
          className={`w-full py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
            ch.phase
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          Ø {ch.phase ? '180°' : 'NORM'}
        </button>

        <button
          onClick={() => sendCommand({ type: 'set_pair', id: ch.id, value: !ch.pair })}
          className={`w-full py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
            ch.pair
              ? 'bg-purple-500/25 border-purple-400 text-purple-200'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          🔗 PAIR {ch.pair ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Right Comprehensive Rack: Meters, EQ, Gate/Comp, Aux 1-8, Routing */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* 1. Live IN / OUT / GR Level Bridge + Preamp Attenuator */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5 items-center">
          <div className="xl:col-span-2">
            <InOutMeterBridge meterIn={ch.meterIn} meterOut={ch.meterOut} grDb={ch.grDb} />
          </div>
          <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div
              onDoubleClick={() =>
                sendCommand({
                  type: 'set_att',
                  id: ch.id,
                  value: resolveReset(ch.att, savedCh?.att, 0),
                })
              }
              title="Doppio click: ripristina valore memorizzato / 0.0 dB"
              className="flex justify-between text-[10px] font-mono text-slate-400 cursor-pointer select-none"
            >
              <span>ATTENUATOR</span>
              <span className="text-cyan-300">{(ch.att / 10).toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min={-360}
              max={180}
              value={ch.att}
              onChange={(e) =>
                sendCommand({ type: 'set_att', id: ch.id, value: Number(e.target.value) })
              }
              onWheel={(e) =>
                handleSliderWheel(e, ch.att, -360, 180, 5, (val) =>
                  sendCommand({ type: 'set_att', id: ch.id, value: val })
                )
              }
              onDoubleClick={() =>
                sendCommand({
                  type: 'set_att',
                  id: ch.id,
                  value: resolveReset(ch.att, savedCh?.att, 0),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div
              onDoubleClick={() =>
                sendCommand({
                  type: 'set_pan',
                  target: 'ch',
                  id: ch.id,
                  value: resolveReset(ch.pan, savedCh?.pan, 0),
                })
              }
              title="Doppio click: ripristina Pan memorizzato / Center"
              className="flex justify-between text-[10px] font-mono text-slate-400 mt-1 cursor-pointer select-none"
            >
              <span>PAN</span>
              <span className="text-slate-200">{formatPan(ch.pan)}</span>
            </div>
          </div>
        </div>

        {/* 2. Interactive 4-Band EQ */}
        <InteractiveEQ
          eq={ch.eq}
          savedEq={savedCh?.eq}
          meterIn={ch.meterIn}
          meterOut={ch.meterOut}
          grDb={ch.grDb}
          compact
          onChange={(param, value) =>
            sendCommand({ type: 'set_eq', target: 'ch', id: ch.id, param, value })
          }
        />

        {/* 3. Dynamics (Gate + Compressor side-by-side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Gate */}
          <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-amber-400">NOISE GATE</span>
              <button
                onClick={() =>
                  sendCommand({ type: 'set_gate', id: ch.id, param: 'on', value: !ch.gate.on })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                  ch.gate.on ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {ch.gate.on ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_gate',
                    id: ch.id,
                    param: 'threshold',
                    value: resolveReset(ch.gate.threshold, savedCh?.gate.threshold, -260),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>THRESH</span>
                  <span className="text-slate-200">{(ch.gate.threshold / 10).toFixed(1)}dB</span>
                </div>
                <input
                  type="range"
                  min={-540}
                  max={0}
                  value={ch.gate.threshold}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_gate',
                      id: ch.id,
                      param: 'threshold',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.gate.threshold, -540, 0, 5, (val) =>
                      sendCommand({ type: 'set_gate', id: ch.id, param: 'threshold', value: val })
                    )
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_gate',
                    id: ch.id,
                    param: 'range',
                    value: resolveReset(ch.gate.range, savedCh?.gate.range, -560),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>RANGE</span>
                  <span className="text-slate-200">{(ch.gate.range / 10).toFixed(1)}dB</span>
                </div>
                <input
                  type="range"
                  min={-700}
                  max={0}
                  value={ch.gate.range}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_gate',
                      id: ch.id,
                      param: 'range',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.gate.range, -700, 0, 5, (val) =>
                      sendCommand({ type: 'set_gate', id: ch.id, param: 'range', value: val })
                    )
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_gate',
                    id: ch.id,
                    param: 'attack',
                    value: resolveReset(ch.gate.attack, savedCh?.gate.attack, 10),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>ATTACK</span>
                  <span className="text-slate-200">{ch.gate.attack}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={ch.gate.attack}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_gate',
                      id: ch.id,
                      param: 'attack',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.gate.attack, 0, 120, 1, (val) =>
                      sendCommand({ type: 'set_gate', id: ch.id, param: 'attack', value: val })
                    )
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_gate',
                    id: ch.id,
                    param: 'decay',
                    value: resolveReset(ch.gate.decay, savedCh?.gate.decay, 60),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>DECAY</span>
                  <span className="text-slate-200">{ch.gate.decay}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={159}
                  value={ch.gate.decay}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_gate',
                      id: ch.id,
                      param: 'decay',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.gate.decay, 0, 159, 1, (val) =>
                      sendCommand({ type: 'set_gate', id: ch.id, param: 'decay', value: val })
                    )
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Compressor */}
          <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-cyan-400">COMPRESSOR</span>
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_comp',
                    target: 'ch',
                    id: ch.id,
                    param: 'on',
                    value: !ch.comp.on,
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                  ch.comp.on ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {ch.comp.on ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_comp',
                    target: 'ch',
                    id: ch.id,
                    param: 'threshold',
                    value: resolveReset(ch.comp.threshold, savedCh?.comp.threshold, -80),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>THRESH</span>
                  <span className="text-slate-200">{(ch.comp.threshold / 10).toFixed(1)}dB</span>
                </div>
                <input
                  type="range"
                  min={-540}
                  max={0}
                  value={ch.comp.threshold}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_comp',
                      target: 'ch',
                      id: ch.id,
                      param: 'threshold',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.comp.threshold, -540, 0, 5, (val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: ch.id,
                        param: 'threshold',
                        value: val,
                      })
                    )
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_comp',
                    target: 'ch',
                    id: ch.id,
                    param: 'ratio',
                    value: resolveReset(ch.comp.ratio, savedCh?.comp.ratio, 4),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>RATIO</span>
                  <span className="text-cyan-300 font-bold">{compRatioLabel}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  value={ch.comp.ratio}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_comp',
                      target: 'ch',
                      id: ch.id,
                      param: 'ratio',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.comp.ratio, 0, 15, 1, (val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: ch.id,
                        param: 'ratio',
                        value: val,
                      })
                    )
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_comp',
                    target: 'ch',
                    id: ch.id,
                    param: 'gain',
                    value: resolveReset(ch.comp.gain, savedCh?.comp.gain, 0),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / 0.0 dB"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>GAIN</span>
                  <span className="text-emerald-300">+{(ch.comp.gain / 10).toFixed(1)}dB</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={ch.comp.gain}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_comp',
                      target: 'ch',
                      id: ch.id,
                      param: 'gain',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.comp.gain, 0, 180, 5, (val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: ch.id,
                        param: 'gain',
                        value: val,
                      })
                    )
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
              <div
                onDoubleClick={() =>
                  sendCommand({
                    type: 'set_comp',
                    target: 'ch',
                    id: ch.id,
                    param: 'release',
                    value: resolveReset(ch.comp.release, savedCh?.comp.release, 45),
                  })
                }
                title="Doppio click: ripristina valore memorizzato / default"
              >
                <div className="flex justify-between text-slate-400 cursor-pointer select-none">
                  <span>RELEASE</span>
                  <span className="text-slate-200">{ch.comp.release}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={159}
                  value={ch.comp.release}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_comp',
                      target: 'ch',
                      id: ch.id,
                      param: 'release',
                      value: Number(e.target.value),
                    })
                  }
                  onWheel={(e) =>
                    handleSliderWheel(e, ch.comp.release, 0, 159, 1, (val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: ch.id,
                        param: 'release',
                        value: val,
                      })
                    )
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. AUX Sends 1..8 & Bus Routing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* AUX 1..8 */}
          <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] font-mono font-bold text-amber-300 mb-2">
              AUX SENDS 1-8 (CH {ch.id})
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ch.auxSends.map((aux, idx) => (
                <div
                  key={idx}
                  onDoubleClick={() =>
                    sendCommand({
                      type: 'set_aux_send',
                      chId: ch.id,
                      auxId: idx + 1,
                      param: 'level',
                      value: resolveReset(aux.level, savedCh?.auxSends[idx]?.level, 823),
                    })
                  }
                  title="Doppio click: ripristina valore memorizzato / 0.0 dB"
                  className="bg-slate-900/80 border border-slate-800 rounded p-1.5 flex flex-col items-center gap-1 cursor-pointer select-none"
                >
                  <div className="flex items-center justify-between w-full text-[9px] font-mono">
                    <span className="text-amber-300 font-bold">A{idx + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendCommand({
                          type: 'set_aux_send',
                          chId: ch.id,
                          auxId: idx + 1,
                          param: 'pre',
                          value: !aux.pre,
                        });
                      }}
                      className="text-cyan-300 cursor-pointer"
                    >
                      {aux.pre ? 'PRE' : 'PST'}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1023}
                    value={aux.level}
                    onChange={(e) =>
                      sendCommand({
                        type: 'set_aux_send',
                        chId: ch.id,
                        auxId: idx + 1,
                        param: 'level',
                        value: Number(e.target.value),
                      })
                    }
                    onWheel={(e) =>
                      handleSliderWheel(e, aux.level, 0, 1023, 12, (val) =>
                        sendCommand({
                          type: 'set_aux_send',
                          chId: ch.id,
                          auxId: idx + 1,
                          param: 'level',
                          value: val,
                        })
                      )
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[8px] font-mono text-slate-400">
                    {faderToDbString(aux.level)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bus & Stereo Routing */}
          <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-purple-300 mb-2">
              BUS & STEREO ROUTING (CH {ch.id})
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_routing',
                    id: ch.id,
                    target: 'stereo',
                    value: !ch.routing.stereo,
                  })
                }
                className={`py-1.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                  ch.routing.stereo
                    ? 'bg-rose-500 text-slate-950 border-rose-300'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                ST L/R
              </button>
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_routing',
                    id: ch.id,
                    target: 'direct',
                    value: !ch.routing.direct,
                  })
                }
                className={`py-1.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                  ch.routing.direct
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                DIR
              </button>
              {ch.routing.bus.map((bOn, bIdx) => (
                <button
                  key={bIdx}
                  onClick={() =>
                    sendCommand({
                      type: 'set_routing',
                      id: ch.id,
                      target: 'bus',
                      busIndex: bIdx,
                      value: !bOn,
                    })
                  }
                  className={`py-1.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    bOn
                      ? 'bg-purple-500 text-slate-950 border-purple-300'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  B{bIdx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SingleDualChannelView: React.FC<SingleDualChannelViewProps> = ({
  state,
  savedState,
  sendCommand,
}) => {
  const selId = state.selectedChannel;
  // Determine adjacent odd/even stereo pair channel (e.g. Ch 1 & Ch 2, Ch 3 & Ch 4)
  const baseOddId = selId % 2 === 1 ? selId : selId - 1;
  const primaryCh = state.channels[selId - 1] ?? state.channels[0];
  const savedPrimaryCh = savedState?.channels[selId - 1] ?? savedState?.channels[0];
  const leftCh = state.channels[baseOddId - 1] ?? state.channels[0];
  const savedLeftCh = savedState?.channels[baseOddId - 1] ?? savedState?.channels[0];
  const rightCh = state.channels[baseOddId] ?? state.channels[1];
  const savedRightCh = savedState?.channels[baseOddId] ?? savedState?.channels[1];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
      {/* Channel Selector Strip + Single vs Dual Pair Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b0f17] border border-slate-800/90 rounded-xl px-3 py-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {state.channels.slice(0, 16).map((c) => (
            <button
              key={c.id}
              onClick={() => sendCommand({ type: 'select_channel', id: c.id })}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                state.selectedChannel === c.id
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {c.id}
            </button>
          ))}
          <span className="text-slate-700 mx-1">|</span>
          {state.channels.slice(16, 32).map((c) => (
            <button
              key={c.id}
              onClick={() => sendCommand({ type: 'select_channel', id: c.id })}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                state.selectedChannel === c.id
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {c.id}
            </button>
          ))}
        </div>

        {/* Toggle Single Channel vs Dual Stereo Pair View */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => sendCommand({ type: 'set_dual_view', enabled: false })}
            className={`px-3 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
              !state.dualChannelView
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👤 SINGOLO CANALE (CH {selId})
          </button>
          <button
            onClick={() => sendCommand({ type: 'set_dual_view', enabled: true })}
            className={`px-3 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
              state.dualChannelView
                ? 'bg-purple-500 text-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 COPPIA CANALI (CH {baseOddId} & CH {baseOddId + 1})
          </button>
        </div>
      </div>

      {/* Main Single or Side-by-Side Dual Channel Deck */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-y-auto">
        {!state.dualChannelView ? (
          <FullChannelColumn
            ch={primaryCh}
            savedCh={savedPrimaryCh}
            isSelected={true}
            sendCommand={sendCommand}
          />
        ) : (
          <>
            <FullChannelColumn
              ch={leftCh}
              savedCh={savedLeftCh}
              isSelected={state.selectedChannel === leftCh.id}
              sendCommand={sendCommand}
            />
            <FullChannelColumn
              ch={rightCh}
              savedCh={savedRightCh}
              isSelected={state.selectedChannel === rightCh.id}
              sendCommand={sendCommand}
            />
          </>
        )}
      </div>
    </div>
  );
};
