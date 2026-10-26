import React from 'react';
import {
  COMP_RATIOS,
  eqIndexToFreqHz,
  faderToDbString,
  formatEqQ,
  formatFreqHz,
  formatPan,
} from '../../../shared/converters';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { InOutMeterBridge } from '../InOutMeterBridge';
import { BAND_CONFIG, InteractiveEQ } from '../InteractiveEQ';
import { resolveKnobReset, RotaryKnob } from '../RotaryKnob';

export interface WidgetCommonProps {
  ch: InputChannelState;
  savedCh?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
}

/**
 * 1. Signal Level Meters (Vertical Mode)
 */
export const WidgetVerticalMeters: React.FC<WidgetCommonProps> = ({ ch }) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1.5 flex flex-col justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-850/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-[10px] font-mono font-bold text-cyan-400">METERS</span>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0 pt-0.5">
        <InOutMeterBridge
          meterIn={ch.meterIn}
          meterOut={ch.meterOut}
          grDb={ch.grDb}
          vertical={true}
        />
      </div>
    </div>
  );
};

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
 * 3. Aux Sends 1 — 8 (2 Columns x 4 Rows: A1-A2, A3-A4, A5-A6, A7-A8)
 */
export const WidgetAuxSends: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1.5 flex flex-col gap-1 justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-[10px] font-mono font-bold text-amber-400">
          AUX SENDS
        </span>
      </div>

      {/* 2 Columns x 4 Rows with Large, Legible Knobs */}
      <div className="grid grid-cols-2 gap-1.5 items-center flex-1">
        {ch.auxSends.map((aux, idx) => {
          const auxId = idx + 1;
          const savedLevel = savedCh?.auxSends[idx]?.level;
          const dbStr = faderToDbString(aux.level).replace(' dB', '');
          return (
            <div
              key={idx}
              onDoubleClick={(e) =>
                sendCommand({
                  type: 'set_aux_send',
                  chId: ch.id,
                  auxId,
                  param: 'level',
                  value: resolveKnobReset(
                    aux.level,
                    savedLevel,
                    823,
                    e.shiftKey || e.altKey
                  ),
                })
              }
              title={`Aux ${auxId}: doppio click per ripristinare`}
              className="bg-slate-950/80 border border-slate-850 rounded p-1 flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <div className="flex items-center justify-between w-full text-[9px] font-mono px-0.5">
                <span className="text-amber-300 font-bold">A{auxId}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendCommand({
                      type: 'set_aux_send',
                      chId: ch.id,
                      auxId,
                      param: 'pre',
                      value: !aux.pre,
                    });
                  }}
                  className={`px-1 py-[0.5px] rounded text-[8px] font-mono font-bold cursor-pointer transition ${
                    aux.pre
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  }`}
                  title={aux.pre ? 'Pre-Fader' : 'Post-Fader'}
                >
                  {aux.pre ? 'PRE' : 'PST'}
                </button>
              </div>

              <RotaryKnob
                label=""
                value={aux.level}
                min={0}
                max={1023}
                step={12}
                savedValue={savedLevel}
                defaultValue={823}
                displayValue={dbStr}
                color="#f59e0b"
                size={34}
                onChange={(val) =>
                  sendCommand({
                    type: 'set_aux_send',
                    chId: ch.id,
                    auxId,
                    param: 'level',
                    value: val,
                  })
                }
              />
            </div>
          );
        })}
      </div>
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

              {/* 3 Knobs with larger size={38} */}
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

export interface WidgetEqSingleBandProps extends WidgetCommonProps {
  bandKey: 'high' | 'himid' | 'lomid' | 'low';
}

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

export interface WidgetAuxPairProps extends WidgetCommonProps {
  pairIndex: number; // 0 for 1-2, 1 for 3-4, 2 for 5-6, 3 for 7-8
}

/**
 * 3a. Aux Pair Widget (Height 1)
 */
