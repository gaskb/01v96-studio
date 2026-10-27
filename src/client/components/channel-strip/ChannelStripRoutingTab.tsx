import React from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { InOutMeterBridge } from '../InOutMeterBridge';
import { resolveKnobReset, RotaryKnob } from '../RotaryKnob';
import { handleSliderWheel } from './sliderWheelHelper';

interface ChannelStripRoutingTabProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  busNames?: string[];
  sendCommand: (cmd: ClientCommand) => void;
}

export const ChannelStripRoutingTab: React.FC<ChannelStripRoutingTabProps> = ({
  channel,
  savedChannel,
  controlMode,
  busNames,
  sendCommand,
}) => {
  return (
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
  );
};
