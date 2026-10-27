import { ClientCommand, ControlMode, InputChannelState } from '../../../../shared/types';

export interface WidgetCommonProps {
  ch: InputChannelState;
  savedCh?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
  auxNames?: string[];
  busNames?: string[];
}

export interface WidgetEqSingleBandProps extends WidgetCommonProps {
  bandKey: 'high' | 'himid' | 'lomid' | 'low';
}

export interface WidgetAuxPairProps extends WidgetCommonProps {
  pairIndex: number; // 0 for 1-2, 1 for 3-4, 2 for 5-6, 3 for 7-8
}
