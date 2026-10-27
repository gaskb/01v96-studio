import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  eqIndexToFreqHz,
  formatEqQ,
  freqHzToEqIndex,
} from '../../../shared/converters';
import { ChannelEQState } from '../../../shared/types';
import { BAND_CONFIG, BandKey, calcBandDbAtFreq, resolveResetValue } from './eqMath';

interface EqCurveGraphProps {
  eq: ChannelEQState;
  savedEq?: ChannelEQState;
  compact?: boolean;
  graphOnly?: boolean;
  selectedBand: BandKey;
  onSelectBand: (band: BandKey) => void;
  onChange: (param: string, value: number | boolean) => void;
}

export const EqCurveGraph: React.FC<EqCurveGraphProps> = ({
  eq,
  savedEq,
  compact = false,
  graphOnly = false,
  selectedBand,
  onSelectBand,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingBand, setDraggingBand] = useState<BandKey | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

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

  const { fillPath, linePath } = useMemo(() => {
    const numSamples = 135;
    const points: string[] = [];

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
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    const zeroY = dbToY(0);
    const fill = `M ${padX},${zeroY} L ${points.join(' L ')} L ${padX + plotW},${zeroY} Z`;
    const line = `M ${points.join(' L ')}`;
    return { fillPath: fill, linePath: line };
  }, [
    eq.on,
    eq.lpfOn,
    eq.hpfOn,
    eq.low.freq,
    eq.low.gain,
    eq.low.q,
    eq.lowMid.freq,
    eq.lowMid.gain,
    eq.lowMid.q,
    eq.hiMid.freq,
    eq.hiMid.gain,
    eq.hiMid.q,
    eq.high.freq,
    eq.high.gain,
    eq.high.q,
    plotW,
    padX,
    height,
  ]);

  const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gridDbs = [-18, -12, -6, 0, 6, 12, 18];

  return (
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

        {/* Draggable Band Handles */}
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
              {/* Ghost Ring showing Scene Memorized Position */}
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
                  onSelectBand(b.key);
                  const dir = e.deltaY < 0 ? 1 : -1;
                  const maxQ = b.key === 'high' ? 43 : b.key === 'low' ? 42 : 40;
                  const nextQ = Math.max(0, Math.min(maxQ, state.q + dir));
                  if (nextQ !== state.q) {
                    onChange(b.qParam, nextQ);
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectBand(b.key);
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
  );
};
