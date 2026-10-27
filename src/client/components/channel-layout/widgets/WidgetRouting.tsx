import React from 'react';
import { WidgetCommonProps } from './WidgetTypes';

export const WidgetVerticalRouting: React.FC<WidgetCommonProps> = ({
  ch,
  sendCommand,
  busNames,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1.5 flex flex-col justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-850/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="text-[10px] font-mono font-bold text-rose-400">ROUTING</span>
      </div>

      {/* Vertical Buttons Stack: One per row */}
      <div className="flex flex-col items-center gap-0.5 w-full my-0.5">
        {/* Stereo L/R */}
        <button
          onClick={() =>
            sendCommand({
              type: 'set_routing',
              id: ch.id,
              target: 'stereo',
              value: !ch.routing.stereo,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.routing.stereo
              ? 'bg-rose-500 text-white border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Stereo Main L/R Bus"
        >
          ST L/R
        </button>

        {/* Direct Out */}
        <button
          onClick={() =>
            sendCommand({
              type: 'set_routing',
              id: ch.id,
              target: 'direct',
              value: !ch.routing.direct,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.routing.direct
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Direct Out"
        >
          DIR
        </button>

        {/* Bus 1 to 8: One per row */}
        {ch.routing.bus.map((bOn, bIdx) => {
          const busId = bIdx + 1;
          const busName = busNames?.[bIdx] || `BUS ${busId}`;
          return (
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
              title={`BUS ${busId}: ${busName}`}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition truncate px-0.5 ${
                bOn
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {busName !== `BUS ${busId}` && busName.length <= 5 ? busName : `B${busId}`}
            </button>
          );
        })}
      </div>

      {/* Delay Toggle & Time */}
      <div className="flex flex-col items-center gap-0.5 w-full pt-0.5 border-t border-slate-800/80">
        <button
          onClick={() =>
            sendCommand({
              type: 'set_delay',
              id: ch.id,
              on: !ch.delayOn,
              time: ch.delayTime,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.delayOn
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          DLY {ch.delayOn ? 'ON' : 'OFF'}
        </button>
        <span className="text-[7px] font-mono text-cyan-300">
          {(ch.delayTime * 0.45).toFixed(1)}ms
        </span>
      </div>
    </div>
  );
};

// Compatibility export
export const WidgetRouting: React.FC<WidgetCommonProps> = (props) => (
  <WidgetVerticalRouting {...props} />
);
