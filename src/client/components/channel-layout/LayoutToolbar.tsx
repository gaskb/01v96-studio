import React, { useState } from 'react';
import { AddWidgetDropdown } from './AddWidgetDropdown';
import { BUILTIN_PRESETS } from './defaultPresets';
import { ChannelLayoutConfig, WidgetId } from './layoutTypes';

interface LayoutToolbarProps {
  layout: ChannelLayoutConfig;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onSelectPreset: (preset: ChannelLayoutConfig) => void;
  onResetDefault: () => void;
  onApplyCustomJson: (jsonStr: string) => boolean;
  onChangeGridDimensions?: (cols: number, rows: number) => void;
  onAddWidget?: (widgetId: WidgetId) => void;
}

export const LayoutToolbar: React.FC<LayoutToolbarProps> = ({
  layout,
  isEditMode,
  onToggleEditMode,
  onSelectPreset,
  onResetDefault,
  onApplyCustomJson,
  onChangeGridDimensions,
  onAddWidget,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const gridCols = layout.gridCols || 24;
  const gridRows = layout.gridRows || 4;

  const handleOpenExport = () => {
    setJsonDraft(JSON.stringify(layout, null, 2));
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleApplyJson = () => {
    setErrorMessage(null);
    const success = onApplyCustomJson(jsonDraft);
    if (success) {
      setModalOpen(false);
    } else {
      setErrorMessage('Formato JSON non valido o mancante dei campi obbligatori.');
    }
  };

  return (
    <>
      {/* Top Banner when in Edit Mode */}
      {isEditMode && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-in fade-in duration-200">
          {/* Status & Instructions */}
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-mono font-bold text-amber-300">
              MODALITÀ PROTOTIPAZIONE LAYOUT
            </span>
            <span className="hidden md:inline text-[10px] font-mono text-slate-400 border-l border-amber-800/60 pl-2">
              Trascina dall&apos;intestazione per riordinare · Trascina l&apos;angolo in basso a destra per ridimensionare
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Insert Module Dropdown + "+" Button */}
            {onAddWidget && <AddWidgetDropdown onAddWidget={onAddWidget} />}

            {/* Presets Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-amber-900/60 rounded-lg px-2 py-1">
              <span className="text-[10px] font-mono text-amber-400/80">Preset:</span>
              <select
                value={layout.presetName || ''}
                onChange={(e) => {
                  const target = BUILTIN_PRESETS.find((p) => p.presetName === e.target.value);
                  if (target) onSelectPreset(target);
                }}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="" disabled className="bg-slate-900 text-slate-400">
                  {layout.presetName || 'Personalizzato'}
                </option>
                {BUILTIN_PRESETS.map((p) => (
                  <option
                    key={p.presetName}
                    value={p.presetName}
                    className="bg-slate-900 text-slate-200"
                  >
                    {p.presetName}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid Dimensions Stepper: Cols (12..36) & Righe (1..6) */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-900/60 rounded-lg px-2 py-1 text-xs font-mono">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-bold text-[10px]">Cols:</span>
                <button
                  disabled={gridCols <= 12}
                  onClick={() => onChangeGridDimensions?.(Math.max(12, gridCols - 1), gridRows)}
                  className="w-4 h-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-200 cursor-pointer font-bold text-xs"
                  title="Riduci larghezza griglia (min: 12)"
                >
                  -
                </button>
                <span className="text-amber-300 font-bold min-w-[18px] text-center">{gridCols}</span>
                <button
                  disabled={gridCols >= 36}
                  onClick={() => onChangeGridDimensions?.(Math.min(36, gridCols + 1), gridRows)}
                  className="w-4 h-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-200 cursor-pointer font-bold text-xs"
                  title="Aumenta larghezza griglia (max: 36)"
                >
                  +
                </button>
              </div>

              <span className="text-slate-700">|</span>

              <div className="flex items-center gap-1">
                <span className="text-cyan-400 font-bold text-[10px]">Righe:</span>
                <button
                  disabled={gridRows <= 1}
                  onClick={() => onChangeGridDimensions?.(gridCols, Math.max(1, gridRows - 1))}
                  className="w-4 h-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-200 cursor-pointer font-bold text-xs"
                  title="Riduci altezza griglia (min: 1)"
                >
                  -
                </button>
                <span className="text-cyan-300 font-bold min-w-[14px] text-center">{gridRows}</span>
                <button
                  disabled={gridRows >= 6}
                  onClick={() => onChangeGridDimensions?.(gridCols, Math.min(6, gridRows + 1))}
                  className="w-4 h-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-200 cursor-pointer font-bold text-xs"
                  title="Aumenta altezza griglia (max: 6)"
                >
                  +
                </button>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={onResetDefault}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white cursor-pointer transition flex items-center gap-1"
              title="Ripristina layout predefinito"
            >
              🔄 Reset
            </button>

            {/* Export / Import Button */}
            <button
              onClick={handleOpenExport}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 hover:text-cyan-100 cursor-pointer transition flex items-center gap-1"
              title="Esporta o importa configurazione JSON"
            >
              📋 JSON
            </button>

            {/* Close Edit Mode */}
            <button
              onClick={onToggleEditMode}
              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition shadow"
            >
              ✓ Salva & Chiudi
            </button>
          </div>
        </div>
      )}

      {/* JSON Import/Export Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#0b0f17] border border-cyan-500/40 rounded-2xl p-4 max-w-xl w-full flex flex-col gap-3 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold text-sm">📋 CONFIGURAZIONE LAYOUT JSON</span>
                <span className="text-[10px] font-mono text-slate-400">
                  (Copia o modifica per testare layout)
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Puoi copiare questo codice JSON per salvare il layout su un file, oppure incollare
              una nuova configurazione e premere <strong>Applica</strong>.
            </p>

            <textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              rows={12}
              className="w-full bg-[#05080e] border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
            />

            {errorMessage && (
              <div className="text-xs font-mono text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2 rounded">
                ⚠️ {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleCopyClipboard}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold cursor-pointer transition ${
                  copyFeedback
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {copyFeedback ? '✓ Copiato negli Appunti!' : '📄 Copia negli Appunti'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleApplyJson}
                  className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition shadow"
                >
                  Applica Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
