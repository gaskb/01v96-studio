import React from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { InOutMeterBridge } from '../InOutMeterBridge';
import { CompressorCard } from './CompressorCard';
import { GateCard } from './GateCard';

interface ChannelStripDynTabProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  sendCommand: (cmd: ClientCommand) => void;
}

export const ChannelStripDynTab: React.FC<ChannelStripDynTabProps> = ({
  channel,
  savedChannel,
  controlMode,
  sendCommand,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <InOutMeterBridge
        meterIn={channel.meterIn}
        meterOut={channel.meterOut}
        grDb={channel.grDb}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GateCard
          channel={channel}
          savedChannel={savedChannel}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
        <CompressorCard
          channel={channel}
          savedChannel={savedChannel}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      </div>
    </div>
  );
};
