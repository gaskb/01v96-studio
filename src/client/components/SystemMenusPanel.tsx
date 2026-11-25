import React, { useState } from 'react';
import { ClientCommand, MixerState } from '../../shared/types';
import { MixerDiagnosticsCard } from './MixerDiagnosticsCard';

interface SystemMenusPanelProps {
  mode: 'effects-geq' | 'patch-io' | 'setup-lcd';
  state: MixerState;
  sendCommand: (cmd: ClientCommand) => void;
}

const GEQ_FREQS = [
  '20', '25', '31.5', '40', '50', '63', '80', '100', '125', '160',
  '200', '250', '315', '400', '500', '630', '800', '1k', '1.25k', '1.6k',
  '2k', '2.5k', '3.15k', '4k', '5k', '6.3k', '8k', '10k', '12.5k', '16k', '20k',
];

const INPUT_SOURCES = [
  ...Array.from({ length: 16 }, (_, i) => ({ id: i, label: `AD ${i + 1} (Analog)` })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: 16 + i, label: `ADAT ${i + 1} (Optical)` })),
  ...Array.from({ length: 16 }, (_, i) => ({ id: 24 + i, label: `SLOT ${i + 1} (MY Card)` })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: 40 + i, label: `EFF ${i + 1} RTN L` })),
];

const OMNI_OUT_SOURCES = [
  { id: 0, label: 'STEREO L' },
  { id: 1, label: 'STEREO R' },
  ...Array.from({ length: 8 }, (_, i) => ({ id: 2 + i, label: `AUX ${i + 1}` })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: 10 + i, label: `BUS ${i + 1}` })),
];

const LCD_SCREENS = [
  { id: 1, group: 'VIEW / HOME', label: 'FADER STATUS / METER' },
  { id: 2, group: 'SCENE', label: 'SCENE MEMORY LIST' },
  { id: 3, group: 'SCENE', label: 'FADE TIME & RECALL SAFE' },
  { id: 4, group: 'EQ / ATT', label: '4-BAND EQ GRAPH' },
  { id: 5, group: 'DYNAMICS', label: 'GATE & COMPRESSOR' },
  { id: 6, group: 'AUX / PAN', label: 'AUX SEND & ROUTING' },
  { id: 7, group: 'EFFECT', label: 'EFFECT 1-4 VCM RACK' },
  { id: 8, group: 'GEQ', label: '31-BAND GRAPHIC EQ' },
  { id: 9, group: 'PATCH / I/O', label: 'INPUT PATCH 1-32' },
  { id: 10, group: 'PATCH / I/O', label: 'OUTPUT PATCH & INSERT' },
  { id: 11, group: 'DIO / SETUP', label: 'WORD CLOCK & SLOT SETUP' },
  { id: 12, group: 'MIDI / HOST', label: 'MIDI & USB HOST SETUP' },
  { id: 13, group: 'UTILITY', label: 'PREFERENCES & OSCILLATOR' },
];

