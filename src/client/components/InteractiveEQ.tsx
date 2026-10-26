import React, { useEffect, useRef, useState } from 'react';
import {
  eqIndexToFreqHz,
  eqIndexToQValue,
  formatEqQ,
  formatFreqHz,
  freqHzToEqIndex,
} from '../../shared/converters';
import { ChannelEQState, ControlMode } from '../../shared/types';
import { InOutMeterBridge } from './InOutMeterBridge';
import { RotaryKnob } from './RotaryKnob';

interface InteractiveEQProps {
  eq: ChannelEQState;
  savedEq?: ChannelEQState;
  controlMode?: ControlMode;
  meterIn?: number;
  meterOut?: number;
  grDb?: number;
  compact?: boolean;
  graphOnly?: boolean;
  onChange: (param: string, value: number | boolean) => void;
}

export type BandKey = 'low' | 'lowMid' | 'hiMid' | 'high';

export const BAND_CONFIG: {
  key: BandKey;
  label: string;
  color: string;
  fill: string;
  qParam: string;
  fParam: string;
  gParam: string;
  defaultQ: number;
  defaultF: number;
  defaultG: number;
}[] = [
  {
    key: 'low',
    label: 'LOW',
    color: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.16)',
    qParam: 'lowQ',
    fParam: 'lowF',
    gParam: 'lowG',
    defaultQ: 41,
    defaultF: 36,
    defaultG: 0,
  },
  {
    key: 'lowMid',
    label: 'LO-MID',
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.16)',
    qParam: 'lowMidQ',
    fParam: 'lowMidF',
    gParam: 'lowMidG',
    defaultQ: 23,
    defaultF: 65,
    defaultG: 0,
  },
  {
    key: 'hiMid',
    label: 'HI-MID',
    color: '#10b981',
    fill: 'rgba(16, 185, 129, 0.16)',
    qParam: 'hiMidQ',
    fParam: 'hiMidF',
    gParam: 'hiMidG',
    defaultQ: 23,
    defaultF: 92,
    defaultG: 0,
  },
  {
    key: 'high',
    label: 'HIGH',
    color: '#06b6d4',
    fill: 'rgba(6, 182, 212, 0.16)',
    qParam: 'highQ',
    fParam: 'highF',
    gParam: 'highG',
    defaultQ: 42,
    defaultF: 112,
    defaultG: 0,
  },
];

// Compute biquad magnitude in dB at frequency f (Hz)
export function calcBandDbAtFreq(
  f: number,
  f0: number,
  gainDb: number,
  qIdx: number,
  bandKey: BandKey,
  _lpfOn = false,
  hpfOn = false
): number {
  const ratio = f / f0;
  if (ratio <= 0) return 0;

  if (bandKey === 'low' && (qIdx === 42 || (hpfOn && qIdx > 41))) {
    const order = Math.pow(f0 / f, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }
  if (bandKey === 'high' && qIdx === 43) {
    const order = Math.pow(f / f0, 4);
    return Math.max(-24, -10 * Math.log10(1 + order));
  }

  if (Math.abs(gainDb) < 0.05) return 0;

  if (bandKey === 'low' && qIdx === 41) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(3.2 * x));
    return gainDb * s;
  }

  if (bandKey === 'high' && (qIdx === 41 || qIdx === 42)) {
    const x = Math.log2(ratio);
    const s = 1 / (1 + Math.exp(-3.2 * x));
    return gainDb * s;
  }

  const Q = eqIndexToQValue(qIdx);
  const logRatio = Math.log2(ratio);
  const bw = 1 / Math.max(0.15, Q * 0.85);
  return gainDb * Math.exp(-Math.pow(logRatio / bw, 2));
}

/**
 * Restores the scene's memorized value (`saved`) on double-click, or `factoryDefault` if Shift/Alt is held or no saved value exists.
 */
export function resolveResetValue(
  _current: number,
  saved: number | undefined,
  factoryDefault: number,
  forceFactoryDefault = false
): number {
  if (!forceFactoryDefault && saved !== undefined) {
    return saved;
  }
  return factoryDefault;
}

