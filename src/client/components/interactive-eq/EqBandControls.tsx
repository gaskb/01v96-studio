import React from 'react';
import {
  eqIndexToFreqHz,
  formatEqQ,
  formatFreqHz,
} from '../../../shared/converters';
import { ChannelEQState, ControlMode } from '../../../shared/types';
import { RotaryKnob } from '../RotaryKnob';
import { BAND_CONFIG, BandKey, resolveResetValue } from './eqMath';

interface EqBandControlsProps {
  eq: ChannelEQState;
  savedEq?: ChannelEQState;
  controlMode: ControlMode;
  compact?: boolean;
  selectedBand: BandKey;
  onSelectBand: (band: BandKey) => void;
  onChange: (param: string, value: number | boolean) => void;
}

export const EqBandControls: React.FC<EqBandControlsProps> = ({
  eq,
  savedEq,
  controlMode,
  compact = false,
  selectedBand,
  onSelectBand,
  onChange,
}) => {
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
            onClick={() => onSelectBand(b.key)}
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
  );
};
