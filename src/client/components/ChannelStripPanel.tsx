import React, { useState } from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../shared/types';
import { InteractiveEQ } from './InteractiveEQ';
import { TripleVuMeterBridge } from './AnalogVuMeter';
import { ChannelStripAuxTab } from './channel-strip/ChannelStripAuxTab';
import { ChannelStripDynTab } from './channel-strip/ChannelStripDynTab';
import { ChannelStripHeader, ChannelStripTabId } from './channel-strip/ChannelStripHeader';
import { ChannelStripRoutingTab } from './channel-strip/ChannelStripRoutingTab';

export interface ChannelStripPanelProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  sendCommand: (cmd: ClientCommand) => void;
  auxNames?: string[];
  busNames?: string[];
  deepPair?: boolean;
}

export const ChannelStripPanel: React.FC<ChannelStripPanelProps> = ({
  channel,
  savedChannel,
  controlMode,
  onChangeControlMode,
  sendCommand,
  auxNames,
  busNames,
  deepPair = false,
}) => {
  const [activeTab, setActiveTab] = useState<ChannelStripTabId>('eq');

  return (
    <div className="flex flex-col h-full bg-[#0c1018] border border-slate-800/90 rounded-2xl p-3 overflow-y-auto gap-2.5">
      {/* Top Channel Header & Preamp Bar */}
      <ChannelStripHeader
        channel={channel}
        savedChannel={savedChannel}
        controlMode={controlMode}
        onChangeControlMode={onChangeControlMode}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sendCommand={sendCommand}
        deepPair={deepPair}
      />

      {/* TAB 1: 4-Band Parametric EQ */}
      {activeTab === 'eq' && (
        <InteractiveEQ
          eq={channel.eq}
          savedEq={savedChannel?.eq}
          controlMode={controlMode}
          meterIn={channel.meterIn}
          meterOut={channel.meterOut}
          grDb={channel.grDb}
          onChange={(param, value) =>
            sendCommand({ type: 'set_eq', target: 'ch', id: channel.id, param, value })
          }
        />
      )}

      {/* TAB 2: Gate & Compressor + Live IN / OUT / GR Level Bridge */}
      {activeTab === 'dyn' && (
        <ChannelStripDynTab
          channel={channel}
          savedChannel={savedChannel}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      )}

      {/* TAB: Dedicated Vintage Triple Analog Needle VU-Meters (IN, GR, OUT) */}
      {activeTab === 'vu' && (
        <div className="flex flex-col gap-3 py-2 items-center justify-center">
          <TripleVuMeterBridge
            meterIn={channel.meterIn}
            meterOut={channel.meterOut}
            grDb={channel.grDb}
            channelName={channel.name ? `CH ${channel.id}: ${channel.name}` : `CH ${channel.id}`}
          />
        </div>
      )}

      {/* TAB 3: AUX Sends 1..8 + Live IN/OUT Level */}
      {activeTab === 'aux' && (
        <ChannelStripAuxTab
          channel={channel}
          savedChannel={savedChannel}
          controlMode={controlMode}
          auxNames={auxNames}
          sendCommand={sendCommand}
        />
      )}

      {/* TAB 4: Routing (ST, DIRECT, BUS 1..8) + Input Delay + IN/OUT Meter */}
      {activeTab === 'routing' && (
        <ChannelStripRoutingTab
          channel={channel}
          savedChannel={savedChannel}
          controlMode={controlMode}
          busNames={busNames}
          sendCommand={sendCommand}
        />
      )}
    </div>
  );
};
