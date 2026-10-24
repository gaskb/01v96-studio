import React, { useEffect, useRef, useState } from 'react';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  formatEqQ,
  formatFreqHz,
  freqHzToEqIndex,
} from '../../shared/converters';
import { ChannelEQState } from '../../shared/types';

interface InteractiveEQProps {
  eq: ChannelEQState;
  onChange: (param: string, value: number | boolean) => void;
}

type BandKey = 'low' | 'lowMid' | 'hiMid' | 'high';

const BAND_CONFIG: {
  key: BandKey;
  label: string;
  color: string;
  fill: string;
  qParam: string;
  fParam: string;
  gParam: string;
}[] = [
  {
    key: 'low',
    label: 'LOW',
    color: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.16)',
    qParam: 'lowQ',
    fParam: 'lowF',
    gParam: 'lowG',
  },
  {
    key: 'lowMid',
    label: 'LO-MID',
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.16)',
    qParam: 'lowMidQ',
    fParam: 'lowMidF',
    gParam: 'lowMidG',
  },
  {
    key: 'hiMid',
    label: 'HI-MID',
    color: '#10b981',
    fill: 'rgba(16, 185, 129, 0.16)',
    qParam: 'hiMidQ',
    fParam: 'hiMidF',
    gParam: 'hiMidG',
  },
  {
    key: 'high',
    label: 'HIGH',
    color: '#06b6d4',
    fill: 'rgba(6, 182, 212, 0.16)',
    qParam: 'highQ',
    fParam: 'highF',
    gParam: 'highG',
  },
];

// Compute biquad magnitude in dB at frequency f (Hz)
function calcBandDbAtFreq(
  f: number,
  f0: number,
  gainDb: number,
  qIdx: number,
  bandKey: BandKey
): number {
  const ratio = f / f0;
  if (ratio <= 0) return 0;

  // HPF (qIdx === 42 on Low)
  if (bandKey === 'low' && qIdx === 42) {
    const order = Math.pow(f0 / f, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }
  // LPF (qIdx === 42 on High)
  if (bandKey === 'high' && qIdx === 42) {
    const order = Math.pow(f / f0, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }

  if (Math.abs(gainDb) < 0.05) return 0;

  // Low Shelf (qIdx === 41 on Low)
  if (bandKey === 'low' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(3.2 * x));
    return gainDb * s;
  }

  // High Shelf (qIdx === 41 on High)
  if (bandKey === 'high' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(-3.2 * x));
    return gainDb * s;
  }

  // Standard Parametric Bell (Peaking EQ)
  const Q = eqIndexToQValue(qIdx);
  const logRatio = Math.log2(ratio);
  const bw = 1 / Math.max(0.15, Q * 0.85);
  return gainDb * Math.exp(-Math.pow(logRatio / bw, 2));
}

