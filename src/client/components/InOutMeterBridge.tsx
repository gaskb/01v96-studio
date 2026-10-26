import React from 'react';

interface InOutMeterBridgeProps {
  meterIn: number;  // 0..255
  meterOut: number; // 0..255
  grDb?: number;    // 0..24 dB Gain Reduction
  compact?: boolean;
  vertical?: boolean;
}

export const InOutMeterBridge: React.FC<InOutMeterBridgeProps> = ({
  meterIn,
  meterOut,
  grDb = 0,
  compact = false,
  vertical = false,
}) => {
  const inPct = Math.max(0, Math.min(100, (meterIn / 255) * 100));
  const outPct = Math.max(0, Math.min(100, (meterOut / 255) * 100));
  const grPct = Math.max(0, Math.min(100, (grDb / 24) * 100));

  const inDbLabel = meterIn <= 0 ? '-∞' : `${(-60 + (meterIn / 255) * 60).toFixed(0)}dB`;
  const outDbLabel = meterOut <= 0 ? '-∞' : `${(-60 + (meterOut / 255) * 60).toFixed(0)}dB`;

  if (vertical) {
    return (
      <div className="flex flex-col items-center justify-between h-full bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 w-full select-none shadow-sm">
        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          METERS
        </span>

        {/* 3 Vertical Meter Columns: IN, GR, OUT */}
        <div className="flex-1 w-full flex items-center justify-around gap-1 py-1 min-h-[140px]">
          {/* IN METER */}
          <div className="flex flex-col items-center h-full w-4 justify-between">
            <span className="text-[8px] font-mono text-sky-400 font-bold">IN</span>
            <div className="flex-1 w-2 bg-[#05080d] rounded-full border border-slate-800/90 overflow-hidden flex flex-col justify-end p-[1px] my-1">
              <div
                className="w-full rounded-full bg-gradient-to-t from-sky-600 via-sky-400 to-cyan-200 transition-all duration-75"
                style={{ height: `${inPct}%` }}
              />
            </div>
            <span className="text-[7px] font-mono text-sky-300 truncate">{inDbLabel}</span>
          </div>

          {/* GR METER (Gain Reduction fills from top down) */}
          <div className="flex flex-col items-center h-full w-4 justify-between">
            <span className="text-[8px] font-mono text-rose-400 font-bold">GR</span>
            <div className="flex-1 w-2 bg-[#05080d] rounded-full border border-slate-800/90 overflow-hidden flex flex-col justify-start p-[1px] my-1">
              <div
                className="w-full rounded-full bg-gradient-to-b from-rose-500 to-amber-500 transition-all duration-75"
                style={{ height: `${grPct}%` }}
              />
            </div>
            <span className="text-[7px] font-mono text-rose-300 truncate">
              {grDb > 0.1 ? `-${grDb.toFixed(0)}` : '0'}
            </span>
          </div>

          {/* OUT METER */}
          <div className="flex flex-col items-center h-full w-4 justify-between">
            <span className="text-[8px] font-mono text-emerald-400 font-bold">OUT</span>
            <div className="flex-1 w-2 bg-[#05080d] rounded-full border border-slate-800/90 overflow-hidden flex flex-col justify-end p-[1px] my-1">
              <div
                className="w-full rounded-full transition-all duration-75"
                style={{
                  height: `${outPct}%`,
                  background:
                    outPct > 90
                      ? 'linear-gradient(to top, #10b981 0%, #f59e0b 75%, #ef4444 100%)'
                      : 'linear-gradient(to top, #059669 0%, #10b981 70%, #34d399 100%)',
                }}
              />
            </div>
            <span className="text-[7px] font-mono text-emerald-300 truncate">{outDbLabel}</span>
          </div>
        </div>

        <span className="text-[8px] font-mono text-slate-500">PRE/DSP</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-[#070a0f] border border-slate-800/90 rounded-lg px-2.5 py-1">
        {/* IN BAR */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-slate-400">IN</span>
          <div className="w-16 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-75"
              style={{ width: `${inPct}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-400 w-7 text-right">{inDbLabel}</span>
        </div>

        {/* GR BAR */}
        {grDb > 0.1 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono font-bold text-rose-400">GR</span>
            <span className="text-[9px] font-mono text-rose-300">-{grDb.toFixed(1)}dB</span>
          </div>
        )}

        {/* OUT BAR */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-emerald-400">OUT</span>
          <div className="w-16 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${outPct}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-emerald-300 w-7 text-right">{outDbLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 bg-[#070a0f] border border-slate-800/90 rounded-xl p-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-400 font-bold">SIGNAL LEVEL (PRE / POST DSP)</span>
        <div className="flex items-center gap-3">
          <span className="text-sky-300">IN: {inDbLabel}</span>
          {grDb > 0 && <span className="text-rose-400 font-bold">GR: -{grDb.toFixed(1)} dB</span>}
          <span className="text-emerald-300 font-bold">OUT: {outDbLabel}</span>
        </div>
      </div>

      {/* IN Bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-sky-400 w-7">IN</span>
        <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-600 via-sky-400 to-cyan-200 transition-all duration-75"
            style={{ width: `${inPct}%` }}
          />
        </div>
      </div>

      {/* OUT Bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-emerald-400 w-7">OUT</span>
        <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${outPct}%`,
              background:
                outPct > 90
                  ? 'linear-gradient(to right, #10b981 0%, #f59e0b 75%, #ef4444 100%)'
                  : 'linear-gradient(to right, #059669 0%, #10b981 70%, #34d399 100%)',
            }}
          />
        </div>
      </div>

      {/* GR Bar (Reverse right-to-left) */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-rose-400 w-7">GR</span>
        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex justify-end p-[1px]">
          <div
            className="h-full rounded-full bg-gradient-to-l from-rose-600 to-amber-500 transition-all duration-75"
            style={{ width: `${grPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
