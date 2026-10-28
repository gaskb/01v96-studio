import React, { useEffect, useState } from 'react';
import {
  ClientCommand,
  MixerBackupPackage,
  MixerState,
  RestorePlan,
  RestoreRequest,
} from '../../../shared/types';

interface SceneModalProps {
  state: MixerState;
  onClose: () => void;
  sendCommand: (cmd: ClientCommand) => void;
}

interface SceneInfo {
  sceneNumber: number;
  title: string;
  hasArchive: boolean;
  hasLabels: boolean;
  isCurrent: boolean;
}

export const SceneModal: React.FC<SceneModalProps> = ({
  state,
  onClose,
  sendCommand,
}) => {
  const [activeTab, setActiveTab] = useState<'memory' | 'export' | 'restore'>('memory');
  const [storeTitleDraft, setStoreTitleDraft] = useState(state.sceneTitle);
  const [confirmStoreOpen, setConfirmStoreOpen] = useState(false);

  // Export State
  const [availableScenes, setAvailableScenes] = useState<SceneInfo[]>([]);
  const [selectedScenesForExport, setSelectedScenesForExport] = useState<Set<number>>(
    new Set([state.sceneNumber])
  );
  const [includeGlobalExport, setIncludeGlobalExport] = useState(true);
  const [exportName, setExportName] = useState(
    `01v96_backup_${new Date().toISOString().slice(0, 10)}`
  );
  const [isExporting, setIsExporting] = useState(false);

  // Restore State
  const [importedPackage, setImportedPackage] = useState<MixerBackupPackage | null>(null);
  const [restoreGlobalFlag, setRestoreGlobalFlag] = useState(true);
  const [restoreHardwareFlag, setRestoreHardwareFlag] = useState(false);
  const [selectedScenesForRestore, setSelectedScenesForRestore] = useState<Record<number, boolean>>({});
  const [sceneTargetMapping, setSceneTargetMapping] = useState<Record<number, number>>({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

  // Fetch available scenes from server
  const loadSceneList = async () => {
    try {
      const res = await fetch('/api/scenes');
      if (res.ok) {
        const data: SceneInfo[] = await res.json();
        setAvailableScenes(data);
        // Default select all available scenes for export
        const sceneNums = new Set<number>(data.map((s) => s.sceneNumber));
        sceneNums.add(state.sceneNumber);
        setSelectedScenesForExport(sceneNums);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSceneList();
  }, []);

  // Handle Export Download
  const handleDownloadBackup = async () => {
    setIsExporting(true);
    try {
      const scenesQuery = Array.from(selectedScenesForExport).join(',');
      const url = `/api/backup?scenes=${encodeURIComponent(
        scenesQuery
      )}&includeGlobal=${includeGlobalExport}&download=true&name=${encodeURIComponent(
        exportName
      )}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Errore durante la generazione del backup');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${exportName || '01v96_backup'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Errore esportazione: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Upload for Restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreErrorMsg(null);
    setRestoreStatusMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.format !== '01v96-studio-backup' || !parsed.scenes) {
          throw new Error('Formato non valido: il file non è un backup di 01V96 Studio');
        }
        setImportedPackage(parsed);

        // Prepopulate mapping 1-to-1 and select all by default
        const initialSelected: Record<number, boolean> = {};
        const initialMapping: Record<number, number> = {};
        for (const [key, sceneData] of Object.entries(parsed.scenes)) {
          const num = Number(key);
          initialSelected[num] = true;
          initialMapping[num] = (sceneData as { number: number }).number ?? num;
        }
        setSelectedScenesForRestore(initialSelected);
        setSceneTargetMapping(initialMapping);
        setRestoreGlobalFlag(!!parsed.global);
      } catch (err) {
        setRestoreErrorMsg((err as Error).message);
        setImportedPackage(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore Plan
  const handleExecuteRestore = async () => {
    if (!importedPackage) return;
    setIsRestoring(true);
    setRestoreErrorMsg(null);
    setRestoreStatusMsg('Ripristino in corso...');

    try {
      const restoreScenesList: RestorePlan['scenes'] = [];
      for (const [srcNumStr, isSelected] of Object.entries(selectedScenesForRestore)) {
        const srcNum = Number(srcNumStr);
        if (isSelected) {
          restoreScenesList.push({
            sourceSceneNumber: srcNum,
            targetSceneNumber: sceneTargetMapping[srcNum] ?? srcNum,
          });
        }
      }

      if (restoreScenesList.length === 0 && !restoreGlobalFlag) {
        throw new Error('Nessuna scena o impostazione selezionata per il ripristino.');
      }

      const payload: RestoreRequest = {
        package: importedPackage,
        plan: {
          restoreGlobal: restoreGlobalFlag,
          writeHardware: restoreHardwareFlag,
          scenes: restoreScenesList,
        },
      };

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante il ripristino del backup');
      }

      setRestoreStatusMsg(
        `✅ ${data.message || 'Ripristino completato con successo!'}`
      );
      loadSceneList();
    } catch (err) {
      setRestoreErrorMsg((err as Error).message);
      setRestoreStatusMsg(null);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0e131d] border border-slate-700 rounded-2xl p-5 max-w-2xl w-full flex flex-col gap-4 shadow-2xl max-h-[92vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <span>🎚️</span>
              <span>YAMAHA 01V96 — GESTORE SCENE & BACKUP SHOW</span>
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
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition"
          >
            ESC
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono font-bold shrink-0">
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
              activeTab === 'memory'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎛️ MEMORIE SCENA (RECALL/STORE)
          </button>
          <button
            onClick={() => {
              setActiveTab('export');
              loadSceneList();
            }}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
              activeTab === 'export'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💾 ESPORTA BACKUP
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
              activeTab === 'restore'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📂 RIPRISTINA BACKUP
          </button>
        </div>

        {/* TAB 1: MEMORY RECALL & STORE */}
        {activeTab === 'memory' && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
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
                onClick={() => setConfirmStoreOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono font-bold text-xs cursor-pointer transition shadow-[0_0_12px_rgba(244,63,94,0.4)]"
              >
                💾 STORE ON #{String(state.sceneNumber).padStart(2, '0')}
              </button>
            </div>

            {/* Confirmation Dialog for Scene Store */}
            {confirmStoreOpen && (
              <div className="bg-rose-950/40 border border-rose-500/60 rounded-xl p-3 flex flex-col gap-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold">
                  <span>⚠️</span>
                  <span>CONFERMA SOVRASCRITTURA SCENA #{String(state.sceneNumber).padStart(2, '0')}</span>
                </div>
                <p className="text-[11px] font-mono text-slate-300">
                  Sei sicuro di voler sovrascrivere lo slot #{state.sceneNumber} sul mixer con il titolo &quot;
                  <span className="text-cyan-300 font-bold">{storeTitleDraft || state.sceneTitle}</span>&quot;?
                  Le impostazioni precedentemente salvate in questo slot verranno rimpiazzate.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmStoreOpen(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => {
                      setConfirmStoreOpen(false);
                      sendCommand({
                        type: 'store_scene',
                        sceneNumber: state.sceneNumber,
                        title: storeTitleDraft,
                      });
                      onClose();
                    }}
                    className="px-3 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition"
                  >
                    Conferma Sovrascrittura
                  </button>
                </div>
              </div>
            )}

            {/* Recall Grid */}
            <div>
              <div className="text-[11px] font-mono text-slate-400 mb-2 flex justify-between">
                <span>CLICCA UNO SLOT PER RICHIAMARE LA SCENA (RECALL):</span>
                <span>(00 = Initial Data)</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                {Array.from({ length: 36 }, (_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      sendCommand({ type: 'recall_scene', sceneNumber: idx });
                      onClose();
                    }}
                    className={`py-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                      state.sceneNumber === idx
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <span>#{String(idx).padStart(2, '0')}</span>
                    {idx === 0 && <span className="text-[9px] opacity-75">INIT</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Coreografie Demo */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono text-slate-400 gap-2">
              <span>Coreografie Fader (Demo Mode):</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'sine' });
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-pointer hover:bg-cyan-500/30 transition"
                >
                  🌊 Sine Wave
                </button>
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'bounce' });
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer hover:bg-amber-500/30 transition"
                >
                  ⚡ Knight Rider
                </button>
                <button
                  onClick={() => {
                    sendCommand({ type: 'trigger_demo_wave', mode: 'v-shape' });
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 cursor-pointer hover:bg-purple-500/30 transition"
                >
                  💠 V-Ripple
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXPORT BACKUP */}
        {activeTab === 'export' && (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              Esporta lo stato delle scene selezionate, i layout modulari e le etichette in un file
              JSON condivisibile e ripristinabile in qualsiasi momento.
            </div>

            {/* General Options */}
            <div className="flex flex-col gap-2 bg-[#080b11] p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-400 w-24">NOME FILE:</label>
                <input
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 outline-none"
                />
                <span className="text-xs font-mono text-slate-500">.json</span>
              </div>

              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={includeGlobalExport}
                  onChange={(e) => setIncludeGlobalExport(e.target.checked)}
                  className="accent-cyan-400 rounded"
                />
                <span>Includi layout modulari e preferenze generali della console</span>
              </label>
            </div>

            {/* Scene Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>SCENE DA INCLUDERE NEL FILE:</span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    onClick={() => {
                      const all = new Set<number>();
                      for (const sc of availableScenes) all.add(sc.sceneNumber);
                      all.add(state.sceneNumber);
                      setSelectedScenesForExport(all);
                    }}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Tutte ({availableScenes.length || 1})
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setSelectedScenesForExport(new Set([state.sceneNumber]))}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Solo Attuale (#{state.sceneNumber})
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setSelectedScenesForExport(new Set())}
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Deseleziona
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-[#080b11] rounded-xl border border-slate-800">
                {/* Always show at least the current scene */}
                <label
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono cursor-pointer transition ${
                    selectedScenesForExport.has(state.sceneNumber)
                      ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedScenesForExport.has(state.sceneNumber)}
                      onChange={(e) => {
                        const next = new Set(selectedScenesForExport);
                        if (e.target.checked) next.add(state.sceneNumber);
                        else next.delete(state.sceneNumber);
                        setSelectedScenesForExport(next);
                      }}
                      className="accent-cyan-400 rounded"
                    />
                    <span className="font-bold">#{String(state.sceneNumber).padStart(2, '0')}</span>
                    <span className="truncate max-w-[140px]">{state.sceneTitle}</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                    ATTIVA LIVE
                  </span>
                </label>

                {/* Other available scenes */}
                {availableScenes
                  .filter((s) => s.sceneNumber !== state.sceneNumber)
                  .map((sc) => (
                    <label
                      key={sc.sceneNumber}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono cursor-pointer transition ${
                        selectedScenesForExport.has(sc.sceneNumber)
                          ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedScenesForExport.has(sc.sceneNumber)}
                          onChange={(e) => {
                            const next = new Set(selectedScenesForExport);
                            if (e.target.checked) next.add(sc.sceneNumber);
                            else next.delete(sc.sceneNumber);
                            setSelectedScenesForExport(next);
                          }}
                          className="accent-cyan-400 rounded"
                        />
                        <span className="font-bold">
                          #{String(sc.sceneNumber).padStart(2, '0')}
                        </span>
                        <span className="truncate max-w-[140px]">{sc.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {sc.hasArchive ? 'Archiviata' : sc.hasLabels ? 'Etichette' : ''}
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            <button
              onClick={handleDownloadBackup}
              disabled={isExporting || selectedScenesForExport.size === 0}
              className="mt-2 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2"
            >
              <span>💾</span>
              <span>
                {isExporting
                  ? 'GENERAZIONE BACKUP...'
                  : `SCARICA BACKUP (${selectedScenesForExport.size} SCENE SELEZIONATE)`}
              </span>
            </button>
          </div>
        )}

        {/* TAB 3: RESTORE BACKUP */}
        {activeTab === 'restore' && (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-[#080b11] text-center transition">
              <span className="text-2xl">📂</span>
              <p className="text-xs font-mono text-slate-300">
                Seleziona un file di backup <code className="text-cyan-400">.json</code> salvato in
                precedenza
              </p>
              <label className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <span>SFOGLIA FILE...</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {restoreErrorMsg && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/60 rounded-xl text-rose-300 text-xs font-mono">
                ⚠️ {restoreErrorMsg}
              </div>
            )}

            {restoreStatusMsg && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-mono">
                {restoreStatusMsg}
              </div>
            )}

            {/* Package Details & Scene Remapping Plan */}
            {importedPackage && (
              <div className="flex flex-col gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800 animate-in fade-in">
                {/* Meta details */}
                <div className="flex flex-wrap items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
                  <div className="text-white font-bold">
                    📦 {importedPackage.metadata?.name || 'Show Backup'}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Creato: {new Date(importedPackage.timestamp).toLocaleString()} · v
                    {importedPackage.appVersion || '0.5.x'}
                  </div>
                </div>

                {/* Global Restore Flags */}
                <div className="flex flex-col gap-1.5 text-xs font-mono text-slate-300">
                  {importedPackage.global && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreGlobalFlag}
                        onChange={(e) => setRestoreGlobalFlag(e.target.checked)}
                        className="accent-cyan-400 rounded"
                      />
                      <span>Ripristina layout modulari e configurazioni globali</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer text-amber-300/90">
                    <input
                      type="checkbox"
                      checked={restoreHardwareFlag}
                      onChange={(e) => setRestoreHardwareFlag(e.target.checked)}
                      className="accent-amber-400 rounded"
                    />
                    <span>
                      Invia comandi al mixer reale e scrivi in memoria EEPROM (se connesso via USB)
                    </span>
                  </label>
                </div>

                {/* Scene Remapping Table */}
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-mono text-slate-400 flex justify-between">
                    <span>SELEZIONA SCENE E ASSEGNA SLOT:</span>
                    <span>(Sorgente ➔ Destinazione)</span>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(importedPackage.scenes).map(([srcKey, sceneData]) => {
                      const srcNum = Number(srcKey);
                      const isSelected = !!selectedScenesForRestore[srcNum];
                      const targetSlot = sceneTargetMapping[srcNum] ?? srcNum;

                      return (
                        <div
                          key={srcNum}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono transition ${
                            isSelected
                              ? 'bg-[#080b11] border-cyan-500/40 text-slate-200'
                              : 'bg-slate-900/30 border-slate-800 text-slate-500'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedScenesForRestore({
                                  ...selectedScenesForRestore,
                                  [srcNum]: e.target.checked,
                                })
                              }
                              className="accent-cyan-400 rounded"
                            />
                            <span className="font-bold text-cyan-400">
                              #{String(srcNum).padStart(2, '0')}
                            </span>
                            <span className="truncate max-w-[160px]">{sceneData.title}</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-[10px]">destinazione:</span>
                            <select
                              value={targetSlot}
                              disabled={!isSelected}
                              onChange={(e) =>
                                setSceneTargetMapping({
                                  ...sceneTargetMapping,
                                  [srcNum]: Number(e.target.value),
                                })
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-amber-300 outline-none disabled:opacity-50"
                            >
                              {Array.from({ length: 100 }, (_, i) => (
                                <option key={i} value={i}>
                                  Slot #{String(i).padStart(2, '0')}{' '}
                                  {i === state.sceneNumber ? '(Attiva)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="mt-1 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  <span>{isRestoring ? 'RIPRISTINO IN CORSO...' : 'AVVIA RIPRISTINO SELETTIVO'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
