import React, { useState } from 'react';
import { ClientCommand, ControlMode, InputChannelState, MixerState } from '../../shared/types';
import {
  loadStoredLayout,
  normalizeLayout,
  resetStoredLayout,
  saveStoredLayout,
} from './channel-layout/defaultPresets';
import {
  WidgetAux12,
  WidgetAux34,
  WidgetAux56,
  WidgetAux78,
  WidgetAuxSends,
  WidgetCompressor,
  WidgetEqBands,
  WidgetEqGraph,
  WidgetEqHigh,
  WidgetEqHiMid,
  WidgetEqLoMid,
  WidgetEqLow,
  WidgetGate,
  WidgetMeterPreamp,
  WidgetPreampAttenPan,
  WidgetRouting,
} from './channel-layout/ChannelWidgets';
import { LayoutToolbar } from './channel-layout/LayoutToolbar';
import { ChannelLayoutConfig, WidgetId, WidgetLayoutItem } from './channel-layout/layoutTypes';
import { ModularWidgetCard } from './channel-layout/ModularWidgetCard';
import { FaderStrip } from './FaderStrip';

interface SingleDualChannelViewProps {
  state: MixerState;
  savedState?: MixerState | null;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  sendCommand: (cmd: ClientCommand) => void;
}

const renderWidgetContent = (
  id: WidgetId,
  ch: InputChannelState,
  savedCh: InputChannelState | undefined,
  controlMode: ControlMode,
  sendCommand: (cmd: ClientCommand) => void,
  auxNames?: string[],
  busNames?: string[]
) => {
  switch (id) {
    case 'meter_vertical':
    case 'meter_preamp':
      return (
        <WidgetMeterPreamp
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'preamp':
      return (
        <WidgetPreampAttenPan
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_graph':
      return (
        <WidgetEqGraph
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_high':
      return (
        <WidgetEqHigh
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_himid':
      return (
        <WidgetEqHiMid
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_lomid':
      return (
        <WidgetEqLoMid
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_low':
      return (
        <WidgetEqLow
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'eq_bands':
      return (
        <WidgetEqBands
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'compressor':
      return (
        <WidgetCompressor
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'gate':
      return (
        <WidgetGate
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
        />
      );
    case 'aux_1_2':
      return (
        <WidgetAux12
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_3_4':
      return (
        <WidgetAux34
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_5_6':
      return (
        <WidgetAux56
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_7_8':
      return (
        <WidgetAux78
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'aux_sends':
      return (
        <WidgetAuxSends
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    case 'routing':
      return (
        <WidgetRouting
          ch={ch}
          savedCh={savedCh}
          controlMode={controlMode}
          sendCommand={sendCommand}
          auxNames={auxNames}
          busNames={busNames}
        />
      );
    default:
      return null;
  }
};

const FullChannelColumn: React.FC<{
  ch: InputChannelState;
  savedCh?: InputChannelState;
  controlMode: ControlMode;
  isSelected: boolean;
  sendCommand: (cmd: ClientCommand) => void;
  layout: ChannelLayoutConfig;
  gridCols: number;
  gridRows: number;
  isEditMode: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  auxNames?: string[];
  busNames?: string[];
  onUpdateItem: (updated: WidgetLayoutItem) => void;
  onDropOnCell: (id: string, col: number, row: number) => void;
  onDropOnWidget: (targetId: string, e: React.DragEvent) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}> = ({
  ch,
  savedCh,
  controlMode,
  isSelected,
  sendCommand,
  layout,
  gridCols,
  gridRows,
  isEditMode,
  draggedId,
  dragOverId,
  auxNames,
  busNames,
  onUpdateItem,
  onDropOnCell,
  onDropOnWidget,
  onDragStart,
  onDragOver,
  onDragEnd,
}) => {
  return (
    <div
      className={`flex-1 min-w-[340px] flex flex-col lg:flex-row gap-3 bg-[#0c1018] border rounded-2xl p-3.5 overflow-y-auto ${
        isSelected
          ? 'border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
          : 'border-slate-800/90'
      }`}
    >
      {/* Left Column: Motorized Fader + Preamp Controls */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <FaderStrip
          id={ch.id}
          label={`CH ${ch.id}`}
          name={ch.name}
          on={ch.on}
          solo={ch.solo}
          fader={ch.fader}
          savedFader={savedCh?.fader}
          pan={ch.pan}
          savedPan={savedCh?.pan}
          meter={ch.meterOut || ch.meterIn}
          selected={isSelected}
          onSelect={() => sendCommand({ type: 'select_channel', id: ch.id })}
          onChangeFader={(val) =>
            sendCommand({ type: 'set_fader', target: 'ch', id: ch.id, value: val })
          }
          onToggleOn={() => sendCommand({ type: 'set_on', target: 'ch', id: ch.id, value: !ch.on })}
          onToggleSolo={() =>
            sendCommand({ type: 'set_solo', target: 'ch', id: ch.id, value: !ch.solo })
          }
          onChangePan={(val) =>
            sendCommand({ type: 'set_pan', target: 'ch', id: ch.id, value: val })
          }
          onRename={(newName) =>
            sendCommand({ type: 'set_name', target: 'ch', id: ch.id, name: newName })
          }
        />

        {/* Phase Invert & Pair Buttons */}
        <button
          onClick={() => sendCommand({ type: 'set_phase', id: ch.id, value: !ch.phase })}
          className={`w-full py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
            ch.phase
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          Ø {ch.phase ? '180°' : 'NORM'}
        </button>

        <button
          onClick={() => sendCommand({ type: 'set_pair', id: ch.id, value: !ch.pair })}
          className={`w-full py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
            ch.pair
              ? 'bg-purple-500/25 border-purple-400 text-purple-200'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          🔗 PAIR {ch.pair ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Right Column: Dynamic Modular Grid */}
      <div className="flex-1 flex flex-col gap-2.5 min-w-0">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, minmax(52px, 1fr))`,
            position: 'relative',
          }}
          className="gap-2.5 min-h-[220px]"
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
                        onDropOnCell(id, col, row);
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
                onUpdateItem={onUpdateItem}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={(targetId, e) => onDropOnWidget(targetId, e)}
                onDragEnd={onDragEnd}
              >
                {renderWidgetContent(
                  item.id,
                  ch,
                  savedCh,
                  controlMode,
                  sendCommand,
                  auxNames,
                  busNames
                )}
              </ModularWidgetCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const SingleDualChannelView: React.FC<SingleDualChannelViewProps> = ({
  state,
  savedState,
  controlMode,
  onChangeControlMode,
  sendCommand,
}) => {
  const [layout, setLayout] = useState<ChannelLayoutConfig>(loadStoredLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const gridCols = layout.gridCols || 24;
  const gridRows = layout.gridRows || 4;

  const selId = state.selectedChannel;
  const baseOddId = selId % 2 === 1 ? selId : selId - 1;
  const primaryCh = state.channels[selId - 1] ?? state.channels[0];
  const savedPrimaryCh =
    state.savedChannels?.[selId - 1] ?? savedState?.channels[selId - 1] ?? state.savedChannels?.[0];
  const leftCh = state.channels[baseOddId - 1] ?? state.channels[0];
  const savedLeftCh =
    state.savedChannels?.[baseOddId - 1] ??
    savedState?.channels[baseOddId - 1] ??
    state.savedChannels?.[0];
  const rightCh = state.channels[baseOddId] ?? state.channels[1];
  const savedRightCh =
    state.savedChannels?.[baseOddId] ?? savedState?.channels[baseOddId] ?? state.savedChannels?.[1];

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

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
      {/* Channel Selector Strip + Prototyping Toggle + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b0f17] border border-slate-800/90 rounded-xl px-3 py-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {state.channels.slice(0, 16).map((c) => (
            <button
              key={c.id}
              onClick={() => sendCommand({ type: 'select_channel', id: c.id })}
              title={`CH ${c.id}: ${c.name}`}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                state.selectedChannel === c.id
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {c.id}
            </button>
          ))}
          <span className="text-slate-700 mx-1">|</span>
          {state.channels.slice(16, 32).map((c) => (
            <button
              key={c.id}
              onClick={() => sendCommand({ type: 'select_channel', id: c.id })}
              title={`CH ${c.id}: ${c.name}`}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                state.selectedChannel === c.id
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {c.id}
            </button>
          ))}
        </div>

        {/* Action Controls & Layout Customizer Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Prototyping Edit Mode Toggle */}
          <button
            onClick={handleToggleEditMode}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
                controlMode === 'knobs'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎛️ KNOBS
            </button>
            <button
              onClick={() => onChangeControlMode('sliders')}
              className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
                controlMode === 'sliders'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎚️ SLIDERS
            </button>
          </div>

          {/* Single vs Dual View */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => sendCommand({ type: 'set_dual_view', enabled: false })}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                !state.dualChannelView
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👤 SINGOLO ({selId})
            </button>
            <button
              onClick={() => sendCommand({ type: 'set_dual_view', enabled: true })}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                state.dualChannelView
                  ? 'bg-purple-500 text-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👥 COPPIA ({baseOddId} & {baseOddId + 1})
            </button>
          </div>
        </div>
      </div>

      {/* Layout Prototyping Top Bar */}
      <LayoutToolbar
        layout={layout}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
        onSelectPreset={handleSelectPreset}
        onResetDefault={handleResetDefault}
        onApplyCustomJson={handleApplyCustomJson}
        onChangeGridDimensions={handleChangeGridDimensions}
      />

      {/* Main Single or Side-by-Side Dual Channel Deck */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
        {!state.dualChannelView ? (
          <FullChannelColumn
            ch={primaryCh}
            savedCh={savedPrimaryCh}
            controlMode={controlMode}
            isSelected={true}
            sendCommand={sendCommand}
            layout={layout}
            gridCols={gridCols}
            gridRows={gridRows}
            isEditMode={isEditMode}
            draggedId={draggedId}
            dragOverId={dragOverId}
            auxNames={state.auxes.map((a) => a.name)}
            busNames={state.buses.map((b) => b.name)}
            onUpdateItem={handleUpdateItem}
            onDropOnCell={handleDropOnCell}
            onDropOnWidget={handleDropOnWidget}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          />
        ) : (
          <div className="flex-1 flex flex-col xl:flex-row gap-3 overflow-y-auto">
            <FullChannelColumn
              ch={leftCh}
              savedCh={savedLeftCh}
              controlMode={controlMode}
              isSelected={state.selectedChannel === leftCh.id}
              sendCommand={sendCommand}
              layout={layout}
              gridCols={gridCols}
              gridRows={gridRows}
              isEditMode={isEditMode}
              draggedId={draggedId}
              dragOverId={dragOverId}
              auxNames={state.auxes.map((a) => a.name)}
              busNames={state.buses.map((b) => b.name)}
              onUpdateItem={handleUpdateItem}
              onDropOnCell={handleDropOnCell}
              onDropOnWidget={handleDropOnWidget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
            <FullChannelColumn
              ch={rightCh}
              savedCh={savedRightCh}
              controlMode={controlMode}
              isSelected={state.selectedChannel === rightCh.id}
              sendCommand={sendCommand}
              layout={layout}
              gridCols={gridCols}
              gridRows={gridRows}
              isEditMode={isEditMode}
              draggedId={draggedId}
              dragOverId={dragOverId}
              auxNames={state.auxes.map((a) => a.name)}
              busNames={state.buses.map((b) => b.name)}
              onUpdateItem={handleUpdateItem}
              onDropOnCell={handleDropOnCell}
              onDropOnWidget={handleDropOnWidget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}
      </div>
    </div>
  );
};
