import React, { useCallback, useState } from 'react';
import { ClientCommand, ControlMode, MixerLayer, MixerState } from '../../../shared/types';
import { FaderStrip } from '../FaderStrip';
import { SelectedChannelRack } from '../SelectedChannelRack';
import { LiveMetersState } from '../../hooks/useMixerWebSocket';

interface ConsoleFadersViewProps {
  state: MixerState;
  savedState: MixerState | null;
  liveMeters: LiveMetersState;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  sendCommand: (cmd: ClientCommand) => void;
}

export const ConsoleFadersView: React.FC<ConsoleFadersViewProps> = ({
  state,
  savedState,
  liveMeters,
  controlMode,
  onChangeControlMode,
  sendCommand,
}) => {
  const [layer, setLayer] = useState<MixerLayer>('all32');
  const [faderFlipAux, setFaderFlipAux] = useState<number | null>(null);
  const [showChannelStrip, setShowChannelStrip] = useState(true);
  const [rackHeight, setRackHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('01v96_rack_height_px');
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 120 && parsed <= 600) return parsed;
      }
    }
    return 240;
  });

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = rackHeight;

    const onMouseMove = (moveEv: MouseEvent) => {
      moveEv.preventDefault();
      const deltaY = moveEv.clientY - startY;
      const newH = Math.max(120, Math.min(600, startH + deltaY));
      setRackHeight(newH);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setRackHeight((curr) => {
        window.localStorage.setItem('01v96_rack_height_px', String(curr));
        return curr;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [rackHeight]);

  const baseSelectedChannel =
    state.channels.find((c) => c.id === state.selectedChannel) ?? state.channels[0];
  const selectedChannelObj = {
    ...baseSelectedChannel,
    meterIn: liveMeters.metersIn[`ch${baseSelectedChannel.id}`] ?? baseSelectedChannel.meterIn,
    meterOut: liveMeters.metersOut[`ch${baseSelectedChannel.id}`] ?? baseSelectedChannel.meterOut,
    grDb: liveMeters.grs[`ch${baseSelectedChannel.id}`] ?? baseSelectedChannel.grDb,
  };
  const savedSelectedChannelObj =
    state.savedChannels?.find((c) => c.id === state.selectedChannel) ??
    savedState?.channels.find((c) => c.id === state.selectedChannel) ??
    state.savedChannels?.[0] ??
    savedState?.channels[0];

  const visibleInputChannels =
    layer === 'all32'
      ? state.channels
      : layer === 'ch1-16'
        ? state.channels.slice(0, 16)
        : layer === 'ch17-32'
          ? state.channels.slice(16, 32)
          : [];

  return (
    <>
      {/* SUB-BAR FOR CONSOLE VIEW: Layer Bank & Sends-on-Fader */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-[#0a0e16] border-b border-slate-800/80 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">LAYER:</span>
          <div className="flex bg-[#070a0f] p-0.5 rounded-lg border border-slate-800">
            {[
              { id: 'all32', label: '🎚️ 32 CANALI' },
              { id: 'ch1-16', label: 'CH 1-16' },
              { id: 'ch17-32', label: 'CH 17-32' },
              { id: 'stin-aux', label: 'AUX 1-8' },
              { id: 'bus-master', label: 'BUS 1-8' },
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setLayer(l.id as MixerLayer);
                  setFaderFlipAux(null);
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  layer === l.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowChannelStrip((v) => !v)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
              showChannelStrip
                ? 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {showChannelStrip ? '▼ NASCONDI RACK' : '▲ MOSTRA RACK'}
          </button>
        </div>

        {(layer === 'all32' || layer === 'ch1-16' || layer === 'ch17-32') && (
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="text-slate-500 text-[10px] mr-1">FADER FLIP:</span>
            <button
              onClick={() => setFaderFlipAux(null)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                faderFlipAux === null
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              MAIN LEVEL
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((auxId) => {
              const auxName = state.auxes[auxId - 1]?.name || `AUX ${auxId}`;
              return (
                <button
                  key={auxId}
                  onClick={() => setFaderFlipAux(faderFlipAux === auxId ? null : auxId)}
                  title={`AUX ${auxId}: ${auxName}`}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition max-w-[120px] truncate ${
                    faderFlipAux === auxId
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'bg-slate-900 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  {auxName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SelectedChannelRack & Splitter */}
      {showChannelStrip && (
        <div
          className="shrink-0 flex flex-col min-h-0"
          style={{ height: `${rackHeight}px` }}
        >
          <SelectedChannelRack
            channel={selectedChannelObj}
            savedChannel={savedSelectedChannelObj}
            controlMode={controlMode}
            onChangeControlMode={onChangeControlMode}
            sendCommand={sendCommand}
            auxNames={state.auxes.map((a) => a.name)}
            busNames={state.buses.map((b) => b.name)}
            deepPair={state.deepPair}
          />
        </div>
      )}

      {showChannelStrip && (
        <div
          onMouseDown={handleSplitterMouseDown}
          onDoubleClick={() => {
            setRackHeight(240);
            window.localStorage.setItem('01v96_rack_height_px', '240');
          }}
          className="group relative h-2.5 -my-1 w-full flex items-center justify-center cursor-row-resize select-none z-20"
          title="Trascina in alto o in basso per ridimensionare il rack o allargare i fader (Doppio click per 240px)"
        >
          <div className="w-full h-[1px] bg-slate-800/80 group-hover:bg-amber-400 transition-colors" />
          <div className="absolute px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 group-hover:border-amber-400 group-hover:bg-amber-950/40 text-slate-400 group-hover:text-amber-300 transition-colors flex items-center gap-1 shadow-sm">
            <span className="text-[8px] font-mono tracking-widest text-slate-500 group-hover:text-amber-400">
              ••••••
            </span>
            <span className="text-[8px] font-mono font-bold">
              {rackHeight}px
            </span>
            <span className="text-[8px] font-mono tracking-widest text-slate-500 group-hover:text-amber-400">
              ••••••
            </span>
          </div>
        </div>
      )}

      {/* Fader Strips Container */}
      <div className="flex-1 w-full min-h-0 flex gap-1.5 overflow-hidden">
        <div className="flex-1 w-full flex items-stretch gap-1 overflow-x-auto pb-1">
          {(layer === 'all32' || layer === 'ch1-16' || layer === 'ch17-32') &&
            visibleInputChannels.map((ch) => {
              const isAuxFlip = faderFlipAux !== null;
              const auxSendObj = isAuxFlip ? ch.auxSends[faderFlipAux - 1] : null;
              const savedCh =
                state.savedChannels?.find((c) => c.id === ch.id) ??
                savedState?.channels.find((c) => c.id === ch.id);
              const savedAuxSendObj =
                isAuxFlip && savedCh ? savedCh.auxSends[faderFlipAux - 1] : null;

              return (
                <FaderStrip
                  key={ch.id}
                  id={ch.id}
                  label={`CH ${ch.id}`}
                  name={ch.name}
                  compact={layer === 'all32'}
                  on={isAuxFlip ? (auxSendObj?.on ?? true) : ch.on}
                  solo={ch.solo}
                  fader={isAuxFlip ? (auxSendObj?.level ?? 0) : ch.fader}
                  savedFader={isAuxFlip ? savedAuxSendObj?.level : savedCh?.fader}
                  pan={ch.pan}
                  savedPan={savedCh?.pan}
                  meter={liveMeters.metersOut[`ch${ch.id}`] ?? liveMeters.metersIn[`ch${ch.id}`] ?? (ch.meterOut || ch.meterIn)}
                  selected={state.selectedChannel === ch.id}
                  accentColor={isAuxFlip ? 'amber' : ch.id >= 17 ? 'purple' : 'cyan'}
                  onSelect={() => sendCommand({ type: 'select_channel', id: ch.id })}
                  onChangeFader={(val) => {
                    if (isAuxFlip) {
                      sendCommand({
                        type: 'set_aux_send',
                        chId: ch.id,
                        auxId: faderFlipAux,
                        param: 'level',
                        value: val,
                      });
                    } else {
                      sendCommand({ type: 'set_fader', target: 'ch', id: ch.id, value: val });
                    }
                  }}
                  onToggleOn={() => {
                    if (isAuxFlip) {
                      sendCommand({
                        type: 'set_aux_send',
                        chId: ch.id,
                        auxId: faderFlipAux,
                        param: 'on',
                        value: !(auxSendObj?.on ?? true),
                      });
                    } else {
                      sendCommand({ type: 'set_on', target: 'ch', id: ch.id, value: !ch.on });
                    }
                  }}
                  onToggleSolo={() =>
                    sendCommand({
                      type: 'set_solo',
                      target: 'ch',
                      id: ch.id,
                      value: !ch.solo,
                    })
                  }
                  onChangePan={(val) =>
                    sendCommand({ type: 'set_pan', target: 'ch', id: ch.id, value: val })
                  }
                  onRename={(newName) =>
                    sendCommand({ type: 'set_name', target: 'ch', id: ch.id, name: newName })
                  }
                />
              );
            })}

          {layer === 'stin-aux' &&
            state.auxes.map((aux) => {
              const savedAux = savedState?.auxes.find((a) => a.id === aux.id);
              return (
                <FaderStrip
                  key={`aux-${aux.id}`}
                  id={aux.id}
                  label={`AUX ${aux.id}`}
                  name={aux.name}
                  on={aux.on}
                  fader={aux.fader}
                  savedFader={savedAux?.fader}
                  pan={aux.pan}
                  savedPan={savedAux?.pan}
                  meter={aux.meterOut}
                  selected={false}
                  accentColor="amber"
                  onSelect={() => {}}
                  onChangeFader={(val) =>
                    sendCommand({ type: 'set_fader', target: 'aux', id: aux.id, value: val })
                  }
                  onToggleOn={() =>
                    sendCommand({ type: 'set_on', target: 'aux', id: aux.id, value: !aux.on })
                  }
                  onChangePan={(val) =>
                    sendCommand({ type: 'set_pan', target: 'aux', id: aux.id, value: val })
                  }
                  onRename={(newName) =>
                    sendCommand({ type: 'set_name', target: 'aux', id: aux.id, name: newName })
                  }
                />
              );
            })}

          {layer === 'bus-master' &&
            state.buses.map((bus) => {
              const savedBus = savedState?.buses.find((b) => b.id === bus.id);
              return (
                <FaderStrip
                  key={`bus-${bus.id}`}
                  id={bus.id}
                  label={`BUS ${bus.id}`}
                  name={bus.name}
                  on={bus.on}
                  fader={bus.fader}
                  savedFader={savedBus?.fader}
                  pan={bus.pan}
                  savedPan={savedBus?.pan}
                  meter={bus.meterOut}
                  selected={false}
                  accentColor="purple"
                  onSelect={() => {}}
                  onChangeFader={(val) =>
                    sendCommand({ type: 'set_fader', target: 'bus', id: bus.id, value: val })
                  }
                  onToggleOn={() =>
                    sendCommand({ type: 'set_on', target: 'bus', id: bus.id, value: !bus.on })
                  }
                  onChangePan={(val) =>
                    sendCommand({ type: 'set_pan', target: 'bus', id: bus.id, value: val })
                  }
                  onRename={(newName) =>
                    sendCommand({ type: 'set_name', target: 'bus', id: bus.id, name: newName })
                  }
                />
              );
            })}
        </div>

        {/* Pinned MASTER STEREO L/R Strip */}
        <div className="pl-2 border-l border-slate-800/90 flex items-stretch shrink-0">
          <FaderStrip
            id={1}
            label="STEREO"
            name="MAIN L/R"
            on={state.stereo.on}
            fader={state.stereo.fader}
            savedFader={savedState?.stereo.fader}
            pan={state.stereo.pan}
            savedPan={savedState?.stereo.pan}
            meter={liveMeters.stereoMeter || state.stereo.meterOut}
            selected={false}
            accentColor="rose"
            onSelect={() => {}}
            onChangeFader={(val) =>
              sendCommand({ type: 'set_fader', target: 'stereo', id: 1, value: val })
            }
            onToggleOn={() =>
              sendCommand({
                type: 'set_on',
                target: 'stereo',
                id: 1,
                value: !state.stereo.on,
              })
            }
            onChangePan={(val) =>
              sendCommand({ type: 'set_pan', target: 'stereo', id: 1, value: val })
            }
          />
        </div>
      </div>
    </>
  );
};
