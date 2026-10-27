import React from 'react';
import { COMP_RATIOS } from '../../../shared/converters';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { resolveKnobReset, RotaryKnob } from '../RotaryKnob';
import { handleSliderWheel } from './sliderWheelHelper';

interface CompressorCardProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
}

export const CompressorCard: React.FC<CompressorCardProps> = ({
  channel,
  savedChannel,
  controlMode,
  sendCommand,
}) => {
  const compRatioLabel = COMP_RATIOS[channel.comp.ratio] ?? '2:1';

  return (
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
        <div className="grid grid-cols-3 gap-3 py-2">
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
            size={52}
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
            size={52}
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
            label="KNEE"
            value={channel.comp.knee}
            min={0}
            max={5}
            step={1}
            savedValue={savedChannel?.comp.knee}
            defaultValue={2}
            displayValue={channel.comp.knee === 0 ? 'HARD' : `S${channel.comp.knee}`}
            color="#22d3ee"
            size={52}
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
            size={52}
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
            size={52}
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
            label="MAKEUP"
            value={channel.comp.gain}
            min={0}
            max={180}
            step={5}
            savedValue={savedChannel?.comp.gain}
            defaultValue={0}
            displayValue={`+${(channel.comp.gain / 10).toFixed(1)}dB`}
            color="#10b981"
            size={52}
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
              <span className="text-emerald-400">
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
              <span className="text-cyan-300">
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
  );
};
