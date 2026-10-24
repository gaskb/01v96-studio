import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  API_VERSION,
  ClientCommand,
  MixerLayer,
  MixerState,
  UI_VERSION,
} from '../shared/types';
import { ChannelStripPanel } from './components/ChannelStripPanel';
import { FaderStrip } from './components/FaderStrip';

export const App: React.FC = () => {
  const [state, setState] = useState<MixerState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [layer, setLayer] = useState<MixerLayer>('ch1-16');
  const [faderFlipAux, setFaderFlipAux] = useState<number | null>(null); // null = normal faders, 1..8 = Sends on Fader!
  const [showChannelStrip, setShowChannelStrip] = useState(true);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
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
          } else if (msg.type === 'state_patch') {
            setState((prev) => (prev ? { ...prev, ...msg.patch } : prev));
          } else if (msg.type === 'channel_update') {
            setState((prev) => {
              if (!prev) return prev;
              if (msg.target === 'ch') {
                const channels = prev.channels.map((c) =>
                  c.id === msg.id ? { ...c, ...msg.changes } : c
                );
                return { ...prev, channels };
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
                meter: msg.meters[`ch${c.id}`] ?? c.meter,
              }));
              return { ...prev, channels };
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

  const visibleInputChannels =
    layer === 'ch1-16'
      ? state.channels.slice(0, 16)
      : layer === 'ch17-32'
        ? state.channels.slice(16, 32)
        : [];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080b10] text-slate-100 overflow-hidden">
      {/* TOP CONSOLE HEADER BAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#0d121b] border-b border-slate-800/90 shrink-0">
        {/* Brand & Dual Version Badges (gaskb_style) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <span className="font-mono font-bold tracking-tight text-sm sm:text-base text-white">
              YAMAHA <span className="text-cyan-400">01V96 VCM</span>
            </span>
          </div>

          {/* Hardware USB Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
              state.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {state.connected ? 'USB DIRECT LIVE' : 'SIMULATED / OFFLINE'}
          </div>

          {/* Dual Version Badges */}
          <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              UI v{UI_VERSION}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              API v{API_VERSION}
            </span>
          </div>
        </div>

        {/* Center LCD Scene Display */}
        <div className="flex items-center gap-2 bg-[#06090e] border border-slate-800 rounded-xl px-3 py-1 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase">CURRENT SCENE</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-amber-400">
                #{String(state.sceneNumber).padStart(2, '0')}
              </span>
              <span className="font-mono font-bold text-sm text-cyan-300 tracking-wide">
                {state.sceneTitle || 'Vintage'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setSceneModalOpen(true)}
            className="ml-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 border border-slate-700 cursor-pointer transition"
          >
            SCENE MEM
          </button>

          <button
            onClick={() => sendCommand({ type: 'sync_all' })}
            title="Forza la rilettura completa di tutti i parametri dal mixer"
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-cyan-300 border border-slate-800 cursor-pointer transition"
          >
            ↻ SYNC
          </button>
        </div>

        {/* Right Controls: Layer Switcher, Sends-on-Fader, Channel Strip Toggle & DEMO MODE OLA! */}
        <div className="flex items-center gap-2">
          {/* Layer Bank Selector */}
          <div className="flex bg-[#070a0f] p-0.5 rounded-lg border border-slate-800">
            {[
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
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition cursor-pointer ${
                  layer === l.id
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Toggle Channel Strip Upper Rack */}
          <button
            onClick={() => setShowChannelStrip((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
              showChannelStrip
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {showChannelStrip ? '▼ HIDE STRIP' : '▲ CHANNEL STRIP'}
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
            <span>{state.demoWaveActive ? 'STOP OLA' : 'DEMO MODE (OLA)'}</span>
          </button>
        </div>
      </header>

      {/* SENDS ON FADER BAR (Quick AUX Flip for Ch 1-16 / 17-32) */}
      {(layer === 'ch1-16' || layer === 'ch17-32') && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#0a0e16] border-b border-slate-800/80 text-xs font-mono shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-slate-500 text-[10px] mr-1">FADER MODE:</span>
            <button
              onClick={() => setFaderFlipAux(null)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                faderFlipAux === null
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              HOME (MAIN LEVEL)
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((auxId) => (
              <button
                key={auxId}
                onClick={() => setFaderFlipAux(faderFlipAux === auxId ? null : auxId)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                  faderFlipAux === auxId
                    ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : 'bg-slate-900 text-slate-400 hover:text-amber-300'
                }`}
              >
                AUX {auxId} SEND
              </button>
            ))}
          </div>

          {faderFlipAux !== null && (
            <span className="text-amber-400 text-[11px] font-bold animate-pulse">
              ⚡ SENDS ON FADER ATTIVO: I fader controllano la mandata AUX {faderFlipAux}
            </span>
          )}
        </div>
      )}

      {/* MAIN WORKSPACE: Upper Channel Strip + Lower Motorized Fader Bank */}
      <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2.5 overflow-hidden">
        {/* UPPER RACK: Full Interactive Channel Strip */}
        {showChannelStrip && (
          <div className="h-[46%] min-h-[290px] shrink-0">
            <ChannelStripPanel channel={selectedChannelObj} sendCommand={sendCommand} />
          </div>
        )}

        {/* LOWER RACK: 16 Channel Strips + Pinned Master Stereo Strip */}
        <div className="flex-1 min-h-0 flex gap-2 overflow-hidden">
          {/* Scrollable 16-Channel Bank */}
          <div className="flex-1 flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {(layer === 'ch1-16' || layer === 'ch17-32') &&
              visibleInputChannels.map((ch) => {
                const isAuxFlip = faderFlipAux !== null;
                const auxSendObj = isAuxFlip ? ch.auxSends[faderFlipAux - 1] : null;

                return (
                  <FaderStrip
                    key={ch.id}
                    id={ch.id}
                    label={`CH ${ch.id}`}
                    name={ch.name}
                    on={isAuxFlip ? (auxSendObj?.on ?? true) : ch.on}
                    solo={ch.solo}
                    fader={isAuxFlip ? (auxSendObj?.level ?? 0) : ch.fader}
                    pan={ch.pan}
                    meter={ch.meter}
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
                      sendCommand({ type: 'set_solo', target: 'ch', id: ch.id, value: !ch.solo })
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
              state.auxes.map((aux) => (
                <FaderStrip
                  key={`aux-${aux.id}`}
                  id={aux.id}
                  label={`AUX ${aux.id}`}
                  name={aux.name}
                  on={aux.on}
                  fader={aux.fader}
                  pan={aux.pan}
                  meter={aux.meter}
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
              ))}

            {layer === 'bus-master' &&
              state.buses.map((bus) => (
                <FaderStrip
                  key={`bus-${bus.id}`}
                  id={bus.id}
                  label={`BUS ${bus.id}`}
                  name={bus.name}
                  on={bus.on}
                  fader={bus.fader}
                  pan={bus.pan}
                  meter={bus.meter}
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
              ))}
          </div>

          {/* Pinned MASTER STEREO L/R Strip */}
          <div className="pl-2 border-l border-slate-800/90 flex items-stretch shrink-0">
            <FaderStrip
              id={1}
              label="STEREO"
              name="MAIN L/R"
              on={state.stereo.on}
              fader={state.stereo.fader}
              pan={state.stereo.pan}
              meter={state.stereo.meter}
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
      </div>

      {/* SCENE MEMORY MODAL */}
      {sceneModalOpen && (
        <div
          onClick={() => setSceneModalOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e131d] border border-slate-700 rounded-2xl p-5 max-w-lg w-full flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-mono font-bold text-white">
                  YAMAHA 01V96 — SCENE MEMORY RECALL
                </h2>
                <p className="text-xs text-slate-400">
                  Scena attuale: <span className="text-cyan-300 font-mono">{state.sceneTitle}</span>
                </p>
              </div>
              <button
                onClick={() => setSceneModalOpen(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto p-1">
              {Array.from({ length: 30 }, (_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sendCommand({ type: 'recall_scene', sceneNumber: idx });
                    setSceneModalOpen(false);
                  }}
                  className={`py-2.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                    state.sceneNumber === idx
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  #{String(idx).padStart(2, '0')}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
              <span>Anche le modalità OLA sono disponibili qui:</span>
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
