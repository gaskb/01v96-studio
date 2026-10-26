import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  API_VERSION,
  ClientCommand,
  ControlMode,
  MixerLayer,
  MixerState,
  UI_VERSION,
  WorkspaceView,
} from '../shared/types';
import { FaderStrip } from './components/FaderStrip';
import { SelectedChannelRack } from './components/SelectedChannelRack';
import { SingleDualChannelView } from './components/SingleDualChannelView';
import { SystemMenusPanel } from './components/SystemMenusPanel';

export const App: React.FC = () => {
  const [state, setState] = useState<MixerState | null>(null);
  const [savedState, setSavedState] = useState<MixerState | null>(null);
  const [controlMode, setControlMode] = useState<ControlMode>(() => {
    const stored = window.localStorage.getItem('01v96_control_mode');
    return stored === 'sliders' ? 'sliders' : 'knobs';
  });
  const [wsConnected, setWsConnected] = useState(false);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setControlMode(mode);
    window.localStorage.setItem('01v96_control_mode', mode);
  }, []);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('console');
  const [layer, setLayer] = useState<MixerLayer>('all32');
  const [faderFlipAux, setFaderFlipAux] = useState<number | null>(null);
  const [showChannelStrip, setShowChannelStrip] = useState(true);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [storeTitleDraft, setStoreTitleDraft] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWs = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'full_state') {
            setState(msg.state);
            setSavedState(structuredClone(msg.state));
          } else if (msg.type === 'state_patch') {
            setState((prev) => {
              if (!prev) return prev;
              const next = { ...prev, ...msg.patch };
              if (
                msg.patch.sceneNumber !== undefined &&
                msg.patch.sceneNumber !== prev.sceneNumber
              ) {
                setSavedState(structuredClone(next));
              }
              return next;
            });
          } else if (msg.type === 'channel_update') {
            setState((prev) => {
              if (!prev) return prev;
              if (msg.target === 'ch') {
                const channels = prev.channels.map((c) =>
                  c.id === msg.id ? { ...c, ...msg.changes } : c
                );
                const savedChannels = msg.savedChannel
                  ? (prev.savedChannels ?? prev.channels).map((c) =>
                      c.id === msg.id ? msg.savedChannel : c
                    )
                  : prev.savedChannels;
                return { ...prev, channels, savedChannels };
              }
              if (msg.target === 'aux') {
                const auxes = prev.auxes.map((a) =>
                  a.id === msg.id ? { ...a, ...msg.changes } : a
                );
                return { ...prev, auxes };
              }
              if (msg.target === 'bus') {
                const buses = prev.buses.map((b) =>
                  b.id === msg.id ? { ...b, ...msg.changes } : b
                );
                return { ...prev, buses };
              }
              if (msg.target === 'stereo') {
                return { ...prev, stereo: { ...prev.stereo, ...msg.changes } };
              }
              return prev;
            });
          } else if (msg.type === 'meters') {
            setState((prev) => {
              if (!prev) return prev;
              const channels = prev.channels.map((c) => ({
                ...c,
                meterIn: msg.metersIn?.[`ch${c.id}`] ?? c.meterIn,
                meterOut: msg.metersOut?.[`ch${c.id}`] ?? c.meterOut,
                grDb: msg.grs?.[`ch${c.id}`] ?? c.grDb,
              }));
              const stereo = {
                ...prev.stereo,
                meterOut: msg.stereoMeter ?? prev.stereo.meterOut,
                meterIn: msg.stereoMeter ?? prev.stereo.meterIn,
              };
              return { ...prev, channels, stereo };
            });
          } else if (msg.type === 'wave_frame') {
            setState((prev) => {
              if (!prev) return prev;
              const channels = prev.channels.map((c) =>
                msg.faders[c.id] !== undefined ? { ...c, fader: msg.faders[c.id] } : c
              );
              return { ...prev, channels };
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 1500);
      };
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const sendCommand = useCallback((cmd: ClientCommand) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    } else {
      fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      }).catch(() => {});
    }
  }, []);

  if (!state) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080b10] text-slate-300 gap-3">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <div className="font-mono text-sm">Connessione a YAMAHA 01V96 VCM Studio Server...</div>
      </div>
    );
  }

  const selectedChannelObj =
    state.channels.find((c) => c.id === state.selectedChannel) ?? state.channels[0];
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
    <div className="h-screen w-screen flex flex-col bg-[#080b10] text-slate-100 overflow-hidden">
      {/* TOP CONSOLE HEADER BAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#0d121b] border-b border-slate-800/90 shrink-0">
        {/* Brand & Dual Version Badges (gaskb_style) */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <span className="font-mono font-bold tracking-tight text-sm sm:text-base text-white">
              YAMAHA <span className="text-cyan-400">01V96 VCM</span>
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
              state.connected && wsConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state.connected && wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {state.connected ? 'USB DIRECT LIVE' : 'SIMULATED / OFFLINE'}
          </div>

          <div className="hidden 2xl:flex items-center gap-1 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              UI v{UI_VERSION}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              API v{API_VERSION}
            </span>
          </div>
        </div>

        {/* WORKSPACE VIEW NAVIGATION (Console, Single/Dual Strip, Effects/GEQ, Patch I/O, Setup/LCD) */}
        <div className="flex items-center gap-1 bg-[#06090e] p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'console', label: '🎚️ MIXER CONSOLE' },
            { id: 'channel-overview', label: '🔍 CH STRIP / COPPIA' },
            { id: 'effects-geq', label: '✨ EFFECT & GEQ' },
            { id: 'patch-io', label: '🔌 PATCH / I/O' },
            { id: 'setup-lcd', label: '⚙️ SETUP & LCD' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setWorkspaceView(v.id as WorkspaceView)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer whitespace-nowrap ${
                workspaceView === v.id
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Right Controls: Scene Display + Sync + Demo Ola */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => {
              setStoreTitleDraft(state.sceneTitle);
              setSceneModalOpen(true);
            }}
            title="Clicca per aprire la lista Scene (Recall / Store)"
            className="flex items-center gap-2 bg-[#06090e] hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-xl px-3 py-1 cursor-pointer transition"
          >
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-slate-500 uppercase">SCENE MEMORY</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-amber-400">
                  #{String(state.sceneNumber).padStart(2, '0')}
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm text-cyan-300">
                  {state.sceneTitle || 'Vintage'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => sendCommand({ type: 'sync_all' })}
            title="Rileggi stato completo dal mixer"
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono text-cyan-300 border border-slate-800 cursor-pointer"
          >
            ↻ SYNC
          </button>

          {/* 🌊 DEMO MODE (OLA) BUTTON */}
          <button
            onClick={() =>
              sendCommand({
                type: 'trigger_demo_wave',
                mode: state.demoWaveActive ? 'stop' : 'sine',
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              state.demoWaveActive
                ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-cyan-500 text-slate-950 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.7)]'
                : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
            }`}
          >
            <span>🌊</span>
            <span>{state.demoWaveActive ? 'STOP OLA' : 'DEMO MODE'}</span>
          </button>
        </div>
      </header>

      {/* SUB-BAR FOR CONSOLE VIEW: Layer Bank & Sends-on-Fader */}
      {workspaceView === 'console' && (
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
              {[1, 2, 3, 4, 5, 6, 7, 8].map((auxId) => (
                <button
                  key={auxId}
                  onClick={() => setFaderFlipAux(faderFlipAux === auxId ? null : auxId)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    faderFlipAux === auxId
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'bg-slate-900 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  AUX {auxId}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2.5 overflow-hidden">
        {workspaceView === 'console' && (
          <>
            {showChannelStrip && (
              <div className="shrink-0">
                <SelectedChannelRack
                  channel={selectedChannelObj}
                  savedChannel={savedSelectedChannelObj}
                  controlMode={controlMode}
                  onChangeControlMode={handleControlModeChange}
                  sendCommand={sendCommand}
                />
              </div>
            )}

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
                        meter={ch.meterOut || ch.meterIn}
                        selected={state.selectedChannel === ch.id}
                        accentColor={isAuxFlip ? 'amber' : 'cyan'}
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
                          sendCommand({ type: 'set_name', id: ch.id, name: newName })
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
                  meter={state.stereo.meterOut}
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
        )}

        {workspaceView === 'channel-overview' && (
          <SingleDualChannelView
            state={state}
            savedState={savedState}
            controlMode={controlMode}
            onChangeControlMode={handleControlModeChange}
            sendCommand={sendCommand}
          />
        )}

        {(workspaceView === 'effects-geq' ||
          workspaceView === 'patch-io' ||
          workspaceView === 'setup-lcd') && (
          <SystemMenusPanel mode={workspaceView} state={state} sendCommand={sendCommand} />
        )}
      </div>

      {/* SCENE MEMORY MODAL (RECALL & STORE) */}
      {sceneModalOpen && (
        <div
          onClick={() => setSceneModalOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e131d] border border-slate-700 rounded-2xl p-5 max-w-xl w-full flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-mono font-bold text-white">
                  YAMAHA 01V96 — SCENE MEMORY (RECALL & STORE)
                </h2>
                <p className="text-xs text-slate-400">
                  Scena attuale: <span className="text-amber-400 font-mono">#{String(state.sceneNumber).padStart(2, '0')}</span>{' '}
                  <span className="text-cyan-300 font-mono font-bold">{state.sceneTitle}</span>
                </p>
              </div>
              <button
                onClick={() => setSceneModalOpen(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Store Current Scene Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-[#080b11] border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-mono text-slate-400">NOME SCENA:</span>
              <input
                type="text"
                maxLength={16}
                value={storeTitleDraft}
                onChange={(e) => setStoreTitleDraft(e.target.value)}
                placeholder="Nome scena (max 16 chr)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 outline-none"
              />
              <button
                onClick={() => {
                  sendCommand({
                    type: 'store_scene',
                    sceneNumber: state.sceneNumber,
                    title: storeTitleDraft,
                  });
                  setSceneModalOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono font-bold text-xs cursor-pointer transition"
              >
                💾 STORE ON #{String(state.sceneNumber).padStart(2, '0')}
              </button>
            </div>

            {/* Recall Grid */}
            <div>
              <div className="text-[11px] font-mono text-slate-400 mb-2">
                CLICCA UNO SLOT PER RICHIAMARE LA SCENA (RECALL):
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-1">
                {Array.from({ length: 36 }, (_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      sendCommand({ type: 'recall_scene', sceneNumber: idx });
                      setSceneModalOpen(false);
                    }}
                    className={`py-2.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                      state.sceneNumber === idx
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    #{String(idx).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
              <span>Coreografie Fader (Demo Mode):</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'sine' });
                    setSceneModalOpen(false);
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-pointer"
                >
                  🌊 Sine Wave
                </button>
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'bounce' });
                    setSceneModalOpen(false);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer"
                >
                  ⚡ Knight Rider
                </button>
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'v-shape' });
                    setSceneModalOpen(false);
                  }}
                  className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 cursor-pointer"
                >
                  💠 V-Ripple
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
