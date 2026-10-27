import React from 'react';
import { faderToDbString } from '../../../shared/converters';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { InOutMeterBridge } from '../InOutMeterBridge';
import { resolveKnobReset, RotaryKnob } from '../RotaryKnob';
import { handleSliderWheel } from './sliderWheelHelper';

interface ChannelStripAuxTabProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  auxNames?: string[];
  sendCommand: (cmd: ClientCommand) => void;
}

export const ChannelStripAuxTab: React.FC<ChannelStripAuxTabProps> = ({
  channel,
  savedChannel,
  controlMode,
  auxNames,
  sendCommand,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <InOutMeterBridge
        meterIn={channel.meterIn}
        meterOut={channel.meterOut}
        grDb={channel.grDb}
        compact
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {channel.auxSends.map((aux, idx) => {
          const auxId = idx + 1;
          const savedLevel = savedChannel?.auxSends[idx]?.level;
          return (
            <div
              key={auxId}
              className="bg-[#0d1118] border border-slate-800 rounded-xl p-2.5 flex flex-col items-center gap-2"
            >
              <span
                className="text-xs font-mono font-bold text-amber-300 truncate max-w-full"
                title={auxNames?.[idx] ? `AUX ${auxId}: ${auxNames[idx]}` : `AUX ${auxId}`}
              >
                {auxNames?.[idx] || `AUX ${auxId}`}
              </span>
              <div className="flex gap-1 w-full">
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_aux_send',
                      chId: channel.id,
                      auxId,
                      param: 'on',
                      value: !aux.on,
                    })
                  }
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                    aux.on ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {aux.on ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() =>
                    sendCommand({
                      type: 'set_aux_send',
                      chId: channel.id,
                      auxId,
                      param: 'pre',
                      value: !aux.pre,
                    })
                  }
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                    aux.pre
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                      : 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  {aux.pre ? 'PRE' : 'POST'}
                </button>
              </div>

              {controlMode === 'knobs' ? (
                <RotaryKnob
                  label="SEND"
                  value={aux.level}
                  min={0}
                  max={1023}
                  step={12}
                  savedValue={savedLevel}
                  defaultValue={823}
                  displayValue={faderToDbString(aux.level)}
                  color="#f59e0b"
                  size={52}
                  onChange={(val) =>
                    sendCommand({
                      type: 'set_aux_send',
                      chId: channel.id,
                      auxId,
                      param: 'level',
                      value: val,
                    })
                  }
                />
              ) : (
                <>
                  <input
                    type="range"
                    min={0}
                    max={1023}
                    value={aux.level}
                    onChange={(e) =>
                      sendCommand({
                        type: 'set_aux_send',
                        chId: channel.id,
                        auxId,
                        param: 'level',
                        value: Number(e.target.value),
                      })
                    }
                    onWheel={(e) =>
                      handleSliderWheel(e, aux.level, 0, 1023, 12, (val) =>
                        sendCommand({
                          type: 'set_aux_send',
                          chId: channel.id,
                          auxId,
                          param: 'level',
                          value: val,
                        })
                      )
                    }
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_aux_send',
                        chId: channel.id,
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
                    className="w-full accent-amber-400 cursor-pointer my-1"
                  />
                  <span
                    onDoubleClick={(e) =>
                      sendCommand({
                        type: 'set_aux_send',
                        chId: channel.id,
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
                    title="Doppio click: ripristina valore memorizzato nella scena"
                    className="text-[10px] font-mono text-slate-300 cursor-pointer select-none"
                  >
                    {faderToDbString(aux.level)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
