import React, { useState } from 'react';
import { ChannelEQState, ControlMode } from '../../shared/types';
import { InOutMeterBridge } from './InOutMeterBridge';
import { EqBandControls } from './interactive-eq/EqBandControls';
import { EqCurveGraph } from './interactive-eq/EqCurveGraph';
import {
  BAND_CONFIG,
  BandKey,
  calcBandDbAtFreq,
  resolveResetValue,
} from './interactive-eq/eqMath';

// Backwards-compatible re-exports for external consumers and tests
export { BAND_CONFIG, calcBandDbAtFreq, resolveResetValue };
export type { BandKey };

export interface InteractiveEQProps {
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
  const [selectedBand, setSelectedBand] = useState<BandKey>('lowMid');

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
        <EqCurveGraph
          eq={eq}
          savedEq={savedEq}
          compact={compact}
          graphOnly={graphOnly}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onChange={onChange}
        />

        {!graphOnly && (
          <EqBandControls
            eq={eq}
            savedEq={savedEq}
            controlMode={controlMode}
            compact={compact}
            selectedBand={selectedBand}
            onSelectBand={setSelectedBand}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
};