export const InteractiveEQ: React.FC<InteractiveEQProps> = ({ eq, onChange }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingBand, setDraggingBand] = useState<BandKey | null>(null);
  const [selectedBand, setSelectedBand] = useState<BandKey>('lowMid');

  const width = 680;
  const height = 230;
  const padX = 38;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const freqToX = (hz: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const norm = (Math.log10(Math.max(20, Math.min(20000, hz))) - minLog) / (maxLog - minLog);
    return padX + norm * plotW;
  };

  const xToFreq = (x: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const norm = Math.max(0, Math.min(1, (x - padX) / plotW));
    return Math.pow(10, minLog + norm * (maxLog - minLog));
  };

  const dbToY = (db: number) => {
    const clamped = Math.max(-18, Math.min(18, db));
    const norm = (18 - clamped) / 36;
    return padY + norm * plotH;
  };

  const yToGainRaw = (y: number) => {
    const norm = Math.max(0, Math.min(1, (y - padY) / plotH));
    const db = 18 - norm * 36;
    return Math.round(db * 10); // -180..+180
  };

  useEffect(() => {
    if (!draggingBand) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;

      const newFreqIdx = freqHzToEqIndex(xToFreq(svgX));
      const newGainRaw = yToGainRaw(svgY);

      const cfg = BAND_CONFIG.find((b) => b.key === draggingBand)!;
      onChange(cfg.fParam, newFreqIdx);
      onChange(cfg.gParam, newGainRaw);
    };

    const handlePointerUp = () => {
      setDraggingBand(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingBand, onChange]);

  // Generate combined EQ curve points
  const numSamples = 140;
  const combinedPoints: string[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const x = padX + (i / numSamples) * plotW;
    const f = xToFreq(x);
    let totalDb = 0;
    if (eq.on) {
      for (const b of BAND_CONFIG) {
        const state = eq[b.key];
        const f0 = eqIndexToFreqHz(state.freq);
        totalDb += calcBandDbAtFreq(f, f0, state.gain / 10, state.q, b.key);
      }
    }
    const y = dbToY(totalDb);
    combinedPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const zeroY = dbToY(0);
  const fillPath = `M ${padX},${zeroY} L ${combinedPoints.join(' L ')} L ${padX + plotW},${zeroY} Z`;
  const linePath = `M ${combinedPoints.join(' L ')}`;

  const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gridDbs = [-18, -12, -6, 0, 6, 12, 18];

  return (
    <div className="flex flex-col gap-3 bg-[#0d1118] border border-slate-800/80 rounded-xl p-3.5 shadow-inner">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onChange('on', !eq.on)}
            className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
              eq.on
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            EQ {eq.on ? 'IN (ON)' : 'BYPASS'}
          </button>

          <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800">
            <button
              onClick={() => onChange('mode', 0)}
              className={`px-2.5 py-0.5 text-[11px] font-mono rounded cursor-pointer transition ${
                eq.mode === 0 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              TYPE I
            </button>
            <button
              onClick={() => onChange('mode', 1)}
              className={`px-2.5 py-0.5 text-[11px] font-mono rounded cursor-pointer transition ${
                eq.mode === 1 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              TYPE II
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onChange('lowG', 0);
              onChange('lowMidG', 0);
              onChange('hiMidG', 0);
              onChange('highG', 0);
            }}
            className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
          >
            FLAT 0dB
          </button>
        </div>
      </div>

      {/* Interactive SVG Frequency Response Curve */}
      <div className="relative w-full overflow-hidden rounded-lg border border-slate-800/90 bg-[#070a0f]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto touch-none select-none"
          onWheel={(e) => {
            e.preventDefault();
            const cfg = BAND_CONFIG.find((b) => b.key === selectedBand)!;
            const curQ = eq[selectedBand].q;
            const delta = e.deltaY < 0 ? 1 : -1;
            const maxQ = selectedBand === 'low' || selectedBand === 'high' ? 42 : 40;
            const nextQ = Math.max(0, Math.min(maxQ, curQ + delta));
            onChange(cfg.qParam, nextQ);
          }}
        >
          {/* Horizontal dB Grid Lines */}
          {gridDbs.map((db) => {
            const y = dbToY(db);
            return (
              <g key={`db-${db}`}>
                <line
                  x1={padX}
                  y1={y}
                  x2={padX + plotW}
                  y2={y}
                  stroke={db === 0 ? '#334155' : '#161f2e'}
                  strokeWidth={db === 0 ? 1.5 : 1}
                  strokeDasharray={db === 0 ? undefined : '3 3'}
                />
                <text
                  x={padX - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[9px] font-mono"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            );
          })}

          {/* Vertical Frequency Grid Lines */}
          {gridFreqs.map((f) => {
            const x = freqToX(f);
            const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
            return (
              <g key={`f-${f}`}>
                <line
                  x1={x}
                  y1={padY}
                  x2={x}
                  y2={padY + plotH}
                  stroke="#161f2e"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] font-mono"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Composite EQ Fill & Curve */}
          <path
            d={fillPath}
            fill={eq.on ? 'rgba(6, 182, 212, 0.14)' : 'rgba(100, 116, 139, 0.05)'}
          />
          <path
            d={linePath}
            fill="none"
            stroke={eq.on ? '#22d3ee' : '#475569'}
            strokeWidth={2.5}
          />

          {/* Draggable Band Handles */}
          {BAND_CONFIG.map((b) => {
            const state = eq[b.key];
            const fHz = eqIndexToFreqHz(state.freq);
            const cx = freqToX(fHz);
            const cy = dbToY(state.gain / 10);
            const isSel = selectedBand === b.key;

            return (
              <g
                key={b.key}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedBand(b.key);
                  setDraggingBand(b.key);
                }}
              >
                {isSel && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={14}
                    fill={b.color}
                    fillOpacity={0.2}
                    stroke={b.color}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill={b.color}
                  stroke="#090d14"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  fill={b.color}
                  className="text-[10px] font-mono font-bold pointer-events-none"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 4 Band Parameter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {BAND_CONFIG.map((b) => {
          const state = eq[b.key];
          const hz = eqIndexToFreqHz(state.freq);
          const gainDb = (state.gain / 10).toFixed(1);
          const maxQ = b.key === 'low' || b.key === 'high' ? 42 : 40;

          return (
            <div
              key={b.key}
              onClick={() => setSelectedBand(b.key)}
              className={`rounded-lg p-2.5 border transition cursor-pointer ${
                selectedBand === b.key
                  ? 'bg-slate-900/95 border-slate-600 shadow-md'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono" style={{ color: b.color }}>
                  ● {b.label}
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {Number(gainDb) > 0 ? `+${gainDb}` : gainDb} dB
                </span>
              </div>

              {/* Gain Slider */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                  <span>GAIN</span>
                  <span>{gainDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={state.gain}
                  onChange={(e) => onChange(b.gParam, Number(e.target.value))}
                  onDoubleClick={() => onChange(b.gParam, 0)}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Frequency Slider */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                  <span>FREQ</span>
                  <span className="text-slate-200">{formatFreqHz(hz)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={119}
                  value={state.freq}
                  onChange={(e) => onChange(b.fParam, Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Q / Filter Mode Slider */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                  <span>Q / MODE</span>
                  <span className="text-cyan-300">{formatEqQ(state.q, b.key)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxQ}
                  value={state.q}
                  onChange={(e) => onChange(b.qParam, Number(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
