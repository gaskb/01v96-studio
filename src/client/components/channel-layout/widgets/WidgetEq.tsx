import React from 'react';
import {
  eqIndexToFreqHz,
  formatEqQ,
  formatFreqHz,
} from '../../../../shared/converters';
import { BAND_CONFIG, InteractiveEQ } from '../../InteractiveEQ';
import { RotaryKnob } from '../../RotaryKnob';
import { WidgetCommonProps, WidgetEqSingleBandProps } from './WidgetTypes';

/**
 * 2. Spectrum Analyzer & Frequency Response Curve (Compact & Sleek)
 */
export const WidgetEqGraph: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  controlMode,
  sendCommand,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col h-full justify-between select-none">
      <InteractiveEQ
        eq={ch.eq}
        savedEq={savedCh?.eq}
        controlMode={controlMode}
        meterIn={ch.meterIn}
        meterOut={ch.meterOut}
        grDb={ch.grDb}
        compact={true}
        graphOnly={true}
        onChange={(param, value) =>
          sendCommand({ type: 'set_eq', target: 'ch', id: ch.id, param, value })
        }
      />
    </div>
  );
};

/**
 * 4. 4-Band Parametric EQ Stack (Vertical, Legible & Balanced)
 */
export const WidgetEqBands: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
}) => {
  const orderedBands = [...BAND_CONFIG].reverse();

  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col gap-1.5 justify-between h-full shadow-sm select-none">
      <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-0.5">
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        <span className="text-[10px] font-mono font-bold text-purple-400">
          4-BAND EQ (CH {ch.id})
        </span>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 justify-between">
        {orderedBands.map((b) => {
          const state = ch.eq[b.key];
          const savedBand = savedCh?.eq[b.key];
          const hz = eqIndexToFreqHz(state.freq);
          const gainDb = (state.gain / 10).toFixed(1);
          const maxQ = b.key === 'high' ? 43 : b.key === 'low' ? 42 : 40;
          const qLabel = formatEqQ(state.q, b.key);

          return (
            <div
              key={b.key}
              className="bg-[#05080e] border border-slate-850 rounded p-1 flex flex-col justify-between"
            >
              {/* Band Title Bar with dot & dB */}
              <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-0.5 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                  <span
                    className="text-[10px] font-mono font-bold tracking-tight"
                    style={{ color: b.color }}
                  >
                    {b.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono font-bold text-slate-200">
                  {Number(gainDb) > 0 ? `+${gainDb}` : gainDb} dB
                </span>
              </div>

              {/* 3 Knobs with size={36} */}
              <div className="flex items-center justify-around gap-1.5 px-0.5 py-0.5">
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
                  size={36}
                  bipolar
                  onChange={(val) =>
                    sendCommand({
                      type: 'set_eq',
                      target: 'ch',
                      id: ch.id,
                      param: b.gParam,
                      value: val,
                    })
                  }
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
                  color={b.color}
                  size={36}
                  onChange={(val) =>
                    sendCommand({
                      type: 'set_eq',
                      target: 'ch',
                      id: ch.id,
                      param: b.fParam,
                      value: val,
                    })
                  }
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
                  color={b.color}
                  size={36}
                  onChange={(val) =>
                    sendCommand({
                      type: 'set_eq',
                      target: 'ch',
                      id: ch.id,
                      param: b.qParam,
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 4a. Single Band Parametric EQ Widget (Height 1)
 */
export const WidgetEqSingleBand: React.FC<WidgetEqSingleBandProps> = ({
  ch,
  savedCh,
  sendCommand,
  bandKey,
}) => {
  const targetKey =
    bandKey === 'high' ? 'high' : bandKey === 'himid' ? 'hiMid' : bandKey === 'lomid' ? 'lowMid' : 'low';
  const b = BAND_CONFIG.find((cfg) => cfg.key === targetKey) || BAND_CONFIG[0];
  const state = ch.eq[b.key];
  const savedBand = savedCh?.eq[b.key];
  const hz = eqIndexToFreqHz(state.freq);
  const gainDb = (state.gain / 10).toFixed(1);
  const maxQ = b.key === 'high' ? 43 : b.key === 'low' ? 42 : 40;
  const qLabel = formatEqQ(state.q, b.key);

  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1 flex flex-col justify-between h-full shadow-sm select-none">
      {/* Band Title Bar with dot & dB */}
      <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
          <span
            className="text-[10px] font-mono font-bold tracking-tight"
            style={{ color: b.color }}
          >
            {b.label}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-slate-200">
          {Number(gainDb) > 0 ? `+${gainDb}` : gainDb} dB
        </span>
      </div>

      {/* 3 Knobs: GAIN, FREQ, Q */}
      <div className="flex items-center justify-around gap-1 px-0.5 py-0.5 flex-1">
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
          size={30}
          bipolar
          onChange={(val) =>
            sendCommand({
              type: 'set_eq',
              target: 'ch',
              id: ch.id,
              param: b.gParam,
              value: val,
            })
          }
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
          color={b.color}
          size={30}
          onChange={(val) =>
            sendCommand({
              type: 'set_eq',
              target: 'ch',
              id: ch.id,
              param: b.fParam,
              value: val,
            })
          }
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
          color={b.color}
          size={30}
          onChange={(val) =>
            sendCommand({
              type: 'set_eq',
              target: 'ch',
              id: ch.id,
              param: b.qParam,
              value: val,
            })
          }
        />
      </div>
    </div>
  );
};

export const WidgetEqHigh: React.FC<WidgetCommonProps> = (props) => (
  <WidgetEqSingleBand {...props} bandKey="high" />
);
export const WidgetEqHiMid: React.FC<WidgetCommonProps> = (props) => (
  <WidgetEqSingleBand {...props} bandKey="himid" />
);
export const WidgetEqLoMid: React.FC<WidgetCommonProps> = (props) => (
  <WidgetEqSingleBand {...props} bandKey="lomid" />
);
export const WidgetEqLow: React.FC<WidgetCommonProps> = (props) => (
  <WidgetEqSingleBand {...props} bandKey="low" />
);
