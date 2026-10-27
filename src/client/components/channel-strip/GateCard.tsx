import React from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { resolveKnobReset, RotaryKnob } from '../RotaryKnob';
import { handleSliderWheel } from './sliderWheelHelper';

interface GateCardProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
}

export const GateCard: React.FC<GateCardProps> = ({
  channel,
  savedChannel,
  controlMode,
  sendCommand,
}) => {
  return (
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
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 py-2">
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
            label="HOLD"
            value={channel.gate.hold}
            min={0}
            max={215}
            step={1}
            savedValue={savedChannel?.gate.hold}
            defaultValue={10}
            displayValue={`${channel.gate.hold}`}
            color="#f59e0b"
            size={52}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: channel.id, param: 'hold', value: val })
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                param: 'hold',
                value: resolveKnobReset(
                  channel.gate.hold,
                  savedChannel?.gate.hold,
                  10,
                  e.shiftKey || e.altKey
                ),
              })
            }
            title="Doppio click: ripristina valore memorizzato nella scena"
          >
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1 cursor-pointer select-none">
              <span>HOLD</span>
              <span className="text-slate-200">{channel.gate.hold}</span>
            </div>
            <input
              type="range"
              min={0}
              max={215}
              value={channel.gate.hold}
              onChange={(e) =>
                sendCommand({
                  type: 'set_gate',
                  id: channel.id,
                  param: 'hold',
                  value: Number(e.target.value),
                })
              }
              onWheel={(e) =>
                handleSliderWheel(e, channel.gate.hold, 0, 215, 1, (val) =>
                  sendCommand({
                    type: 'set_gate',
                    id: channel.id,
                    param: 'hold',
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
  );
};
