import React from 'react';
import { InOutMeterBridge } from '../../InOutMeterBridge';
import { WidgetCommonProps } from './WidgetTypes';

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

// Compatibility export
export const WidgetMeterPreamp: React.FC<WidgetCommonProps> = (props) => (
  <WidgetVerticalMeters {...props} />
);