export const SystemMenusPanel: React.FC<SystemMenusPanelProps> = ({
  mode,
  state,
  sendCommand,
}) => {
  const [selectedGeqUnit, setSelectedGeqUnit] = useState(1);
  const [confirmPushOpen, setConfirmPushOpen] = useState(false);
  const [storeOnPush, setStoreOnPush] = useState(true);
  const currentGeq = state.geqs[selectedGeqUnit - 1] ?? state.geqs[0];
  const glideSpeed = state.studioSettings?.faderGlideDbPerSec ?? 6;
  const activeSlowCount = state.channels.filter((c) => c.slow).length;

  if (mode === 'effects-geq') {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-1">
        {/* 4 VCM / REV-X Effect Processors */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase">
                🎛️ INTERNAL VCM & REV-X EFFECTS RACK (EFF 1 - 4)
              </h2>
              <p className="text-xs text-slate-400">
                Controllo diretto dei 4 processori multi-effetto interni dello 01V96 VCM
              </p>
            </div>
            <button
              onClick={() => sendCommand({ type: 'set_lcd_screen', screenNo: 7 })}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700 cursor-pointer"
            >
              📺 APRI EFF SUL DISPLAY DEL MIXER
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {state.effects.map((fx) => (
              <div
                key={fx.id}
                className="bg-[#080b11] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500">PROCESSOR #{fx.id}</span>
                    <div className="text-sm font-mono font-bold text-amber-300">{fx.name}</div>
                  </div>
                  <button
                    onClick={() =>
                      sendCommand({
                        type: 'set_effect',
                        rackId: fx.id,
                        param: 'bypass',
                        value: !fx.bypass,
                      })
                    }
                    className={`px-3 py-1 rounded text-xs font-mono font-bold cursor-pointer transition ${
                      !fx.bypass
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {fx.bypass ? 'BYPASSED' : 'ACTIVE'}
                  </button>
                </div>

                {/* Mix Balance */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>DRY / WET MIX</span>
                    <span className="text-cyan-300">{fx.mix}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fx.mix}
                    onChange={(e) =>
                      sendCommand({
                        type: 'set_effect',
                        rackId: fx.id,
                        param: 'mix',
                        value: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Primary Parameters 1..4 */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-800/80">
                  {(['param1', 'param2', 'param3', 'param4'] as const).map((pKey, idx) => (
                    <div key={pKey}>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                        <span>PARAM {idx + 1}</span>
                        <span className="text-slate-200">{fx.params[idx] ?? 50}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={127}
                        value={fx.params[idx] ?? 50}
                        onChange={(e) =>
                          sendCommand({
                            type: 'set_effect',
                            rackId: fx.id,
                            param: pKey,
                            value: Number(e.target.value),
                          })
                        }
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 31-Band Graphic EQ Rack (GEQ 1-4) */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-mono font-bold text-emerald-400 uppercase">
                📊 31-BAND GRAPHIC EQ (GEQ {selectedGeqUnit})
              </h2>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
                {[1, 2, 3, 4].map((u) => (
                  <button
                    key={u}
                    onClick={() => setSelectedGeqUnit(u)}
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold cursor-pointer ${
                      selectedGeqUnit === u
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    GEQ {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_geq',
                    unitId: selectedGeqUnit,
                    param: 'on',
                    value: !currentGeq.on,
                  })
                }
                className={`px-3 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                  currentGeq.on ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                GEQ {currentGeq.on ? 'IN (ON)' : 'BYPASS'}
              </button>
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_geq',
                    unitId: selectedGeqUnit,
                    param: 'flat',
                    value: true,
                  })
                }
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 cursor-pointer"
              >
                FLAT ALL 31 BANDS
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-3 px-2 bg-[#070a0f] border border-slate-800 rounded-xl">
            {GEQ_FREQS.map((freqLabel, bIdx) => {
              const val = currentGeq.bands[bIdx] ?? 0;
              return (
                <div
                  key={freqLabel}
                  className="flex flex-col items-center min-w-[32px] gap-1.5 select-none"
                >
                  <span className="text-[9px] font-mono text-cyan-300">
                    {(val / 10).toFixed(0)}
                  </span>
                  <div className="h-36 flex items-center justify-center">
                    <input
                      type="range"
                      min={-150}
                      max={150}
                      value={val}
                      onChange={(e) =>
                        sendCommand({
                          type: 'set_geq',
                          unitId: selectedGeqUnit,
                          param: 'band',
                          bandIndex: bIdx,
                          value: Number(e.target.value),
                        })
                      }
                      onDoubleClick={() =>
                        sendCommand({
                          type: 'set_geq',
                          unitId: selectedGeqUnit,
                          param: 'band',
                          bandIndex: bIdx,
                          value: 0,
                        })
                      }
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                      className="h-32 accent-emerald-400 cursor-pointer"
                    />
                  </div>
                  <span className="text-[8px] font-mono text-slate-400">{freqLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'patch-io') {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-1">
        {/* OMNI OUT 1-4 PATCH */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-mono font-bold text-amber-400 uppercase">
                🔌 OMNI OUT 1-4 PHYSICAL OUTPUT PATCH
              </h2>
              <p className="text-xs text-slate-400">
                Assegna i bus interni (AUX, BUS, STEREO) alle 4 uscite analogiche TRS OMNI OUT del mixer
              </p>
            </div>
            <button
              onClick={() => sendCommand({ type: 'set_lcd_screen', screenNo: 10 })}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-amber-300 border border-slate-700 cursor-pointer"
            >
              📺 APRI OUT PATCH SUL MIXER
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((omniId) => (
              <div
                key={omniId}
                className="bg-[#070a0f] border border-slate-800 rounded-xl p-3 flex flex-col gap-2"
              >
                <span className="text-xs font-mono font-bold text-amber-300">
                  OMNI OUT {omniId}
                </span>
                <select
                  value={state.setup.omniOutPatch[omniId - 1] ?? omniId}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_omni_patch',
                      omniId,
                      sourceBus: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 outline-none"
                >
                  {OMNI_OUT_SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* INPUT PATCH MATRIX (CH 1-32) */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase">
                🔀 INPUT PATCH MATRIX (CANALI 1 - 32)
              </h2>
              <p className="text-xs text-slate-400">
                Scegli quale ingresso fisico (AD 1-16, ADAT 1-8, SLOT MY 1-16) alimenta ciascun canale del mixer
              </p>
            </div>
            <button
              onClick={() => sendCommand({ type: 'set_lcd_screen', screenNo: 9 })}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700 cursor-pointer"
            >
              📺 APRI IN PATCH SUL MIXER
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
            {state.channels.map((ch) => (
              <div
                key={ch.id}
                className="bg-[#070a0f] border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-cyan-300">CH {ch.id}</span>
                  <span className="text-[10px] text-slate-400">{ch.name}</span>
                </div>
                <select
                  value={ch.inputPatch}
                  onChange={(e) =>
                    sendCommand({
                      type: 'set_input_patch',
                      chId: ch.id,
                      sourcePort: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] font-mono text-slate-200 outline-none"
                >
                  {INPUT_SOURCES.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // mode === 'setup-lcd'
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-1">
      {/* Studio Configuration & Offline Workflow Panel */}
      <MixerDiagnosticsCard state={state} sendCommand={sendCommand} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Studio Fader Glide / Slow Speed Config */}
        <div className="bg-[#0c1018] border border-indigo-500/30 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-mono font-bold text-indigo-300 uppercase">
                🎛️ STUDIO SETTINGS — FADER GLIDE (SLW)
              </h2>
              <p className="text-xs text-slate-400">
                Limita la velocità di movimento degli slider quando il pulsante SLW è attivo
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 font-mono font-bold text-xs text-indigo-200">
              {glideSpeed} dB/s
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>VELOCITÀ MASSIMA SLIDER</span>
              <span className="text-indigo-300">
                Da -20 dB a 0 dB in {(20 / Math.max(1, glideSpeed)).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={glideSpeed}
              onChange={(e) =>
                sendCommand({
                  type: 'set_studio_settings',
                  faderGlideDbPerSec: Number(e.target.value),
                })
              }
              className="w-full accent-indigo-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
              <span>1 dB/s (Lento)</span>
              <span>6 dB/s (Default)</span>
              <span>15 dB/s (Medio)</span>
              <span>30 dB/s (Rapido)</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] font-mono text-slate-400">
              Canali con SLW attivo:{' '}
              <strong className="text-indigo-300">{activeSlowCount}/32</strong>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => sendCommand({ type: 'set_all_slow', value: true })}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[11px] font-mono font-bold cursor-pointer transition"
              >
                ATTIVA SLW TUTTI
              </button>
              <button
                onClick={() => sendCommand({ type: 'set_all_slow', value: false })}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-bold cursor-pointer transition"
              >
                DISATTIVA TUTTI
              </button>
            </div>
          </div>
        </div>

        {/* Hardware Sync & Offline-to-Live Push */}
        <div className="bg-[#0c1018] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase">
                🔄 OFFLINE WORKFLOW & HARDWARE SYNC
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  state.connected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                {state.connected ? 'USB CONNESSO' : 'OFFLINE / SIMULATO'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Scarica la scena corrente dal banco per lavorarci offline a mixer spento, oppure invia
              l&apos;intera configurazione locale (Fader, EQ, Dinamica, Mandate, Routing) al mixer fisico.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => sendCommand({ type: 'pull_from_hardware' })}
              disabled={!state.connected}
              className={`py-2.5 px-3 rounded-xl font-mono font-bold text-xs border transition flex items-center justify-center gap-2 ${
                state.connected
                  ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/40 cursor-pointer'
                  : 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
            >
              <span>📥</span>
              <span>SCARICA DAL BANCO (PULL)</span>
            </button>

            <button
              onClick={() => setConfirmPushOpen(true)}
              disabled={!state.connected}
              className={`py-2.5 px-3 rounded-xl font-mono font-bold text-xs border transition flex items-center justify-center gap-2 ${
                state.connected
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
            >
              <span>📤</span>
              <span>INVIA AL BANCO (PUSH)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Full Hardware Push */}
      {confirmPushOpen && (
        <div
          onClick={() => setConfirmPushOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e131d] border border-amber-500/60 rounded-2xl p-5 max-w-md w-full flex flex-col gap-4 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
          >
            <div className="flex items-center gap-3 text-amber-400">
              <span className="text-2xl">📤</span>
              <h3 className="font-mono font-bold text-sm text-white">
                CONFERMA INVIO COMPLETO AL MIXER
              </h3>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Verranno inviati tutti i parametri della scena corrente (<strong>#{String(state.sceneNumber).padStart(2, '0')} {state.sceneTitle}</strong>)
              al mixer fisico Yamaha 01V96 via USB: Fader motorizzati, EQ, Gate, Compressori, Mandate Aux, Routing e Nomi.
            </p>
            <label className="flex items-center gap-2 text-xs font-mono text-cyan-300 cursor-pointer">
              <input
                type="checkbox"
                checked={storeOnPush}
                onChange={(e) => setStoreOnPush(e.target.checked)}
                className="accent-cyan-400"
              />
              Salva (Store) anche nello slot scena #{String(state.sceneNumber).padStart(2, '0')} del mixer
            </label>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmPushOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setConfirmPushOpen(false);
                  sendCommand({ type: 'push_to_hardware', storeToScene: storeOnPush });
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs cursor-pointer transition"
              >
                Invia Configurazione
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote Hardware LCD Screen Navigator */}
      <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4">
        <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase mb-1">
          📺 TELECOMANDO MENU DISPLAY LCD DELLO 01V96
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          Clicca una schermata per commutarla fisicamente sul display LCD integrato del tuo mixer 01V96 VCM
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {LCD_SCREENS.map((scr) => (
            <button
              key={scr.id}
              onClick={() => sendCommand({ type: 'set_lcd_screen', screenNo: scr.id })}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                state.setup.lcdScreenNo === scr.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_14px_rgba(34,211,238,0.25)]'
                  : 'bg-[#070a0f] border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{scr.group}</span>
              <span className="text-xs font-mono font-bold">{scr.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* DIO / WordClock, Metering Point & LCD Contrast Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Metering Point Setup */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase">
            📊 METERING POINT & PEAK HOLD
          </h3>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-slate-400">INPUT METER POSITION:</span>
            <div className="flex gap-1.5">
              {[
                { id: 0, label: 'PRE EQ' },
                { id: 1, label: 'PRE FADER' },
                { id: 2, label: 'POST ON' },
              ].map((pt) => (
                <button
                  key={pt.id}
                  onClick={() =>
                    sendCommand({
                      type: 'set_setup_param',
                      param: 'meterInputPoint',
                      value: pt.id,
                    })
                  }
                  className={`flex-1 py-1.5 rounded text-xs font-mono font-bold cursor-pointer ${
                    state.setup.meterInputPoint === pt.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs font-mono text-slate-300">PEAK HOLD SUL MIXER</span>
            <button
              onClick={() =>
                sendCommand({
                  type: 'set_setup_param',
                  param: 'peakHold',
                  value: !state.setup.peakHold,
                })
              }
              className={`px-3 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                state.setup.peakHold ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {state.setup.peakHold ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Word Clock Master */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-mono font-bold text-amber-400 uppercase">
            ⏱️ DIO / WORD CLOCK MASTER
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 0, label: 'INT 44.1 kHz' },
              { id: 1, label: 'INT 48 kHz' },
              { id: 2, label: 'INT 88.2 kHz' },
              { id: 3, label: 'INT 96 kHz' },
              { id: 4, label: 'ADAT OPTICAL' },
              { id: 5, label: 'WORD CLOCK IN' },
            ].map((wc) => (
              <button
                key={wc.id}
                onClick={() =>
                  sendCommand({
                    type: 'set_setup_param',
                    param: 'wordClockMaster',
                    value: wc.id,
                  })
                }
                className={`py-2 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                  state.setup.wordClockMaster === wc.id
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {wc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hardware Panel Preferences */}
        <div className="bg-[#0c1018] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <h3 className="text-xs font-mono font-bold text-purple-300 uppercase">
            🔆 DISPLAY LCD CONTRAST / BRIGHTNESS
          </h3>
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
              <span>LCD CONTRAST</span>
              <span className="text-slate-200">{state.setup.brightness}</span>
            </div>
            <input
              type="range"
              min={0}
              max={127}
              value={state.setup.brightness}
              onChange={(e) =>
                sendCommand({
                  type: 'set_setup_param',
                  param: 'brightness',
                  value: Number(e.target.value),
                })
              }
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Regola in tempo reale il contrasto del pannello LCD fisico dello 01V96 VCM.
          </p>
        </div>
      </div>
    </div>
  );
};
