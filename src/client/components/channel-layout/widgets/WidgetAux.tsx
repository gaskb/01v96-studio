import React from 'react';
import { faderToDbString } from '../../../../shared/converters';
import { resolveKnobReset, RotaryKnob } from '../../RotaryKnob';
import { WidgetAuxPairProps, WidgetCommonProps } from './WidgetTypes';

/**
 * 3. Aux Sends 1 — 8 (2 Columns x 4 Rows: A1-A2, A3-A4, A5-A6, A7-A8)
 */
export const WidgetAuxSends: React.FC<WidgetCommonProps> = ({
  ch,
  savedCh,
  sendCommand,
  auxNames,
}) => {
  return (
    <div className="bg-[#070a0f] border border-slate-800/90 rounded-xl p-1.5 flex flex-col gap-1 justify-between h-full select-none shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-0.5 px-0.5">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-[10px] font-mono font-bold text-amber-400">
          AUX SENDS
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 items-center flex-1">
        {ch.auxSends.map((aux, idx) => {
          const auxId = idx + 1;
          const auxName = auxNames?.[idx];
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
              title={auxName ? `AUX ${auxId} (${auxName}): doppio click per ripristinare` : `AUX ${auxId}: doppio click per ripristinare`}
              className="bg-slate-950/80 border border-slate-850 rounded p-1 flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <div className="flex items-center justify-between w-full text-[9px] font-mono px-0.5">
                <span className="text-amber-300 font-bold truncate max-w-[48px]" title={auxName || `AUX ${auxId}`}>
                  {auxName || `A${auxId}`}
                </span>
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
 * 3a. Aux Pair Widget (Height 1)
 */
export const WidgetAuxPair: React.FC<WidgetAuxPairProps> = ({
  ch,
  savedCh,
  sendCommand,
  pairIndex,
  auxNames,
}) => {
  const firstIdx = pairIndex * 2;
  const secondIdx = pairIndex * 2 + 1;
  const firstAux = ch.auxSends[firstIdx];
  const secondAux = ch.auxSends[secondIdx];
  const firstId = firstIdx + 1;
  const secondId = secondIdx + 1;
  const firstName = auxNames?.[firstIdx];
  const secondName = auxNames?.[secondIdx];

  const renderSingleAux = (aux: typeof firstAux, auxId: number, idx: number, customName?: string) => {
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
        title={customName ? `AUX ${auxId} (${customName}): doppio click per ripristinare` : `AUX ${auxId}: doppio click per ripristinare`}
        className="bg-slate-950/80 border border-slate-850 rounded p-0.5 flex flex-col items-center gap-0.5 cursor-pointer flex-1"
      >
        <div className="flex items-center justify-between w-full text-[9px] font-mono px-0.5">
          <span className="text-amber-300 font-bold truncate max-w-[45px]" title={customName || `AUX ${auxId}`}>
            {customName || `A${auxId}`}
          </span>
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
        <span
          className="text-[10px] font-mono font-bold text-amber-400 truncate max-w-full"
          title={`${firstName || `AUX ${firstId}`} & ${secondName || `AUX ${secondId}`}`}
        >
          {firstName || secondName
            ? `${firstName || `A${firstId}`} / ${secondName || `A${secondId}`}`
            : `AUX ${firstId} & ${secondId}`}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-1 py-0.5">
        {renderSingleAux(firstAux, firstId, firstIdx, firstName)}
        {renderSingleAux(secondAux, secondId, secondIdx, secondName)}
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
