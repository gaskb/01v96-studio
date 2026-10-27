import React from 'react';
import { formatPan } from '../../../../shared/converters';
import { RotaryKnob } from '../../RotaryKnob';
import { WidgetCommonProps } from './WidgetTypes';

/**
 * Preamp (Atten & Pan) Standalone
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
