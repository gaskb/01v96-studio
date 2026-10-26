import React from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types.js';
import {
  WidgetAux12,
  WidgetAux34,
  WidgetAux56,
  WidgetAux78,
  WidgetAuxSends,
  WidgetCompressor,
  WidgetEqBands,
  WidgetEqGraph,
  WidgetEqHigh,
  WidgetEqHiMid,
  WidgetEqLoMid,
  WidgetEqLow,
  WidgetGate,
  WidgetPreampAttenPan,
  WidgetVerticalMeters,
  WidgetVerticalRouting,
} from './ChannelWidgets.js';
import { WidgetId } from './layoutTypes.js';

export interface WidgetRendererProps {
  id: WidgetId;
  ch: InputChannelState;
  savedCh?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
  auxNames?: string[];
  busNames?: string[];
}

export const renderWidgetContent = (
  id: WidgetId,
  ch: InputChannelState,
  savedCh: InputChannelState | undefined,
  controlMode: ControlMode,
  sendCommand: (cmd: ClientCommand) => void,
  auxNames?: string[],
  busNames?: string[]
): React.ReactNode => {
  switch (id) {
    case 'meter_vertical':
    case 'meter_preamp':
      return (
        <WidgetVerticalMeters
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_graph':
      return (
        <WidgetEqGraph
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_high':
      return (
        <WidgetEqHigh
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_himid':
      return (
        <WidgetEqHiMid
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_lomid':
      return (
        <WidgetEqLoMid
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_low':
      return (
        <WidgetEqLow
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_bands':
      return (
        <WidgetEqBands
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'preamp':
      return (
        <WidgetPreampAttenPan
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'compressor':
      return (
        <WidgetCompressor
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'gate':
      return (
        <WidgetGate
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'aux_1_2':
      return (
        <WidgetAux12
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_3_4':
      return (
        <WidgetAux34
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_5_6':
      return (
        <WidgetAux56
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_7_8':
      return (
        <WidgetAux78
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_sends':
      return (
        <WidgetAuxSends
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'routing':
      return (
        <WidgetVerticalRouting
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    default:
      return null;
  }
};
