import React, { useEffect, useRef, useState } from 'react';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  formatEqQ,
  formatFreqHz,
  freqHzToEqIndex,
} from '../../shared/converters';
import { ChannelEQState } from '../../shared/types';
import { InOutMeterBridge } from './InOutMeterBridge';

interface InteractiveEQProps {
  eq: ChannelEQState;
  meterIn?: number;
  meterOut?: number;
  grDb?: number;
  compact?: boolean;
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
export function calcBandDbAtFreq(
  f: number,
  f0: number,
  gainDb: number,
  qIdx: number,
  bandKey: BandKey
): number {
  const ratio = f / f0;
  if (ratio <= 0) return 0;

  if (bandKey === 'low' && qIdx === 42) {
    const order = Math.pow(f0 / f, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }
  if (bandKey === 'high' && qIdx === 42) {
    const order = Math.pow(f / f0, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }

  if (Math.abs(gainDb) < 0.05) return 0;

  if (bandKey === 'low' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(3.2 * x));
    return gainDb * s;
  }

  if (bandKey === 'high' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(-3.2 * x));
    return gainDb * s;
  }

  const Q = eqIndexToQValue(qIdx);
  const logRatio = Math.log2(ratio);
  const bw = 1 / Math.max(0.15, Q * 0.85);
  return gainDb * Math.exp(-Math.pow(logRatio / bw, 2));
}

export const InteractiveEQ: React.FC<InteractiveEQProps> = ({
  eq,
  meterIn = 0,
  meterOut = 0,
  grDb = 0,
  compact = false,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingBand, setDraggingBand] = useState<BandKey | null>(null);
  const [selectedBand, setSelectedBand] = useState<BandKey>('lowMid');
  const [phaseTick, setPhaseTick] = useState(0);

  // Animate real-time Pre-EQ / Post-EQ RTA Spectrum Shimmer when audio is present
  useEffect(() => {
    if (meterIn <= 2 && meterOut <= 2) return;
    const id = setInterval(() => {
      setPhaseTick((t) => (t + 1) % 360);
    }, 60);
    return () => clearInterval(id);
  }, [meterIn, meterOut]);

  const width = 680;
  const height = compact ? 185 : 225;
  const padX = 38;
  const padY = 18;
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
    return Math.round(db * 10);
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
  }, [draggingBand, height, onChange]);

  const numSamples = 120;
  const combinedPoints: string[] = [];
  const rtaInPoints: string[] = [];
  const rtaOutPoints: string[] = [];

  const inNorm = meterIn / 255;
  const outNorm = meterOut / 255;
  const bottomY = padY + plotH;

  for (let i = 0; i <= numSamples; i++) {
    const x = padX + (i / numSamples) * plotW;
    const f = xToFreq(x);
    let eqDb = 0;
    if (eq.on) {
      for (const b of BAND_CONFIG) {
        const state = eq[b.key];
        const f0 = eqIndexToFreqHz(state.freq);
        eqDb += calcBandDbAtFreq(f, f0, state.gain / 10, state.q, b.key);
      }
    }
    const y = dbToY(eqDb);
    combinedPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);

    // FabFilter Pro-Q style Dual RTA Envelope (Pre-EQ IN vs Post-EQ OUT)
    if (inNorm > 0.01 || outNorm > 0.01) {
      // Natural pink-noise spectral shape + live organic harmonic movement
      const freqTilt = Math.sin((i / numSamples) * Math.PI * 0.92);
      const ripple =
        Math.sin(i * 0.25 + phaseTick * 0.35) * 0.08 +
        Math.cos(i * 0.6 - phaseTick * 0.5) * 0.05;

      const inHeightRatio = Math.max(0.02, Math.min(0.95, inNorm * (0.55 + 0.35 * freqTilt + ripple)));
      const inY = bottomY - inHeightRatio * plotH * 0.85;
      rtaInPoints.push(`${x.toFixed(1)},${inY.toFixed(1)}`);

      // Post-EQ OUT spectrum is shaped directly by the active EQ curve (eqDb) + output level!
      const eqFactor = eq.on ? (eqDb / 18) * 0.42 : 0;
      const outHeightRatio = Math.max(
        0.02,
        Math.min(0.98, outNorm * (0.55 + 0.35 * freqTilt + ripple) + eqFactor)
      );
      const outY = bottomY - outHeightRatio * plotH * 0.85;
      rtaOutPoints.push(`${x.toFixed(1)},${outY.toFixed(1)}`);
    }
  }

  const zeroY = dbToY(0);
  const fillPath = `M ${padX},${zeroY} L ${combinedPoints.join(' L ')} L ${padX + plotW},${zeroY} Z`;
  const linePath = `M ${combinedPoints.join(' L ')}`;

  const rtaInPath =
    rtaInPoints.length > 0
      ? `M ${padX},${bottomY} L ${rtaInPoints.join(' L ')} L ${padX + plotW},${bottomY} Z`
      : '';
  const rtaOutPath =
    rtaOutPoints.length > 0
      ? `M ${padX},${bottomY} L ${rtaOutPoints.join(' L ')} L ${padX + plotW},${bottomY} Z`
      : '';

  const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gridDbs = [-18, -12, -6, 0, 6, 12, 18];

  return (
    <div className="flex flex-col gap-2.5 bg-[#0d1118] border border-slate-800/80 rounded-xl p-3 shadow-inner">
      {/* Header Toolbar + Live IN/OUT Signal Bridge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange('on', !eq.on)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
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
              className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition ${
                eq.mode === 0 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              TYPE I
            </button>
            <button
              onClick={() => onChange('mode', 1)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition ${
                eq.mode === 1 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              TYPE II
            </button>
          </div>

          <button
            onClick={() => {
              onChange('lowG', 0);
              onChange('lowMidG', 0);
              onChange('hiMidG', 0);
              onChange('highG', 0);
            }}
            className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 cursor-pointer"
          >
            FLAT 0dB
          </button>
        </div>

        {/* Dual Spectrum Legend + Live IN/OUT Meter Bridge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2.5 h-2 rounded-xs bg-sky-400/40 border border-sky-400 inline-block" />
              PRE-EQ IN
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2 rounded-xs bg-emerald-400/40 border border-emerald-400 inline-block" />
              POST-EQ OUT
            </span>
          </div>
          <InOutMeterBridge meterIn={meterIn} meterOut={meterOut} grDb={grDb} compact />
        </div>
      </div>

      {/* Interactive SVG Frequency Response Curve + Dual RTA Overlay */}
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
          <defs>
            <linearGradient id="rtaInGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="rtaOutGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.06" />
            </linearGradient>
          </defs>

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
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] font-mono"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Live Dual Spectrum: Shade 1 = PRE-EQ INPUT (Sky Blue) */}
          {rtaInPath && (
            <path
              d={rtaInPath}
              fill="url(#rtaInGrad)"
              stroke="#38bdf8"
              strokeOpacity="0.5"
              strokeWidth={1}
            />
          )}

          {/* Live Dual Spectrum: Shade 2 = POST-EQ OUTPUT (Emerald/Cyan) */}
          {rtaOutPath && (
            <path
              d={rtaOutPath}
              fill="url(#rtaOutGrad)"
              stroke="#34d399"
              strokeOpacity="0.75"
              strokeWidth={1.2}
            />
          )}

          {/* Composite EQ Filter Fill & Curve */}
          <path
            d={fillPath}
            fill={eq.on ? 'rgba(6, 182, 212, 0.15)' : 'rgba(100, 116, 139, 0.05)'}
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
                  r={7.5}
                  fill={b.color}
                  stroke="#090d14"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={cy - 11}
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
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'} gap-2`}>
        {BAND_CONFIG.map((b) => {
          const state = eq[b.key];
          const hz = eqIndexToFreqHz(state.freq);
          const gainDb = (state.gain / 10).toFixed(1);
          const maxQ = b.key === 'low' || b.key === 'high' ? 42 : 40;

          return (
            <div
              key={b.key}
              onClick={() => setSelectedBand(b.key)}
              className={`rounded-lg p-2 border transition cursor-pointer ${
                selectedBand === b.key
                  ? 'bg-slate-900/95 border-slate-600 shadow-md'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold font-mono" style={{ color: b.color }}>
                  ● {b.label}
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {Number(gainDb) > 0 ? `+${gainDb}` : gainDb} dB
                </span>
              </div>

              {/* Gain Slider */}
              <div className="mb-1.5">
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
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
              <div className="mb-1.5">
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
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
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
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
