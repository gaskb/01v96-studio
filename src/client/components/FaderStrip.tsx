import React, { useRef, useState } from 'react';
import { faderToDbString, formatPan } from '../../shared/converters';

interface FaderStripProps {
  id: number;
  label: string;
  name: string;
  on: boolean;
  solo?: boolean;
  fader: number;
  savedFader?: number;
  pan: number;
  savedPan?: number;
  meter: number;
  selected: boolean;
  accentColor?: 'cyan' | 'amber' | 'purple' | 'rose';
  compact?: boolean;
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
  savedFader,
  pan,
  savedPan,
  meter,
  selected,
  accentColor = 'cyan',
  compact = false,
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

  const resetFader = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (savedFader !== undefined && !e?.shiftKey && !e?.altKey) {
      onChangeFader(savedFader);
    } else {
      onChangeFader(823);
    }
  };

  const resetPan = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (savedPan !== undefined && !e?.shiftKey && !e?.altKey) {
      onChangePan(savedPan);
    } else {
      onChangePan(0);
    }
  };

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
  const isExpansionBank = id >= 17 && id <= 32;

  const borderStyle = selected
    ? isExpansionBank
      ? 'border-purple-400 bg-[#161224] shadow-[0_0_16px_rgba(192,132,252,0.25)]'
      : 'border-cyan-400 bg-[#131b27] shadow-[0_0_16px_rgba(34,211,238,0.18)]'
    : isExpansionBank
      ? 'border-purple-950/70 bg-[#0f0c18] hover:border-purple-800/60'
      : 'border-slate-800/90 bg-[#0e131d] hover:border-slate-700';

  const capColor =
    accentColor === 'rose'
      ? 'from-rose-500 to-rose-700 border-rose-300'
      : accentColor === 'amber'
        ? 'from-amber-400 to-amber-600 border-amber-200'
        : accentColor === 'purple' || (isExpansionBank && accentColor === 'cyan')
          ? 'from-purple-400 to-purple-600 border-purple-200'
          : 'from-slate-200 to-slate-400 border-white';

  const widthClass = compact
    ? 'flex-1 min-w-[40px] sm:min-w-[46px] 2xl:min-w-[52px] p-1'
    : 'flex-1 min-w-[58px] sm:min-w-[64px] p-1.5';

  return (
    <div
      className={`flex flex-col items-center h-full rounded-xl border transition-colors select-none ${widthClass} ${borderStyle}`}
    >
      {/* SEL Button */}
      <button
        onClick={onSelect}
        className={`w-full py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer mb-1 ${
          selected
            ? isExpansionBank
              ? 'bg-purple-400 text-slate-950 shadow-[0_0_10px_rgba(192,132,252,0.7)]'
              : 'bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
            : isExpansionBank
              ? 'bg-purple-950/80 border border-purple-800/60 text-purple-300 hover:bg-purple-900/80 hover:text-white'
              : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        }`}
      >
        {label}
      </button>

      {/* LCD Scribble Strip (Channel Name) */}
      <div
        onDoubleClick={() => {
          if (onRename) {
            setNameDraft(name || label);
            setEditingName(true);
          }
        }}
        title={name ? `${label}: ${name} (Doppio click per modificare)` : `${label} (Doppio click per modificare)`}
        className={`w-full ${compact ? 'h-5 mb-1' : 'h-6 mb-1.5'} ${
          isExpansionBank ? 'bg-[#090712] border-purple-900/50' : 'bg-[#070a0f] border-slate-800'
        } border rounded flex items-center justify-center px-0.5 overflow-hidden cursor-pointer`}
      >
        {editingName ? (
          <input
            type="text"
            maxLength={32}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              onRename?.(nameDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingName(false);
                onRename?.(nameDraft);
              } else if (e.key === 'Escape') {
                setNameDraft(name);
                setEditingName(false);
              }
            }}
            className={`w-full bg-transparent text-center text-[10px] sm:text-[11px] font-mono font-bold ${
              isExpansionBank ? 'text-purple-300' : 'text-cyan-300'
            } outline-none`}
          />
        ) : (
          <span
            title={name || label}
            className={`text-[10px] sm:text-[11px] font-mono font-semibold ${
              isExpansionBank ? 'text-purple-200' : 'text-cyan-200'
            } truncate`}
          >
            {name || label}
          </span>
        )}
      </div>

      {/* ON (Unmute) Button — Yamaha Orange/Amber style */}
      <button
        onClick={onToggleOn}
        className={`w-full ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'} rounded-md font-mono font-bold tracking-wider transition cursor-pointer mb-1 ${
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
          className={`w-full py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold tracking-wider transition cursor-pointer mb-1 ${
            solo
              ? 'bg-yellow-400 text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.6)]'
              : 'bg-slate-900/70 text-slate-500 border border-slate-800/80 hover:text-slate-300'
          }`}
        >
          SOLO
        </button>
      )}

      {/* Mini Pan Bar (Wheel + Double-Click Reset) */}
      <div
        className="w-full mb-1 px-0.5"
        onDoubleClick={resetPan}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dir = e.deltaY < 0 ? 1 : -1;
          onChangePan(Math.max(-63, Math.min(63, pan + dir * 2)));
        }}
        title="Doppio click per ripristinare il Pan salvato / Centro"
      >
        <div className="flex justify-between text-[8px] sm:text-[9px] font-mono text-slate-400 mb-0.5 cursor-pointer">
          <span>PAN</span>
          <span className="text-slate-300 hover:text-cyan-300 truncate max-w-[28px]">{formatPan(pan)}</span>
        </div>
        <input
          type="range"
          min={-63}
          max={63}
          value={pan}
          onChange={(e) => onChangePan(Number(e.target.value))}
          className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
        />
      </div>

      {/* Fader Track + Live LED Meter */}
      <div
        className="relative flex-1 w-full flex items-center justify-center gap-1 sm:gap-1.5 my-1 min-h-[150px] sm:min-h-[180px] xl:min-h-[220px]"
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dir = e.deltaY < 0 ? 1 : -1;
          onChangeFader(Math.max(0, Math.min(1023, fader + dir * 12)));
        }}
      >
        {/* dB Scale Tick Marks */}
        <div className={`relative h-full ${compact ? 'w-2 text-[7px] hidden 2xl:flex' : 'w-3 text-[8px] flex'} flex-col justify-between py-4 font-mono text-slate-500 select-none pointer-events-none`}>
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
          onDoubleClick={resetFader}
          title="Doppio click per ripristinare il valore salvato nella scena o 0.0 dB"
          className="relative h-full w-7 flex justify-center py-4 cursor-ns-resize touch-none"
        >
          {/* Vertical groove */}
          <div className="w-1.5 h-full bg-[#06080d] rounded-full border border-slate-800 relative overflow-hidden">
            {/* Fill level */}
            <div
              className={`absolute bottom-0 left-0 right-0 ${
                isExpansionBank ? 'bg-purple-500/35' : 'bg-cyan-500/30'
              } transition-all duration-75`}
              style={{ height: `${faderPercent}%` }}
            />
          </div>

          {/* 0 dB Unity Reference Line */}
          <div
            className={`absolute left-0.5 right-0.5 h-[1.5px] ${
              isExpansionBank ? 'bg-purple-400/50' : 'bg-cyan-400/50'
            } pointer-events-none`}
            style={{ bottom: `calc(${zeroDbPercent}% * 0.86 + 14px)` }}
          />

          {/* Saved Scene Position Ghost Marker */}
          {savedFader !== undefined && savedFader !== fader && (
            <div
              className="absolute left-1 right-1 h-[2px] bg-amber-400/70 pointer-events-none"
              style={{ bottom: `calc(16px + (100% - 32px) * ${savedFader / 1023})` }}
            />
          )}

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

      {/* Numeric dB Readout (Double-Click resets fader too!) */}
      <div
        onDoubleClick={resetFader}
        title="Doppio click per ripristinare il valore salvato nella scena o 0.0 dB"
        className={`w-full py-0.5 ${
          isExpansionBank
            ? 'bg-[#090712] hover:bg-purple-950/60 border-purple-900/50 text-purple-300/80 hover:text-purple-200'
            : 'bg-[#070a0f] hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:text-cyan-300'
        } border rounded text-center text-[10px] font-mono cursor-pointer transition`}
      >
        {faderToDbString(fader)}
      </div>
    </div>
  );
};