export const WidgetAuxPair: React.FC<WidgetAuxPairProps> = ({
  ch,
  savedCh,
  sendCommand,
  pairIndex,
}) => {
  const firstIdx = pairIndex * 2;
  const secondIdx = pairIndex * 2 + 1;
  const firstAux = ch.auxSends[firstIdx];
  const secondAux = ch.auxSends[secondIdx];
  const firstId = firstIdx + 1;
  const secondId = secondIdx + 1;

  const renderSingleAux = (aux: typeof firstAux, auxId: number, idx: number) => {
    if (!aux) return null;
    const savedLevel = savedCh?.auxSends[idx]?.level;
    const dbStr = faderToDbString(aux.level).replace(' dB', '');

    return (
      <div
        key={auxId}
        onDoubleClick={(e) =>
          sendCommand({
            type: 'set_aux_send',
            chId: ch.id,
            auxId,
            param: 'level',
            value: resolveKnobReset(
              aux.level,
              savedLevel,
              823,
              e.shiftKey || e.altKey
            ),
          })
        }
        title={`Aux ${auxId}: doppio click per ripristinare`}
        className="bg-slate-950/80 border border-slate-850 rounded p-0.5 flex flex-col items-center gap-0.5 cursor-pointer flex-1"
      >
        <div className="flex items-center justify-between w-full text-[9px] font-mono px-0.5">
          <span className="text-amber-300 font-bold">A{auxId}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              sendCommand({
                type: 'set_aux_send',
                chId: ch.id,
                auxId,
                param: 'pre',
                value: !aux.pre,
              });
            }}
            className={`px-1 py-[0.5px] rounded text-[8px] font-mono font-bold cursor-pointer transition ${
              aux.pre
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            }`}
            title={aux.pre ? 'Pre-Fader' : 'Post-Fader'}
          >
            {aux.pre ? 'PRE' : 'PST'}
          </button>
        </div>

        <RotaryKnob
          label=""
          value={aux.level}
          min={0}
          max={1023}
          step={12}
          savedValue={savedLevel}
          defaultValue={823}
          displayValue={dbStr}
          color="#f59e0b"
          size={30}
          onChange={(val) =>
            sendCommand({
              type: 'set_aux_send',
              chId: ch.id,
              auxId,
              param: 'level',
              value: val,
            })
          }
        />
      </div>
    );
  };

  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1 flex flex-col justify-between h-full select-none shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-1">
        <span className="text-[10px] font-mono font-bold text-amber-400">
          AUX {firstId} & {secondId}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-1 py-0.5">
        {renderSingleAux(firstAux, firstId, firstIdx)}
        {renderSingleAux(secondAux, secondId, secondIdx)}
      </div>
    </div>
  );
};

export const WidgetAux12: React.FC<WidgetCommonProps> = (props) => (
  <WidgetAuxPair {...props} pairIndex={0} />
);
export const WidgetAux34: React.FC<WidgetCommonProps> = (props) => (
  <WidgetAuxPair {...props} pairIndex={1} />
);
export const WidgetAux56: React.FC<WidgetCommonProps> = (props) => (
  <WidgetAuxPair {...props} pairIndex={2} />
);
export const WidgetAux78: React.FC<WidgetCommonProps> = (props) => (
  <WidgetAuxPair {...props} pairIndex={3} />
);

/**
 * 5. Preamp (Atten & Pan) + Dynamics (Compressor & Noise Gate) Combined
 */
