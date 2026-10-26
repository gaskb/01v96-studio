import React, { useState } from 'react';
import { COMP_RATIOS, faderToDbString, formatPan } from '../../shared/converters';
import { ClientCommand, ControlMode, InputChannelState } from '../../shared/types';
import { InOutMeterBridge } from './InOutMeterBridge';
import { InteractiveEQ } from './InteractiveEQ';
import { resolveKnobReset, RotaryKnob } from './RotaryKnob';

interface ChannelStripPanelProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  sendCommand: (cmd: ClientCommand) => void;
  auxNames?: string[];
  busNames?: string[];
}

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

export const ChannelStripPanel: React.FC<ChannelStripPanelProps> = ({
  channel,
  savedChannel,
  controlMode,
  onChangeControlMode,
  sendCommand,
  auxNames,
  busNames,
}) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'dyn' | 'aux' | 'routing'>('eq');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(channel.name);

  const compRatioLabel = COMP_RATIOS[channel.comp.ratio] ?? '2:1';

  return (
    <div className="flex flex-col h-full bg-[#0c1018] border border-slate-800/90 rounded-2xl p-3 overflow-y-auto gap-2.5">
      {/* Top Channel Header & Preamp Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <div
            onDoubleClick={() => {
              setNameDraft(channel.name || `CH${channel.id}`);
              setEditingName(true);
            }}
            title={
              channel.name
                ? `CH ${channel.id}: ${channel.name} (Doppio click per modificare)`
                : `CH ${channel.id} (Doppio click per modificare)`
            }
            className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>CH {channel.id} —</span>
            {editingName ? (
              <input
                type="text"
                maxLength={32}
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  sendCommand({
                    type: 'set_name',
                    target: 'ch',
                    id: channel.id,
                    name: nameDraft,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditingName(false);
                    sendCommand({
                      type: 'set_name',
                      target: 'ch',
                      id: channel.id,
                      name: nameDraft,
                    });
                  } else if (e.key === 'Escape') {
                    setNameDraft(channel.name);
                    setEditingName(false);
                  }
                }}
                className="bg-transparent text-cyan-200 outline-none w-36"
              />
            ) : (
              <span className="truncate max-w-[200px]" title={channel.name}>
                {channel.name || `CH${channel.id}`}
              </span>
            )}
          </div>

          {/* Stereo Pair Toggle */}
          <button
            onClick={() => sendCommand({ type: 'set_pair', id: channel.id, value: !channel.pair })}
            className={`px-2 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
              channel.pair
                ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🔗 PAIR {channel.pair ? 'ON' : 'OFF'}
          </button>

          {/* Phase Normal/Reverse */}
          <button
            onClick={() => sendCommand({ type: 'set_phase', id: channel.id, value: !channel.phase })}
            className={`px-2 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
              channel.phase
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Ø {channel.phase ? '180°' : 'NORM'}
          </button>

          {/* Digital Attenuator (-36..+18 dB) */}
          <div
            onDoubleClick={(e) =>
              sendCommand({
                type: 'set_att',
                id: channel.id,
                value: resolveKnobReset(
                  channel.att,
                  savedChannel?.att,
                  0,
                  e.shiftKey || e.altKey
                ),
              })
            }
            title="Doppio click: ripristina valore memorizzato nella scena · Rotella mouse: regola"
            className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1 select-none cursor-pointer"
          >
            <span className="text-[10px] font-mono text-slate-400">ATT</span>
            <input
              type="range"
              min={-360}
              max={180}
              value={channel.att}
              onChange={(e) =>
                sendCommand({ type: 'set_att', id: channel.id, value: Number(e.target.value) })
              }
              onWheel={(e) =>
                handleSliderWheel(e, channel.att, -360, 180, 5, (val) =>
                  sendCommand({ type: 'set_att', id: channel.id, value: val })
                )
              }
              className="w-16 accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-200 w-12 text-right">
              {(channel.att / 10).toFixed(1)}dB
            </span>
          </div>

          {/* Pan Control */}
          <div
            onDoubleClick={(e) =>
              sendCommand({
                type: 'set_pan',
                target: 'ch',
                id: channel.id,
                value: resolveKnobReset(
                  channel.pan,
                  savedChannel?.pan,
                  0,
                  e.shiftKey || e.altKey
                ),
              })
            }
            title="Doppio click: ripristina Pan memorizzato nella scena · Rotella mouse: regola"
            className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1 select-none cursor-pointer"
          >
            <span className="text-[10px] font-mono text-slate-400">PAN</span>
            <input
              type="range"
              min={-63}
              max={63}
              value={channel.pan}
              onChange={(e) =>
                sendCommand({
                  type: 'set_pan',
                  target: 'ch',
                  id: channel.id,
                  value: Number(e.target.value),
                })
              }
              onWheel={(e) =>
                handleSliderWheel(e, channel.pan, -63, 63, 1, (val) =>
                  sendCommand({ type: 'set_pan', target: 'ch', id: channel.id, value: val })
                )
              }
              className="w-16 accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-cyan-300 w-7 text-right">
              {formatPan(channel.pan)}
            </span>
          </div>
        </div>

        {/* Right Controls: Control Style Switcher (Knobs vs Sliders) + Section Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            title="Scegli tra Potenziometri Rotanti (stile console) e Barre Slider"
            className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono"
          >
            <button
              onClick={() => onChangeControlMode('knobs')}
              className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
                controlMode === 'knobs'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎛️ KNOBS
            </button>
            <button
              onClick={() => onChangeControlMode('sliders')}
              className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
                controlMode === 'sliders'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎚️ SLIDERS
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'eq', label: '📊 4-BAND EQ' },
              { id: 'dyn', label: '🎛️ GATE & COMP' },
              { id: 'aux', label: '🎚️ AUX 1-8' },
              { id: 'routing', label: '🔀 ROUTING & DELAY' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: 4-Band Parametric EQ */}
      {activeTab === 'eq' && (
        <InteractiveEQ
          eq={channel.eq}
          savedEq={savedChannel?.eq}
          controlMode={controlMode}
          meterIn={channel.meterIn}
          meterOut={channel.meterOut}
          grDb={channel.grDb}
          onChange={(param, value) =>
            sendCommand({
              type: 'set_eq',
              target: 'ch',
              id: channel.id,
              param,
              value,
            })
          }
        />
      )}

      {/* TAB 2: Gate & Compressor + Live IN / OUT / GR Level Bridge */}
      {activeTab === 'dyn' && (
        <div className="flex flex-col gap-3">
          <InOutMeterBridge
            meterIn={channel.meterIn}
            meterOut={channel.meterOut}
            grDb={channel.grDb}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* GATE CARD */}
            <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  DYNAMICS 1 — NOISE GATE / DUCKING
                </span>
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_gate',
                      id: channel.id,
                      param: 'on',
                      value: !channel.gate.on,
                    })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold cursor-pointer transition ${
                    channel.gate.on
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  GATE {channel.gate.on ? 'ON' : 'OFF'}
                </button>
              </div>

              {controlMode === 'knobs' ? (
                <div className="grid grid-cols-4 gap-2 py-2">
                  <RotaryKnob
                    label="THRESHOLD"
                    value={channel.gate.threshold}
                    min={-540}
                    max={0}
                    step={5}
                    savedValue={savedChannel?.gate.threshold}
                    defaultValue={-260}
                    displayValue={`${(channel.gate.threshold / 10).toFixed(1)}dB`}
                    color="#f59e0b"
                    size={52}
                    onChange={(val) =>
                      sendCommand({ type: 'set_gate', id: channel.id, param: 'threshold', value: val })
                    }
                  />
                  <RotaryKnob
                    label="RANGE"
                    value={channel.gate.range}
                    min={-700}
                    max={0}
                    step={5}
                    savedValue={savedChannel?.gate.range}
                    defaultValue={-560}
                    displayValue={`${(channel.gate.range / 10).toFixed(1)}dB`}
                    color="#f59e0b"
                    size={52}
                    onChange={(val) =>
                      sendCommand({ type: 'set_gate', id: channel.id, param: 'range', value: val })
                    }
                  />
                  <RotaryKnob
                    label="ATTACK"
                    value={channel.gate.attack}
                    min={0}
                    max={120}
                    step={1}
                    savedValue={savedChannel?.gate.attack}
                    defaultValue={10}
                    displayValue={`${channel.gate.attack}`}
                    color="#f59e0b"
                    size={52}
                    onChange={(val) =>
                      sendCommand({ type: 'set_gate', id: channel.id, param: 'attack', value: val })
                    }
                  />
                  <RotaryKnob
                    label="DECAY"
                    value={channel.gate.decay}
                    min={0}
                    max={159}
                    step={1}
                    savedValue={savedChannel?.gate.decay}
                    defaultValue={44}
                    displayValue={`${channel.gate.decay}`}
                    color="#f59e0b"
                    size={52}
                    onChange={(val) =>
                      sendCommand({ type: 'set_gate', id: channel.id, param: 'decay', value: val })
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_gate',
                        id: channel.id,
                        param: 'threshold',
                        value: resolveKnobReset(
                          channel.gate.threshold,
                          savedChannel?.gate.threshold,
                          -260,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>THRESHOLD</span>
                      <span className="text-slate-200">
                        {(channel.gate.threshold / 10).toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-540}
                      max={0}
                      value={channel.gate.threshold}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_gate',
                          id: channel.id,
                          param: 'threshold',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.gate.threshold, -540, 0, 5, (val) =>
                          sendCommand({
                            type: 'set_gate',
                            id: channel.id,
                            param: 'threshold',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_gate',
                        id: channel.id,
                        param: 'range',
                        value: resolveKnobReset(
                          channel.gate.range,
                          savedChannel?.gate.range,
                          -560,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>RANGE</span>
                      <span className="text-slate-200">
                        {(channel.gate.range / 10).toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-700}
                      max={0}
                      value={channel.gate.range}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_gate',
                          id: channel.id,
                          param: 'range',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.gate.range, -700, 0, 5, (val) =>
                          sendCommand({ type: 'set_gate', id: channel.id, param: 'range', value: val })
                        )
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_gate',
                        id: channel.id,
                        param: 'attack',
                        value: resolveKnobReset(
                          channel.gate.attack,
                          savedChannel?.gate.attack,
                          10,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>ATTACK</span>
                      <span className="text-slate-200">{channel.gate.attack}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      value={channel.gate.attack}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_gate',
                          id: channel.id,
                          param: 'attack',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.gate.attack, 0, 120, 1, (val) =>
                          sendCommand({
                            type: 'set_gate',
                            id: channel.id,
                            param: 'attack',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_gate',
                        id: channel.id,
                        param: 'decay',
                        value: resolveKnobReset(
                          channel.gate.decay,
                          savedChannel?.gate.decay,
                          44,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>DECAY</span>
                      <span className="text-slate-200">{channel.gate.decay}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={159}
                      value={channel.gate.decay}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_gate',
                          id: channel.id,
                          param: 'decay',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.gate.decay, 0, 159, 1, (val) =>
                          sendCommand({ type: 'set_gate', id: channel.id, param: 'decay', value: val })
                        )
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* COMPRESSOR CARD */}
            <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  DYNAMICS 2 — COMPRESSOR / EXPANDER
                </span>
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_comp',
                      target: 'ch',
                      id: channel.id,
                      param: 'on',
                      value: !channel.comp.on,
                    })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold cursor-pointer transition ${
                    channel.comp.on
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  COMP {channel.comp.on ? 'ON' : 'OFF'}
                </button>
              </div>

              {controlMode === 'knobs' ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 py-2">
                  <RotaryKnob
                    label="THRESH"
                    value={channel.comp.threshold}
                    min={-540}
                    max={0}
                    step={5}
                    savedValue={savedChannel?.comp.threshold}
                    defaultValue={-200}
                    displayValue={`${(channel.comp.threshold / 10).toFixed(1)}dB`}
                    color="#22d3ee"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'threshold',
                        value: val,
                      })
                    }
                  />
                  <RotaryKnob
                    label="RATIO"
                    value={channel.comp.ratio}
                    min={0}
                    max={15}
                    step={1}
                    savedValue={savedChannel?.comp.ratio}
                    defaultValue={5}
                    displayValue={compRatioLabel}
                    color="#22d3ee"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'ratio',
                        value: val,
                      })
                    }
                  />
                  <RotaryKnob
                    label="MAKEUP"
                    value={channel.comp.gain}
                    min={0}
                    max={180}
                    step={5}
                    savedValue={savedChannel?.comp.gain}
                    defaultValue={0}
                    displayValue={`+${(channel.comp.gain / 10).toFixed(1)}dB`}
                    color="#10b981"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'gain',
                        value: val,
                      })
                    }
                  />
                  <RotaryKnob
                    label="ATTACK"
                    value={channel.comp.attack}
                    min={0}
                    max={120}
                    step={1}
                    savedValue={savedChannel?.comp.attack}
                    defaultValue={30}
                    displayValue={`${channel.comp.attack}`}
                    color="#22d3ee"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'attack',
                        value: val,
                      })
                    }
                  />
                  <RotaryKnob
                    label="RELEASE"
                    value={channel.comp.release}
                    min={0}
                    max={159}
                    step={1}
                    savedValue={savedChannel?.comp.release}
                    defaultValue={40}
                    displayValue={`${channel.comp.release}`}
                    color="#22d3ee"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'release',
                        value: val,
                      })
                    }
                  />
                  <RotaryKnob
                    label="KNEE"
                    value={channel.comp.knee}
                    min={0}
                    max={5}
                    step={1}
                    savedValue={savedChannel?.comp.knee}
                    defaultValue={2}
                    displayValue={channel.comp.knee === 0 ? 'HARD' : `S${channel.comp.knee}`}
                    color="#22d3ee"
                    size={50}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'knee',
                        value: val,
                      })
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'threshold',
                        value: resolveKnobReset(
                          channel.comp.threshold,
                          savedChannel?.comp.threshold,
                          -200,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>THRESHOLD</span>
                      <span className="text-slate-200">
                        {(channel.comp.threshold / 10).toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-540}
                      max={0}
                      value={channel.comp.threshold}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'threshold',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.threshold, -540, 0, 5, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'threshold',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'ratio',
                        value: resolveKnobReset(
                          channel.comp.ratio,
                          savedChannel?.comp.ratio,
                          5,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>RATIO</span>
                      <span className="text-cyan-300 font-bold">{compRatioLabel}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={15}
                      value={channel.comp.ratio}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'ratio',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.ratio, 0, 15, 1, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'ratio',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'gain',
                        value: resolveKnobReset(
                          channel.comp.gain,
                          savedChannel?.comp.gain,
                          0,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>MAKEUP GAIN</span>
                      <span className="text-emerald-300">
                        +{(channel.comp.gain / 10).toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={channel.comp.gain}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'gain',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.gain, 0, 180, 5, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'gain',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'attack',
                        value: resolveKnobReset(
                          channel.comp.attack,
                          savedChannel?.comp.attack,
                          30,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>ATTACK</span>
                      <span className="text-slate-200">{channel.comp.attack}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      value={channel.comp.attack}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'attack',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.attack, 0, 120, 1, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'attack',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'release',
                        value: resolveKnobReset(
                          channel.comp.release,
                          savedChannel?.comp.release,
                          40,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>RELEASE</span>
                      <span className="text-slate-200">{channel.comp.release}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={159}
                      value={channel.comp.release}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'release',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.release, 0, 159, 1, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'release',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_comp',
                        target: 'ch',
                        id: channel.id,
                        param: 'knee',
                        value: resolveKnobReset(
                          channel.comp.knee,
                          savedChannel?.comp.knee,
                          2,
                          e.shiftKey || e.altKey
                        ),
                      })
                    }
                    title="Doppio click: ripristina valore memorizzato nella scena"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                      <span>KNEE</span>
                      <span className="text-slate-200">
                        {channel.comp.knee === 0 ? 'HARD' : `SOFT ${channel.comp.knee}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      value={channel.comp.knee}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_comp',
                          target: 'ch',
                          id: channel.id,
                          param: 'knee',
                          value: Number(e.target.value),
                        })
                      }
                      onWheel={(e) =>
                        handleSliderWheel(e, channel.comp.knee, 0, 5, 1, (val) =>
                          sendCommand({
                            type: 'set_comp',
                            target: 'ch',
                            id: channel.id,
                            param: 'knee',
                            value: val,
                          })
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUX Sends 1..8 + Live IN/OUT Level */}
      {activeTab === 'aux' && (
        <div className="flex flex-col gap-3">
          <InOutMeterBridge
            meterIn={channel.meterIn}
            meterOut={channel.meterOut}
            grDb={channel.grDb}
            compact
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {channel.auxSends.map((aux, idx) => {
              const auxId = idx + 1;
              const savedLevel = savedChannel?.auxSends[idx]?.level;
              return (
                <div
                  key={auxId}
                  className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5 flex flex-col items-center gap-2"
                >
                  <span
                    className="text-xs font-mono font-bold text-amber-300 truncate max-w-full"
                    title={auxNames?.[idx] ? `AUX ${auxId}: ${auxNames[idx]}` : `AUX ${auxId}`}
                  >
                    {auxNames?.[idx] || `AUX ${auxId}`}
                  </span>
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={() =>
                        sendCommand({
                          type: 'set_aux_send',
                          chId: channel.id,
                          auxId,
                          param: 'on',
                          value: !aux.on,
                        })
                      }
                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                        aux.on ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {aux.on ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() =>
                        sendCommand({
                          type: 'set_aux_send',
                          chId: channel.id,
                          auxId,
                          param: 'pre',
                          value: !aux.pre,
                        })
                      }
                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                        aux.pre
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                          : 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {aux.pre ? 'PRE' : 'POST'}
                    </button>
                  </div>

                  {controlMode === 'knobs' ? (
                    <RotaryKnob
                      label="SEND"
                      value={aux.level}
                      min={0}
                      max={1023}
                      step={12}
                      savedValue={savedLevel}
                      defaultValue={823}
                      displayValue={faderToDbString(aux.level)}
                      color="#f59e0b"
                      size={52}
                      onChange={(val) =>
                        sendCommand({
                          type: 'set_aux_send',
                          chId: channel.id,
                          auxId,
                          param: 'level',
                          value: val,
                        })
                      }
                    />
                  ) : (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={1023}
                        value={aux.level}
                        onChange={(e) =>
                          sendCommand({
                            type: 'set_aux_send',
                            chId: channel.id,
                            auxId,
                            param: 'level',
                            value: Number(e.target.value),
                          })
                        }
                        onWheel={(e) =>
                          handleSliderWheel(e, aux.level, 0, 1023, 12, (val) =>
                            sendCommand({
                              type: 'set_aux_send',
                              chId: channel.id,
                              auxId,
                              param: 'level',
                              value: val,
                            })
                          )
                        }
                        onDoubleClick={(e) =>
                          sendCommand({
                            type: 'set_aux_send',
                            chId: channel.id,
                            auxId,
                            param: 'level',
                            value: resolveKnobReset(
                              aux.level,
                              savedLevel,
                              823,
                              e.shiftKey || e.altKey
                            ),
                          })
                        }
                        className="w-full accent-amber-400 cursor-pointer my-1"
                      />
                      <span
                        onDoubleClick={(e) =>
                          sendCommand({
                            type: 'set_aux_send',
                            chId: channel.id,
                            auxId,
                            param: 'level',
                            value: resolveKnobReset(
                              aux.level,
                              savedLevel,
                              823,
                              e.shiftKey || e.altKey
                            ),
                          })
                        }
                        title="Doppio click: ripristina valore memorizzato nella scena"
                        className="text-[10px] font-mono text-slate-300 cursor-pointer select-none"
                      >
                        {faderToDbString(aux.level)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Routing (ST, DIRECT, BUS 1..8) + Input Delay + IN/OUT Meter */}
      {activeTab === 'routing' && (
        <div className="flex flex-col gap-3">
          <InOutMeterBridge
            meterIn={channel.meterIn}
            meterOut={channel.meterOut}
            grDb={channel.grDb}
            compact
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-[#0d1118] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                OUTPUT BUS & STEREO ROUTING ASSIGNMENTS (CH {channel.id})
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_routing',
                      id: channel.id,
                      target: 'stereo',
                      value: !channel.routing.stereo,
                    })
                  }
                  className={`px-3.5 py-2 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${
                    channel.routing.stereo
                      ? 'bg-rose-500 text-slate-950 border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.5)]'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  STEREO L/R {channel.routing.stereo ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_routing',
                      id: channel.id,
                      target: 'direct',
                      value: !channel.routing.direct,
                    })
                  }
                  className={`px-3.5 py-2 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${
                    channel.routing.direct
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  DIRECT OUT {channel.routing.direct ? 'ON' : 'OFF'}
                </button>

                {channel.routing.bus.map((assigned, bIdx) => {
                  const busId = bIdx + 1;
                  const busName = busNames?.[bIdx] || `BUS ${busId}`;
                  return (
                    <button
                      key={bIdx}
                      onClick={() =>
                        sendCommand({
                          type: 'set_routing',
                          id: channel.id,
                          target: 'bus',
                          busIndex: bIdx,
                          value: !assigned,
                        })
                      }
                      title={`BUS ${busId}: ${busName}`}
                      className={`px-3 py-2 rounded-lg font-mono font-bold text-xs border transition cursor-pointer truncate max-w-[140px] ${
                        assigned
                          ? 'bg-purple-500 text-slate-950 border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {busName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel Digital Delay */}
            <div className="bg-[#0d1118] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300">CHANNEL DELAY</span>
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_delay',
                      id: channel.id,
                      on: !channel.delayOn,
                      time: channel.delayTime,
                    })
                  }
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                    channel.delayOn ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {channel.delayOn ? 'DELAY ON' : 'OFF'}
                </button>
              </div>
              {controlMode === 'knobs' ? (
                <div className="flex justify-center py-1">
                  <RotaryKnob
                    label="DELAY TIME"
                    value={channel.delayTime}
                    min={0}
                    max={1000}
                    step={5}
                    savedValue={savedChannel?.delayTime}
                    defaultValue={0}
                    displayValue={`${(channel.delayTime * 0.45).toFixed(1)} ms`}
                    color="#22d3ee"
                    size={52}
                    onChange={(val) =>
                      sendCommand({
                        type: 'set_delay',
                        id: channel.id,
                        on: channel.delayOn,
                        time: val,
                      })
                    }
                  />
                </div>
              ) : (
                <div
                  onDoubleClick={(e) =>
                    sendCommand({
                      type: 'set_delay',
                      id: channel.id,
                      on: channel.delayOn,
                      time: resolveKnobReset(
                        channel.delayTime,
                        savedChannel?.delayTime,
                        0,
                        e.shiftKey || e.altKey
                      ),
                    })
                  }
                  title="Doppio click: ripristina valore memorizzato nella scena"
                >
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
                    <span>DELAY TIME</span>
                    <span className="text-slate-200">{(channel.delayTime * 0.45).toFixed(1)} ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={channel.delayTime}
                    onChange={(e) =>
                      sendCommand({
                        type: 'set_delay',
                        id: channel.id,
                        on: channel.delayOn,
                        time: Number(e.target.value),
                      })
                    }
                    onWheel={(e) =>
                      handleSliderWheel(e, channel.delayTime, 0, 1000, 5, (val) =>
                        sendCommand({
                          type: 'set_delay',
                          id: channel.id,
                          on: channel.delayOn,
                          time: val,
                        })
                      )
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