export const InteractiveEQ: React.FC<InteractiveEQProps> = ({
  eq,
  savedEq,
  controlMode = 'knobs',
  meterIn = 0,
  meterOut = 0,
  grDb = 0,
  compact = false,
  graphOnly = false,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingBand, setDraggingBand] = useState<BandKey | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [selectedBand, setSelectedBand] = useState<BandKey>('lowMid');

  const width = 480;
  const height = compact ? 116 : 140;
  const padX = 26;
  const padY = 12;
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
      if (!svgRef.current || !dragOriginRef.current) return;
      const dist = Math.hypot(
        e.clientX - dragOriginRef.current.x,
        e.clientY - dragOriginRef.current.y
      );
      if (!dragOriginRef.current.moved && dist < 3) {
        return;
      }
      dragOriginRef.current.moved = true;

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
      dragOriginRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingBand, height, onChange]);

  const numSamples = 135;
  const combinedPoints: string[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const x = padX + (i / numSamples) * plotW;
    const f = xToFreq(x);
    let eqDb = 0;
    if (eq.on) {
      for (const b of BAND_CONFIG) {
        const state = eq[b.key];
        const f0 = eqIndexToFreqHz(state.freq);
        eqDb += calcBandDbAtFreq(f, f0, state.gain / 10, state.q, b.key, eq.lpfOn, eq.hpfOn);
      }
    }
    const y = dbToY(eqDb);
    combinedPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const zeroY = dbToY(0);
  const fillPath = `M ${padX},${zeroY} L ${combinedPoints.join(' L ')} L ${padX + plotW},${zeroY} Z`;
  const linePath = `M ${combinedPoints.join(' L ')}`;

  const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gridDbs = [-18, -12, -6, 0, 6, 12, 18];

  const handleBarWheel = (
    e: React.WheelEvent,
    param: string,
    currentVal: number,
    min: number,
    max: number,
    step = 1
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const dir = e.deltaY < 0 ? 1 : -1;
    const next = Math.max(min, Math.min(max, currentVal + dir * step));
    if (next !== currentVal) {
      onChange(param, next);
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-[#0d1118] border border-slate-800/80 rounded-xl p-2.5 shadow-inner">
      {/* Header Toolbar + Live IN/OUT Signal Bridge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onChange('on', !eq.on)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
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

          {savedEq && (
            <button
              onClick={() => {
                for (const b of BAND_CONFIG) {
                  const sb = savedEq[b.key];
                  onChange(b.gParam, sb.gain);
                  onChange(b.fParam, sb.freq);
                  onChange(b.qParam, sb.q);
                }
              }}
              title="Ripristina tutte le 4 bande ai valori memorizzati nella scena"
              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-mono border border-amber-500/30 cursor-pointer"
            >
              ↺ SCENE EQ
            </button>
          )}

          <button
            onClick={() => {
              onChange('lowG', 0);
              onChange('lowMidG', 0);
              onChange('hiMidG', 0);
              onChange('highG', 0);
            }}
            className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 cursor-pointer"
          >
            FLAT 0dB
          </button>
        </div>

        {/* Live IN/OUT Meter Bridge (only if not graphOnly) */}
        {!graphOnly && (
          <InOutMeterBridge meterIn={meterIn} meterOut={meterOut} grDb={grDb} compact />
        )}
      </div>

      {/* SIDE-BY-SIDE LAYOUT: Left = SVG Filter Curve, Right = 4 Band Parameter Cards (or Graph Only) */}
      <div
        className={
          graphOnly
            ? 'w-full flex flex-col items-stretch'
            : 'grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch'
        }
      >
        {/* Interactive SVG Frequency Response Curve */}
        <div
          className={`${
            graphOnly ? 'w-full' : 'lg:col-span-5'
          } relative overflow-hidden rounded-lg border border-slate-800/90 bg-[#070a0f] flex items-center`}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto touch-none select-none"
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
                    x={padX - 5}
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
                    y={height - 3}
                    textAnchor="middle"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

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

            {/* Draggable Band Handles (Double-click restores scene Gain & Freq!) */}
            {BAND_CONFIG.map((b) => {
              const state = eq[b.key];
              const savedBand = savedEq?.[b.key];
              const fHz = eqIndexToFreqHz(state.freq);
              const cx = freqToX(fHz);
              const cy = dbToY(state.gain / 10);
              const isSel = selectedBand === b.key;

              const hasSavedDiff =
                savedBand !== undefined &&
                (savedBand.gain !== state.gain || savedBand.freq !== state.freq);
              const savedCx = savedBand ? freqToX(eqIndexToFreqHz(savedBand.freq)) : cx;
              const savedCy = savedBand ? dbToY(savedBand.gain / 10) : cy;

              return (
                <g key={b.key}>
                  {/* Ghost Ring showing the Scene's Memorized Position when moved */}
                  {hasSavedDiff && (
                    <circle
                      cx={savedCx}
                      cy={savedCy}
                      r={5.5}
                      fill="none"
                      stroke={b.color}
                      strokeOpacity={0.55}
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                    />
                  )}

                  <g
                    className="cursor-grab active:cursor-grabbing"
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedBand(b.key);
                      const dir = e.deltaY < 0 ? 1 : -1;
                      const maxQ = b.key === 'high' ? 43 : b.key === 'low' ? 42 : 40;
                      const nextQ = Math.max(0, Math.min(maxQ, state.q + dir));
                      if (nextQ !== state.q) {
                        onChange(b.qParam, nextQ);
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedBand(b.key);
                      dragOriginRef.current = { x: e.clientX, y: e.clientY, moved: false };
                      setDraggingBand(b.key);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const forceDefault = e.shiftKey || e.altKey;
                      onChange(
                        b.gParam,
                        resolveResetValue(state.gain, savedBand?.gain, b.defaultG, forceDefault)
                      );
                      onChange(
                        b.fParam,
                        resolveResetValue(state.freq, savedBand?.freq, b.defaultF, forceDefault)
                      );
                    }}
                  >
                    <title>{`Banda ${b.label}: Trascina = Gain/Freq | Rotella = Q (${formatEqQ(state.q, b.key)}) | Doppio click = Reset`}</title>
                    {isSel && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={13}
                        fill={b.color}
                        fillOpacity={0.22}
                        stroke={b.color}
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={b.color}
                      stroke="#090d14"
                      strokeWidth={2}
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      fill={b.color}
                      className="text-[9px] font-mono font-bold pointer-events-none"
                    >
                      {b.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 4 Band Parameter Cards: Either Rotary Potentiometers (Knobs) or Linear Sliders */}
        {!graphOnly && (
          <div
            className={`lg:col-span-7 grid ${
              compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
            } gap-2 content-between`}
          >
          {BAND_CONFIG.map((b) => {
            const state = eq[b.key];
            const savedBand = savedEq?.[b.key];
            const hz = eqIndexToFreqHz(state.freq);
            const gainDb = (state.gain / 10).toFixed(1);
            const maxQ = b.key === 'high' ? 43 : b.key === 'low' ? 42 : 40;
            const qLabel = formatEqQ(state.q, b.key);

            const resetGain = (e?: React.MouseEvent) => {
              e?.stopPropagation();
              onChange(
                b.gParam,
                resolveResetValue(
                  state.gain,
                  savedBand?.gain,
                  b.defaultG,
                  Boolean(e?.shiftKey || e?.altKey)
                )
              );
            };
            const resetFreq = (e?: React.MouseEvent) => {
              e?.stopPropagation();
              onChange(
                b.fParam,
                resolveResetValue(
                  state.freq,
                  savedBand?.freq,
                  b.defaultF,
                  Boolean(e?.shiftKey || e?.altKey)
                )
              );
            };
            const resetQ = (e?: React.MouseEvent) => {
              e?.stopPropagation();
              onChange(
                b.qParam,
                resolveResetValue(
                  state.q,
                  savedBand?.q,
                  b.defaultQ,
                  Boolean(e?.shiftKey || e?.altKey)
                )
              );
            };

            return (
              <div
                key={b.key}
                onClick={() => setSelectedBand(b.key)}
                className={`rounded-lg p-2 border transition cursor-pointer flex flex-col justify-between ${
                  selectedBand === b.key
                    ? 'bg-slate-900/95 border-slate-600 shadow-md'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold font-mono" style={{ color: b.color }}>
                    ● {b.label}
                  </span>
                  <span
                    onDoubleClick={resetGain}
                    title={
                      savedBand !== undefined
                        ? `Doppio click: ripristina valore scena (${(savedBand.gain / 10).toFixed(1)} dB) · Shift+Doppio click: 0.0 dB`
                        : 'Doppio click: ripristina 0.0 dB'
                    }
                    className={`text-[10px] font-mono px-1 py-0.5 rounded border cursor-pointer ${
                      savedBand !== undefined && savedBand.gain !== state.gain
                        ? 'bg-slate-950 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {Number(gainDb) > 0 ? `+${gainDb}` : gainDb}dB
                  </span>
                </div>

                {controlMode === 'knobs' ? (
                  /* ROTARY POTENTIOMETERS MODE (3 Knobs per Band: GAIN, FREQ, Q) */
                  <div className="grid grid-cols-3 gap-1 items-center py-1">
                    <RotaryKnob
                      label="GAIN"
                      value={state.gain}
                      min={-180}
                      max={180}
                      step={5}
                      savedValue={savedBand?.gain}
                      defaultValue={b.defaultG}
                      displayValue={`${Number(gainDb) > 0 ? `+${gainDb}` : gainDb}`}
                      color={b.color}
                      size={compact ? 42 : 46}
                      bipolar
                      onChange={(val) => onChange(b.gParam, val)}
                    />
                    <RotaryKnob
                      label="FREQ"
                      value={state.freq}
                      min={0}
                      max={119}
                      step={1}
                      savedValue={savedBand?.freq}
                      defaultValue={b.defaultF}
                      displayValue={formatFreqHz(hz)}
                      color="#f59e0b"
                      size={compact ? 42 : 46}
                      onChange={(val) => onChange(b.fParam, val)}
                    />
                    <RotaryKnob
                      label="Q"
                      value={state.q}
                      min={0}
                      max={maxQ}
                      step={1}
                      savedValue={savedBand?.q}
                      defaultValue={b.defaultQ}
                      displayValue={qLabel}
                      color="#10b981"
                      size={compact ? 42 : 46}
                      onChange={(val) => onChange(b.qParam, val)}
                    />
                  </div>
                ) : (
                  /* LINEAR SLIDERS MODE */
                  <>
                    {/* Gain Slider */}
                    <div
                      className="mb-1"
                      onWheel={(e) => handleBarWheel(e, b.gParam, state.gain, -180, 180, 5)}
                      onDoubleClick={resetGain}
                      title="Rotella mouse per regolare, doppio click per ripristinare valore scena"
                    >
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>GAIN</span>
                        <span className="hover:text-cyan-300">{gainDb}dB</span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        value={state.gain}
                        onChange={(e) => onChange(b.gParam, Number(e.target.value))}
                        className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Frequency Slider */}
                    <div
                      className="mb-1"
                      onWheel={(e) => handleBarWheel(e, b.fParam, state.freq, 0, 119, 1)}
                      onDoubleClick={resetFreq}
                      title="Rotella mouse per regolare, doppio click per ripristinare valore scena"
                    >
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>FREQ</span>
                        <span className="text-slate-200 hover:text-amber-300">
                          {formatFreqHz(hz)}
                        </span>
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
                    <div
                      onWheel={(e) => handleBarWheel(e, b.qParam, state.q, 0, maxQ, 1)}
                      onDoubleClick={resetQ}
                      title="Rotella mouse per regolare, doppio click per ripristinare valore scena"
                    >
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mb-0.5">
                        <span>Q</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChange(b.qParam, Math.max(0, state.q - 1));
                            }}
                            className="px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-cyan-300 min-w-[34px] text-center hover:underline">
                            {qLabel}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChange(b.qParam, Math.min(maxQ, state.q + 1));
                            }}
                            className="px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
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
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