export const WidgetPreampAndDynamics: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  controlMode,
  sendCommand,
}) => {
  const compRatioLabel = COMP_RATIOS[ch.comp.ratio] ?? '2:1';

  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col gap-1.5 justify-between h-full select-none shadow-sm">
      {/* SECTION A: PREAMP (ATTEN & PAN) */}
      <div className="bg-[#05080e] border border-slate-850 rounded p-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 border-b border-slate-850/80 pb-0.5 px-0.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[10px] font-mono font-bold text-cyan-400">PREAMP</span>
        </div>
        <div className="flex items-center justify-around gap-1.5 py-0.5">
          <RotaryKnob
            label="ATTEN"
            value={ch.att}
            min={-360}
            max={180}
            step={5}
            savedValue={savedCh?.att}
            defaultValue={0}
            displayValue={`${(ch.att / 10).toFixed(1)}dB`}
            color="#22d3ee"
            size={36}
            bipolar
            onChange={(val) => sendCommand({ type: 'set_att', id: ch.id, value: val })}
          />
          <RotaryKnob
            label="PAN"
            value={ch.pan}
            min={-63}
            max={63}
            step={1}
            savedValue={savedCh?.pan}
            defaultValue={0}
            displayValue={formatPan(ch.pan)}
            color="#22d3ee"
            size={36}
            bipolar
            onChange={(val) =>
              sendCommand({ type: 'set_pan', target: 'ch', id: ch.id, value: val })
            }
          />
        </div>
      </div>

      {/* SECTION B: COMPRESSOR (2x2 Grid with Large Knobs) */}
      <div className="bg-[#05080e] border border-slate-850 rounded p-1 flex flex-col gap-1">
        <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[10px] font-mono font-bold text-cyan-400">COMP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-cyan-300 font-bold">{compRatioLabel}</span>
            <button
              onClick={() =>
                sendCommand({
                  type: 'set_comp',
                  target: 'ch',
                  id: ch.id,
                  param: 'on',
                  value: !ch.comp.on,
                })
              }
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition ${
                ch.comp.on
                  ? 'bg-cyan-500 text-slate-950 font-extrabold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              {ch.comp.on ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 items-center justify-items-center py-0.5">
          <RotaryKnob
            label="THRESH"
            value={ch.comp.threshold}
            min={-540}
            max={0}
            step={5}
            savedValue={savedCh?.comp.threshold}
            defaultValue={-200}
            displayValue={`${(ch.comp.threshold / 10).toFixed(0)}dB`}
            color="#22d3ee"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'threshold', value: val })
            }
          />
          <RotaryKnob
            label="RATIO"
            value={ch.comp.ratio}
            min={0}
            max={15}
            step={1}
            savedValue={savedCh?.comp.ratio}
            defaultValue={5}
            displayValue={compRatioLabel}
            color="#22d3ee"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'ratio', value: val })
            }
          />
          <RotaryKnob
            label="GAIN"
            value={ch.comp.gain}
            min={0}
            max={180}
            step={5}
            savedValue={savedCh?.comp.gain}
            defaultValue={0}
            displayValue={`+${(ch.comp.gain / 10).toFixed(0)}`}
            color="#10b981"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'gain', value: val })
            }
          />
          <RotaryKnob
            label="RELEASE"
            value={ch.comp.release}
            min={0}
            max={159}
            step={1}
            savedValue={savedCh?.comp.release}
            defaultValue={40}
            displayValue={`${ch.comp.release}`}
            color="#22d3ee"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'release', value: val })
            }
          />
        </div>
      </div>

      {/* SECTION C: NOISE GATE (2x2 Grid with Large Knobs) */}
      <div className="bg-[#05080e] border border-slate-850 rounded p-1 flex flex-col gap-1">
        <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400">GATE</span>
          </div>
          <button
            onClick={() =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'on', value: !ch.gate.on })
            }
            className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition ${
              ch.gate.on
                ? 'bg-amber-500 text-slate-950 font-extrabold'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            {ch.gate.on ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 items-center justify-items-center py-0.5">
          <RotaryKnob
            label="THRESH"
            value={ch.gate.threshold}
            min={-540}
            max={0}
            step={5}
            savedValue={savedCh?.gate.threshold}
            defaultValue={-260}
            displayValue={`${(ch.gate.threshold / 10).toFixed(0)}dB`}
            color="#f59e0b"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'threshold', value: val })
            }
          />
          <RotaryKnob
            label="RANGE"
            value={ch.gate.range}
            min={-700}
            max={0}
            step={5}
            savedValue={savedCh?.gate.range}
            defaultValue={-560}
            displayValue={`${(ch.gate.range / 10).toFixed(0)}`}
            color="#f59e0b"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'range', value: val })
            }
          />
          <RotaryKnob
            label="ATTACK"
            value={ch.gate.attack}
            min={0}
            max={120}
            step={1}
            savedValue={savedCh?.gate.attack}
            defaultValue={10}
            displayValue={`${ch.gate.attack}`}
            color="#f59e0b"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'attack', value: val })
            }
          />
          <RotaryKnob
            label="DECAY"
            value={ch.gate.decay}
            min={0}
            max={159}
            step={1}
            savedValue={savedCh?.gate.decay}
            defaultValue={44}
            displayValue={`${ch.gate.decay}`}
            color="#f59e0b"
            size={34}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'decay', value: val })
            }
          />
        </div>
      </div>
    </div>
  );
};

