import React, { useState } from 'react';
import { ClientCommand, MixerState } from '../../../shared/types';

interface SceneModalProps {
  state: MixerState;
  onClose: () => void;
  sendCommand: (cmd: ClientCommand) => void;
}

export const SceneModal: React.FC<SceneModalProps> = ({
  state,
  onClose,
  sendCommand,
}) => {
  const [storeTitleDraft, setStoreTitleDraft] = useState(state.sceneTitle);

  return (
    <div
      onClick={onClose}
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
              Scena attuale:{' '}
              <span className="text-amber-400 font-mono">
                #{String(state.sceneNumber).padStart(2, '0')}
              </span>{' '}
              <span className="text-cyan-300 font-mono font-bold">{state.sceneTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
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
              onClose();
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
                  onClose();
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
                onClose();
              }}
              className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-pointer"
            >
              🌊 Sine Wave
            </button>
            <button
              onClick={() => {
                sendCommand({ type: 'trigger_demo_wave', mode: 'bounce' });
                onClose();
              }}
              className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer"
            >
              ⚡ Knight Rider
            </button>
            <button
              onClick={() => {
                sendCommand({ type: 'trigger_demo_wave', mode: 'v-shape' });
                onClose();
              }}
              className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 cursor-pointer"
            >
              💠 V-Ripple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
