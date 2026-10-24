import React, { useRef, useState } from 'react';
import { faderToDbString, formatPan } from '../../shared/converters';

interface FaderStripProps {
  id: number;
  label: string;
  name: string;
  on: boolean;
  solo?: boolean;
  fader: number;
  pan: number;
  meter: number;
  selected: boolean;
  accentColor?: 'cyan' | 'amber' | 'purple' | 'rose';
  onSelect: () => void;
  onChangeFader: (val: number) => void;
  onToggleOn: () => void;
  onToggleSolo?: () => void;
  onChangePan: (val: number) => void;
  onRename?: (newName: string) => void;
}

export const FaderStrip: React.FC<FaderStripProps> = ({
  id,
  label,
  name,
  on,
  solo,
  fader,
  pan,
  meter,
  selected,
  accentColor = 'cyan',
  onSelect,
  onChangeFader,
  onToggleOn,
  onToggleSolo,
  onChangePan,
  onRename,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);

  const updateFaderFromPointer = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pad = 16;
    const usableH = rect.height - pad * 2;
    const relY = clientY - (rect.top + pad);
    const norm = 1 - Math.max(0, Math.min(1, relY / usableH));
    const val = Math.round(norm * 1023);
    onChangeFader(val);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFaderFromPointer(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFaderFromPointer(e.clientY);
  };

  const faderPercent = Math.max(0, Math.min(100, (fader / 1023) * 100));
  const meterPercent = Math.max(0, Math.min(100, (meter / 255) * 100));
  const zeroDbPercent = (823 / 1023) * 100; // ~80.45%

  const borderStyle = selected
    ? 'border-cyan-400 bg-[#131b27] shadow-[0_0_16px_rgba(34,211,238,0.18)]'
    : 'border-slate-800/90 bg-[#0e131d] hover:border-slate-700';

  const capColor =
    accentColor === 'rose'
      ? 'from-rose-500 to-rose-700 border-rose-300'
      : accentColor === 'amber'
        ? 'from-amber-400 to-amber-600 border-amber-200'
        : accentColor === 'purple'
          ? 'from-purple-400 to-purple-600 border-purple-200'
          : 'from-slate-200 to-slate-400 border-white';

  return (
    <div
      className={`flex flex-col items-center w-[62px] min-w-[62px] sm:w-[66px] sm:min-w-[66px] h-full rounded-xl border p-1.5 transition-colors select-none ${borderStyle}`}
    >
      {/* SEL Button */}
      <button
        onClick={onSelect}
        className={`w-full py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer mb-1 ${
          selected
            ? 'bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
            : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        }`}
      >
        {label}
      </button>

      {/* LCD Scribble Strip (Channel Name) */}
      <div
        onDoubleClick={() => {
          if (onRename) {
            setNameDraft(name);
            setEditingName(true);
          }
        }}
        title="Doppio click per rinominare sul display del mixer"
        className="w-full h-6 bg-[#070a0f] border border-slate-800 rounded flex items-center justify-center mb-1.5 px-1 overflow-hidden cursor-pointer"
      >
        {editingName ? (
          <input
            type="text"
            maxLength={4}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.toUpperCase())}
            onBlur={() => {
              setEditingName(false);
              onRename?.(nameDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingName(false);
                onRename?.(nameDraft);
              }
            }}
            className="w-full bg-transparent text-center text-[11px] font-mono font-bold text-cyan-300 outline-none"
          />
        ) : (
          <span className="text-[11px] font-mono font-semibold text-cyan-200 truncate">
            {name || `CH${id}`}
          </span>
        )}
      </div>

      {/* ON (Unmute) Button — Yamaha Orange/Amber style */}
      <button
        onClick={onToggleOn}
        className={`w-full py-1.5 rounded-md text-[11px] font-mono font-bold tracking-wider transition cursor-pointer mb-1 ${
          on
            ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
            : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
        }`}
      >
        {on ? 'ON' : 'MUTE'}
      </button>

      {/* SOLO Button */}
      {onToggleSolo && (
        <button
          onClick={onToggleSolo}
          className={`w-full py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition cursor-pointer mb-1.5 ${
            solo
              ? 'bg-yellow-400 text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.6)]'
              : 'bg-slate-900/70 text-slate-500 border border-slate-800/80 hover:text-slate-300'
          }`}
        >
          SOLO
        </button>
      )}

      {/* Mini Pan Bar */}
      <div className="w-full mb-1.5 px-0.5">
        <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
          <span>PAN</span>
          <span className="text-slate-300">{formatPan(pan)}</span>
        </div>
        <input
          type="range"
          min={-63}
          max={63}
          value={pan}
          onChange={(e) => onChangePan(Number(e.target.value))}
          onDoubleClick={() => onChangePan(0)}
          className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
        />
      </div>

      {/* Fader Track + Live LED Meter */}
      <div className="relative flex-1 w-full flex items-center justify-center gap-1.5 my-1 min-h-[190px]">
        {/* dB Scale Tick Marks */}
        <div className="relative h-full w-3 flex flex-col justify-between py-4 text-[8px] font-mono text-slate-500 select-none pointer-events-none">
          <span>+10</span>
          <span className="text-cyan-400 font-bold">0</span>
          <span>-10</span>
          <span>-20</span>
          <span>-40</span>
          <span>-∞</span>
        </div>

        {/* Motorized Fader Slot */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onDoubleClick={() => onChangeFader(823)} // Double click -> 0.0 dB
          title="Doppio click per 0.0 dB"
          className="relative h-full w-7 flex justify-center py-4 cursor-ns-resize touch-none"
        >
          {/* Vertical groove */}
          <div className="w-1.5 h-full bg-[#06080d] rounded-full border border-slate-800 relative overflow-hidden">
            {/* Fill level */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-cyan-500/30 transition-all duration-75"
              style={{ height: `${faderPercent}%` }}
            />
          </div>

          {/* 0 dB Unity Reference Line */}
          <div
            className="absolute left-0.5 right-0.5 h-[1.5px] bg-cyan-400/50 pointer-events-none"
            style={{ bottom: `calc(${zeroDbPercent}% * 0.86 + 14px)` }}
          />

          {/* Metallic Motorized Fader Cap */}
          <div
            className={`absolute left-0.5 right-0.5 h-7 -mb-3.5 rounded bg-gradient-to-b ${capColor} border shadow-[0_4px_10px_rgba(0,0,0,0.8)] flex items-center justify-center pointer-events-none transition-[bottom] duration-[35ms]`}
            style={{
              bottom: `calc(16px + (100% - 32px) * ${faderPercent / 100})`,
            }}
          >
            <div className="w-full h-[2px] bg-slate-950" />
          </div>
        </div>

        {/* Vertical LED VU Meter */}
        <div className="h-full w-2 py-4 flex flex-col justify-end">
          <div className="w-full h-full bg-[#06080c] rounded-full border border-slate-800/90 overflow-hidden flex flex-col justify-end p-[1px]">
            <div
              className="w-full rounded-full transition-all duration-75"
              style={{
                height: `${meterPercent}%`,
                background:
                  meterPercent > 90
                    ? 'linear-gradient(to top, #10b981 0%, #f59e0b 75%, #ef4444 100%)'
                    : meterPercent > 70
                      ? 'linear-gradient(to top, #10b981 0%, #f59e0b 100%)'
                      : '#10b981',
              }}
            />
          </div>
        </div>
      </div>

      {/* Numeric dB Readout */}
      <div className="w-full py-0.5 bg-[#070a0f] border border-slate-800/80 rounded text-center text-[10px] font-mono text-slate-300">
        {faderToDbString(fader)}
      </div>
    </div>
  );
};
