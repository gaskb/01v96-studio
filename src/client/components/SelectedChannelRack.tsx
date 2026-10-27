import React, { useEffect, useState } from 'react';
import { ClientCommand, ControlMode, InputChannelState } from '../../shared/types';
import {
  fetchServerLayouts,
  insertWidgetIntoLayout,
  loadStoredLayout,
  normalizeLayout,
  resetStoredLayout,
  saveStoredLayout,
} from './channel-layout/defaultPresets';
import { AddWidgetDropdown } from './channel-layout/AddWidgetDropdown';
import { LayoutToolbar } from './channel-layout/LayoutToolbar';
import { ChannelLayoutConfig, WidgetId, WidgetLayoutItem } from './channel-layout/layoutTypes';
import { ModularWidgetCard } from './channel-layout/ModularWidgetCard';
import { renderWidgetContent } from './channel-layout/WidgetRenderer';
import { ChannelStripPanel } from './ChannelStripPanel';

interface SelectedChannelRackProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  sendCommand: (cmd: ClientCommand) => void;
  auxNames?: string[];
  busNames?: string[];
}

export const SelectedChannelRack: React.FC<SelectedChannelRackProps> = ({
  channel,
  savedChannel,
  controlMode,
  onChangeControlMode,
  sendCommand,
  auxNames,
  busNames,
}) => {
  const [layout, setLayout] = useState<ChannelLayoutConfig>(loadStoredLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(channel.name);

  useEffect(() => {
    fetchServerLayouts().then((serverData) => {
      if (serverData.activeLayout && !window.localStorage?.getItem('01v96_channel_layout_v5')) {
        setLayout(serverData.activeLayout);
      }
    });
  }, []);

  const gridCols = layout.gridCols || 24;
  const gridRows = layout.gridRows || 4;

  const handleToggleEditMode = () => setIsEditMode((prev) => !prev);

  const handleSelectPreset = (preset: ChannelLayoutConfig) => {
    const normalized = normalizeLayout(preset);
    setLayout(normalized);
    saveStoredLayout(normalized);
  };

  const handleResetDefault = () => {
    const reset = resetStoredLayout();
    setLayout(reset);
  };

  const handleInsertWidget = (widgetId: WidgetId) => {
    const { nextLayout } = insertWidgetIntoLayout(layout, widgetId);
    setLayout(nextLayout);
    saveStoredLayout(nextLayout);
    if (isCollapsed) setIsCollapsed(false);
  };

  const handleApplyCustomJson = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      const normalized = normalizeLayout(parsed);
      setLayout(normalized);
      saveStoredLayout(normalized);
      return true;
    } catch {
      return false;
    }
  };

  const handleChangeGridDimensions = (nextCols: number, nextRows: number) => {
    const clampedItems = layout.items.map((it) => {
      const colSpan = Math.max(1, Math.min(nextCols, it.colSpan));
      const rowSpan = Math.max(1, Math.min(nextRows, it.rowSpan || 1));
      const colStart = Math.max(1, Math.min(nextCols - colSpan + 1, it.colStart || 1));
      const rowStart = Math.max(1, Math.min(nextRows - rowSpan + 1, it.rowStart || 1));
      return { ...it, colSpan, rowSpan, colStart, rowStart };
    });
    const nextLayout: ChannelLayoutConfig = {
      ...layout,
      presetName: `Personalizzato (${nextRows}x${nextCols})`,
      gridCols: nextCols,
      gridRows: nextRows,
      items: clampedItems,
    };
    setLayout(nextLayout);
    saveStoredLayout(nextLayout);
  };

  const handleUpdateItem = (updated: WidgetLayoutItem) => {
    const nextItems = layout.items.map((it) => (it.id === updated.id ? updated : it));
    const nextLayout: ChannelLayoutConfig = {
      ...layout,
      presetName: `Personalizzato (${gridRows}x${gridCols})`,
      items: nextItems,
    };
    setLayout(nextLayout);
    saveStoredLayout(nextLayout);
  };

  const handleDropOnCell = (id: string, col: number, row: number) => {
    const item = layout.items.find((i) => i.id === id);
    if (!item) return;
    const colSpan = item.colSpan || 1;
    const rowSpan = item.rowSpan || 1;
    const newColStart = Math.max(1, Math.min(gridCols - colSpan + 1, col));
    const newRowStart = Math.max(1, Math.min(gridRows - rowSpan + 1, row));

    const nextItems = layout.items.map((it) =>
      it.id === id ? { ...it, colStart: newColStart, rowStart: newRowStart } : it
    );
    const nextLayout: ChannelLayoutConfig = {
      ...layout,
      presetName: `Personalizzato (${gridRows}x${gridCols})`,
      items: nextItems,
    };
    setLayout(nextLayout);
    saveStoredLayout(nextLayout);
  };

  const handleDragStart = (id: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDropOnWidget = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const source = layout.items.find((i) => i.id === sourceId);
    const target = layout.items.find((i) => i.id === targetId);
    if (!source || !target) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const sCol = source.colStart || 1;
    const sRow = source.rowStart || 1;
    const tCol = target.colStart || 1;
    const tRow = target.rowStart || 1;

    const nextItems = layout.items.map((it) => {
      if (it.id === source.id) {
        return {
          ...it,
          colStart: Math.min(gridCols - it.colSpan + 1, tCol),
          rowStart: Math.min(gridRows - (it.rowSpan || 1) + 1, tRow),
        };
      }
      if (it.id === target.id) {
        return {
          ...it,
          colStart: Math.min(gridCols - it.colSpan + 1, sCol),
          rowStart: Math.min(gridRows - (it.rowSpan || 1) + 1, sRow),
        };
      }
      return it;
    });

    const nextLayout: ChannelLayoutConfig = {
      ...layout,
      presetName: `Personalizzato (${gridRows}x${gridCols})`,
      items: nextItems,
    };
    setLayout(nextLayout);
    saveStoredLayout(nextLayout);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // If in SLIDERS mode and not currently editing layout, display the classic v0.3.0 ChannelStripPanel
  if (controlMode === 'sliders' && !isEditMode) {
    return (
      <ChannelStripPanel
        channel={channel}
        savedChannel={savedChannel}
        controlMode={controlMode}
        onChangeControlMode={onChangeControlMode}
        sendCommand={sendCommand}
        auxNames={auxNames}
        busNames={busNames}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5 bg-[#0c1018] border border-cyan-500/40 rounded-2xl p-2 shadow-[0_0_20px_rgba(6,182,212,0.08)] select-none h-full min-h-0">
      {/* RACK HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#070a0f] border border-slate-800/90 rounded-xl px-2.5 py-1 shrink-0">
        {/* Left: Selected Channel Info & Quick Toggles */}
        <div className="flex items-center gap-2">
          <div
            onDoubleClick={() => {
              setNameDraft(channel.name || `CH${channel.id}`);
              setEditingName(true);
            }}
            title={
              channel.name
                ? `CH ${channel.id}: ${channel.name} (Doppio click per modificare)`
                : `CH ${channel.id} (Doppio click per modificare)`
            }
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 cursor-pointer max-w-[220px]"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
            <span className="text-xs font-mono font-bold text-white tracking-wide shrink-0">
              CH {channel.id}
            </span>
            {editingName ? (
              <input
                type="text"
                maxLength={32}
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  sendCommand({
                    type: 'set_name',
                    target: 'ch',
                    id: channel.id,
                    name: nameDraft,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditingName(false);
                    sendCommand({
                      type: 'set_name',
                      target: 'ch',
                      id: channel.id,
                      name: nameDraft,
                    });
                  } else if (e.key === 'Escape') {
                    setNameDraft(channel.name);
                    setEditingName(false);
                  }
                }}
                className="bg-transparent text-xs font-mono text-cyan-300 font-semibold border-l border-slate-800 pl-2 outline-none w-full"
              />
            ) : (
              <span
                title={channel.name || `CH${channel.id}`}
                className="text-xs font-mono text-cyan-300 font-semibold border-l border-slate-800 pl-2 truncate"
              >
                {channel.name || `CH${channel.id}`}
              </span>
            )}
          </div>

          {/* Phase Invert */}
          <button
            onClick={() => sendCommand({ type: 'set_phase', id: channel.id, value: !channel.phase })}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition ${
              channel.phase
                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Ø {channel.phase ? '180°' : 'NORM'}
          </button>

          {/* Stereo Pair */}
          <button
            onClick={() => sendCommand({ type: 'set_pair', id: channel.id, value: !channel.pair })}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition ${
              channel.pair
                ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🔗 PAIR {channel.pair ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Right: Add Module Dropdown with "+", Layout Edit Toggle, Knobs/Sliders & Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Menù a tendina con pulsante "+" per inserire moduli (es. VU-Meter, EQ, Dinamiche) */}
          <AddWidgetDropdown onAddWidget={handleInsertWidget} />

          {/* Prototyping Edit Mode Toggle Button */}
          <button
            onClick={handleToggleEditMode}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              isEditMode
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-slate-950 border border-slate-800 text-amber-400 hover:text-amber-300 hover:border-amber-500/50'
            }`}
            title="Attiva/Disattiva la modalità di modifica layout e posizionamento pannelli"
          >
            <span>📐</span>
            <span>{isEditMode ? 'MODIFICA: ON' : 'MODIFICA LAYOUT'}</span>
          </button>

          {/* Knobs / Sliders Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              onClick={() => onChangeControlMode('knobs')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition ${
                controlMode === 'knobs'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎛️ KNOBS
            </button>
            <button
              onClick={() => onChangeControlMode('sliders')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition ${
                controlMode === 'sliders'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎚️ SLIDERS
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer transition"
            title={isCollapsed ? 'Espandi Rack Canale' : 'Comprimi Rack Canale'}
          >
            {isCollapsed ? '▼ ESPANDI' : '▲ COMPRIMI'}
          </button>
        </div>
      </div>

      {/* Layout Prototyping Top Toolbar (visible when edit mode is active) */}
      <LayoutToolbar
        layout={layout}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
        onSelectPreset={handleSelectPreset}
        onResetDefault={handleResetDefault}
        onApplyCustomJson={handleApplyCustomJson}
        onChangeGridDimensions={handleChangeGridDimensions}
        onAddWidget={handleInsertWidget}
      />

      {/* MODULAR DRAGGABLE & RESIZABLE GRID RACK (Configurable Cols x Rows) */}
      {!isCollapsed && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
            position: 'relative',
          }}
          className="gap-1.5 flex-1 min-h-0"
        >
          {/* Background Drop Grid Cells (Visible in Edit Mode) */}
          {isEditMode &&
            Array.from({ length: gridRows }).map((_, rIdx) =>
              Array.from({ length: gridCols }).map((_, cIdx) => {
                const row = rIdx + 1;
                const col = cIdx + 1;
                return (
                  <div
                    key={`grid-cell-${row}-${col}`}
                    style={{
                      gridColumn: `${col} / span 1`,
                      gridRow: `${row} / span 1`,
                      zIndex: 0,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/plain') || draggedId;
                      if (id) {
                        handleDropOnCell(id, col, row);
                      }
                    }}
                    className="border border-dashed border-slate-800/60 hover:border-amber-400 hover:bg-amber-400/10 rounded transition-colors flex items-center justify-center text-[7px] font-mono text-slate-700 hover:text-amber-300 select-none cursor-pointer"
                    title={`Cella col ${col}, riga ${row}: rilascia qui per ancorare`}
                  >
                    {col},{row}
                  </div>
                );
              })
            )}

          {/* Live Widgets anchored to explicit (colStart, rowStart) */}
          {layout.items.map((item) => {
            if (!item.visible && !isEditMode) return null;
            return (
              <ModularWidgetCard
                key={item.id}
                item={item}
                gridCols={gridCols}
                gridRows={gridRows}
                isEditMode={isEditMode}
                isDragging={draggedId === item.id}
                isDragOver={dragOverId === item.id}
                onUpdateItem={handleUpdateItem}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={(targetId, e) => handleDropOnWidget(targetId, e)}
                onDragEnd={handleDragEnd}
              >
                {renderWidgetContent(
                  item.id,
                  channel,
                  savedChannel,
                  controlMode,
                  sendCommand,
                  auxNames,
                  busNames
                )}
              </ModularWidgetCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
