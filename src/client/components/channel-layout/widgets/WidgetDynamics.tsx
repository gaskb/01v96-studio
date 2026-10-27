import React from 'react';
import { COMP_RATIOS, formatPan } from '../../../../shared/converters';
import { RotaryKnob } from '../../RotaryKnob';
import { WidgetCommonProps } from './WidgetTypes';

/**
 * Compressor Standalone
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

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 items-center justify-items-center py-1 flex-1">
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
          size={32}
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
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'ratio', value: val })
          }
        />
        <RotaryKnob
          label="ATTACK"
          value={ch.comp.attack}
          min={0}
          max={120}
          step={1}
          savedValue={savedCh?.comp.attack}
          defaultValue={30}
          displayValue={`${ch.comp.attack}`}
          color="#22d3ee"
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'attack', value: val })
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
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'release', value: val })
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
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'gain', value: val })
          }
        />
        <RotaryKnob
          label="KNEE"
          value={ch.comp.knee}
          min={0}
          max={5}
          step={1}
          savedValue={savedCh?.comp.knee}
          defaultValue={2}
          displayValue={ch.comp.knee === 0 ? 'HARD' : `S${ch.comp.knee}`}
          color="#22d3ee"
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'knee', value: val })
          }
        />
      </div>
    </div>
  );
};

/**
 * Noise Gate Standalone
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

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 items-center justify-items-center py-1 flex-1">
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
          size={32}
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
          size={32}
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
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'attack', value: val })
          }
        />
        <RotaryKnob
          label="HOLD"
          value={ch.gate.hold}
          min={0}
          max={215}
          step={1}
          savedValue={savedCh?.gate.hold}
          defaultValue={10}
          displayValue={`${ch.gate.hold}`}
          color="#f59e0b"
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'hold', value: val })
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
          size={32}
          onChange={(val) =>
            sendCommand({ type: 'set_gate', id: ch.id, param: 'decay', value: val })
          }
        />
      </div>
    </div>
  );
};

/**
 * Preamp (Atten & Pan) + Dynamics (Compressor & Noise Gate) Combined
 */
export const WidgetPreampAndDynamics: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
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

      {/* SECTION B: COMPRESSOR */}
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

        <div className="grid grid-cols-3 gap-1 items-center justify-items-center py-0.5">
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
            size={30}
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
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'ratio', value: val })
            }
          />
          <RotaryKnob
            label="ATTACK"
            value={ch.comp.attack}
            min={0}
            max={120}
            step={1}
            savedValue={savedCh?.comp.attack}
            defaultValue={30}
            displayValue={`${ch.comp.attack}`}
            color="#22d3ee"
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'attack', value: val })
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
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'release', value: val })
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
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'gain', value: val })
            }
          />
          <RotaryKnob
            label="KNEE"
            value={ch.comp.knee}
            min={0}
            max={5}
            step={1}
            savedValue={savedCh?.comp.knee}
            defaultValue={2}
            displayValue={ch.comp.knee === 0 ? 'HARD' : `S${ch.comp.knee}`}
            color="#22d3ee"
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_comp', target: 'ch', id: ch.id, param: 'knee', value: val })
            }
          />
        </div>
      </div>

      {/* SECTION C: NOISE GATE */}
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

        <div className="grid grid-cols-3 gap-1 items-center justify-items-center py-0.5">
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
            size={30}
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
            size={30}
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
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'attack', value: val })
            }
          />
          <RotaryKnob
            label="HOLD"
            value={ch.gate.hold}
            min={0}
            max={215}
            step={1}
            savedValue={savedCh?.gate.hold}
            defaultValue={10}
            displayValue={`${ch.gate.hold}`}
            color="#f59e0b"
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'hold', value: val })
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
            size={30}
            onChange={(val) =>
              sendCommand({ type: 'set_gate', id: ch.id, param: 'decay', value: val })
            }
          />
        </div>
      </div>
    </div>
  );
};
