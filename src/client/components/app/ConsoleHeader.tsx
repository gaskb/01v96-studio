import React from 'react';
import {
  API_VERSION,
  ClientCommand,
  MixerState,
  UI_VERSION,
  WorkspaceView,
} from '../../../shared/types';

interface ConsoleHeaderProps {
  state: MixerState;
  wsConnected: boolean;
  workspaceView: WorkspaceView;
  onSelectWorkspaceView: (view: WorkspaceView) => void;
  onOpenSceneModal: () => void;
  sendCommand: (cmd: ClientCommand) => void;
}

export const ConsoleHeader: React.FC<ConsoleHeaderProps> = ({
  state,
  wsConnected,
  workspaceView,
  onSelectWorkspaceView,
  onOpenSceneModal,
  sendCommand,
}) => {
  return (
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

      {/* WORKSPACE VIEW NAVIGATION */}
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
            onClick={() => onSelectWorkspaceView(v.id as WorkspaceView)}
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
          onClick={onOpenSceneModal}
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
  );
};