// Compatibility exports
export const WidgetMeterPreamp: React.FC<WidgetCommonProps> = (props) => (
  <WidgetVerticalMeters {...props} />
);
export const WidgetRouting: React.FC<WidgetCommonProps> = (props) => (
  <WidgetVerticalRouting {...props} />
);
export const WidgetVerticalRouting: React.FC<WidgetCommonProps> = ({
  ch,
  sendCommand,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1.5 flex flex-col justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-850/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="text-[10px] font-mono font-bold text-rose-400">ROUTING</span>
      </div>

      {/* Vertical Buttons Stack: One per row */}
      <div className="flex flex-col items-center gap-0.5 w-full my-0.5">
        {/* Stereo L/R */}
        <button
          onClick={() =>
            sendCommand({
              type: 'set_routing',
              id: ch.id,
              target: 'stereo',
              value: !ch.routing.stereo,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.routing.stereo
              ? 'bg-rose-500 text-white border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Stereo Main L/R Bus"
        >
          ST L/R
        </button>

        {/* Direct Out */}
        <button
          onClick={() =>
            sendCommand({
              type: 'set_routing',
              id: ch.id,
              target: 'direct',
              value: !ch.routing.direct,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.routing.direct
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Direct Out"
        >
          DIR
        </button>

        {/* Bus 1 to 8: One per row */}
        {ch.routing.bus.map((bOn, bIdx) => (
          <button
            key={bIdx}
            onClick={() =>
              sendCommand({
                type: 'set_routing',
                id: ch.id,
                target: 'bus',
                busIndex: bIdx,
                value: !bOn,
              })
            }
            className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
              bOn
                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            B{bIdx + 1}
          </button>
        ))}
      </div>

      {/* Delay Toggle & Time */}
      <div className="flex flex-col items-center gap-0.5 w-full pt-0.5 border-t border-slate-800/80">
        <button
          onClick={() =>
            sendCommand({
              type: 'set_delay',
              id: ch.id,
              on: !ch.delayOn,
              time: ch.delayTime,
            })
          }
          className={`w-full py-0.5 rounded text-[8px] font-mono font-bold border cursor-pointer transition ${
            ch.delayOn
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          DLY {ch.delayOn ? 'ON' : 'OFF'}
        </button>
        <span className="text-[7px] font-mono text-cyan-300">
          {(ch.delayTime * 0.45).toFixed(1)}ms
        </span>
      </div>
    </div>
  );
};

/**
 * 5a. Preamp (Atten & Pan) Standalone
 */
export const WidgetPreampAttenPan: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col gap-1 justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-850/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-[10px] font-mono font-bold text-cyan-400">PREAMP</span>
      </div>
      <div className="flex flex-col items-center justify-around gap-2 py-1 flex-1">
        <RotaryKnob
          label="ATTEN"
          value={ch.att}
          min={-360}
          max={180}
          step={5}
          savedValue={savedCh?.att}
          defaultValue={0}
          displayValue={`${(ch.att / 10).toFixed(1)}dB`}
          color="#22d3ee"
          size={36}
          bipolar
          onChange={(val) => sendCommand({ type: 'set_att', id: ch.id, value: val })}
        />
        <RotaryKnob
          label="PAN"
          value={ch.pan}
          min={-63}
          max={63}
          step={1}
          savedValue={savedCh?.pan}
          defaultValue={0}
          displayValue={formatPan(ch.pan)}
          color="#22d3ee"
          size={36}
          bipolar
          onChange={(val) =>
            sendCommand({ type: 'set_pan', target: 'ch', id: ch.id, value: val })
          }
        />
      </div>
    </div>
  );
};

/**
 * 5b. Compressor Standalone
 */
export const WidgetCompressor: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
}) => {
  const compRatioLabel = COMP_RATIOS[ch.comp.ratio] ?? '2:1';

  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col gap-1 justify-between h-full select-none shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[10px] font-mono font-bold text-cyan-400">COMP</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-cyan-300 font-bold">{compRatioLabel}</span>
          <button
            onClick={() =>
              sendCommand({
                type: 'set_comp',
                target: 'ch',
                id: ch.id,
                param: 'on',
                value: !ch.comp.on,
              })
            }
            className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition ${
              ch.comp.on
                ? 'bg-cyan-500 text-slate-950 font-extrabold'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            {ch.comp.on ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 items-center justify-items-center py-1 flex-1">
        <RotaryKnob
          label="THRESH"
          value={ch.comp.threshold}
          min={-540}
          max={0}
          step={5}
          savedValue={savedCh?.comp.threshold}
          defaultValue={-200}
          displayValue={`${(ch.comp.threshold / 10).toFixed(0)}dB`}
          color="#22d3ee"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'threshold', value: val })
          }
        />
        <RotaryKnob
          label="RATIO"
          value={ch.comp.ratio}
          min={0}
          max={15}
          step={1}
          savedValue={savedCh?.comp.ratio}
          defaultValue={5}
          displayValue={compRatioLabel}
          color="#22d3ee"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'ratio', value: val })
          }
        />
        <RotaryKnob
          label="GAIN"
          value={ch.comp.gain}
          min={0}
          max={180}
          step={5}
          savedValue={savedCh?.comp.gain}
          defaultValue={0}
          displayValue={`+${(ch.comp.gain / 10).toFixed(0)}`}
          color="#10b981"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'gain', value: val })
          }
        />
        <RotaryKnob
          label="RELEASE"
          value={ch.comp.release}
          min={0}
          max={159}
          step={1}
          savedValue={savedCh?.comp.release}
          defaultValue={40}
          displayValue={`${ch.comp.release}`}
          color="#22d3ee"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'release', value: val })
          }
        />
      </div>
    </div>
  );
};

/**
 * 5c. Noise Gate Standalone
 */
export const WidgetGate: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-2 flex flex-col gap-1 justify-between h-full select-none shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-850/80 pb-0.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] font-mono font-bold text-amber-400">GATE</span>
        </div>
        <button
          onClick={() =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'on', value: !ch.gate.on })
          }
          className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition ${
            ch.gate.on
              ? 'bg-amber-500 text-slate-950 font-extrabold'
              : 'bg-slate-900 border border-slate-800 text-slate-400'
          }`}
        >
          {ch.gate.on ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 items-center justify-items-center py-1 flex-1">
        <RotaryKnob
          label="THRESH"
          value={ch.gate.threshold}
          min={-540}
          max={0}
          step={5}
          savedValue={savedCh?.gate.threshold}
          defaultValue={-260}
          displayValue={`${(ch.gate.threshold / 10).toFixed(0)}dB`}
          color="#f59e0b"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'threshold', value: val })
          }
        />
        <RotaryKnob
          label="RANGE"
          value={ch.gate.range}
          min={-700}
          max={0}
          step={5}
          savedValue={savedCh?.gate.range}
          defaultValue={-560}
          displayValue={`${(ch.gate.range / 10).toFixed(0)}`}
          color="#f59e0b"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'range', value: val })
          }
        />
        <RotaryKnob
          label="ATTACK"
          value={ch.gate.attack}
          min={0}
          max={120}
          step={1}
          savedValue={savedCh?.gate.attack}
          defaultValue={10}
          displayValue={`${ch.gate.attack}`}
          color="#f59e0b"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'attack', value: val })
          }
        />
        <RotaryKnob
          label="DECAY"
          value={ch.gate.decay}
          min={0}
          max={159}
          step={1}
          savedValue={savedCh?.gate.decay}
          defaultValue={44}
          displayValue={`${ch.gate.decay}`}
          color="#f59e0b"
          size={34}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'decay', value: val })
          }
        />
      </div>
    </div>
  );
};
