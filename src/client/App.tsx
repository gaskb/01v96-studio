import React, { useCallback, useState } from 'react';
import { ControlMode, WorkspaceView } from '../shared/types';
import { SingleDualChannelView } from './components/SingleDualChannelView';
import { SystemMenusPanel } from './components/SystemMenusPanel';
import { ConsoleFadersView } from './components/app/ConsoleFadersView';
import { ConsoleHeader } from './components/app/ConsoleHeader';
import { SceneModal } from './components/app/SceneModal';
import { useMixerWebSocket } from './hooks/useMixerWebSocket';

export const App: React.FC = () => {
  const { state, savedState, liveMeters, wsConnected, sendCommand } = useMixerWebSocket();
  const [controlMode, setControlMode] = useState<ControlMode>(() => {
    const stored = window.localStorage.getItem('01v96_control_mode');
    return stored === 'sliders' ? 'sliders' : 'knobs';
  });
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('console');
  const [sceneModalOpen, setSceneModalOpen] = useState(false);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setControlMode(mode);
    window.localStorage.setItem('01v96_control_mode', mode);
  }, []);

  if (!state) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080b10] text-slate-300 gap-3">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <div className="font-mono text-sm">Connessione a YAMAHA 01V96 VCM Studio Server...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080b10] text-slate-100 overflow-hidden">
      {/* TOP CONSOLE HEADER BAR */}
      <ConsoleHeader
        state={state}
        wsConnected={wsConnected}
        workspaceView={workspaceView}
        onSelectWorkspaceView={setWorkspaceView}
        onOpenSceneModal={() => setSceneModalOpen(true)}
        sendCommand={sendCommand}
      />

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2.5 overflow-hidden">
        {workspaceView === 'console' && (
          <ConsoleFadersView
            state={state}
            savedState={savedState}
            liveMeters={liveMeters}
            controlMode={controlMode}
            onChangeControlMode={handleControlModeChange}
            sendCommand={sendCommand}
          />
        )}

        {workspaceView === 'channel-overview' && (
          <SingleDualChannelView
            state={state}
            savedState={savedState}
            liveMeters={liveMeters}
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
        <SceneModal
          state={state}
          onClose={() => setSceneModalOpen(false)}
          sendCommand={sendCommand}
        />
      )}
    </div>
  );
};

export default App;
