import React, { useRef, useState } from 'react';
import { WIDGET_META_MAP, WidgetLayoutItem } from './layoutTypes';

interface ModularWidgetCardProps {
  item: WidgetLayoutItem;
  isEditMode: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onUpdateItem: (updated: WidgetLayoutItem) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}

export const ModularWidgetCard: React.FC<ModularWidgetCardProps> = ({
  item,
  isEditMode,
  isDragging,
  isDragOver,
  onUpdateItem,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}) => {
  const meta = WIDGET_META_MAP[item.id];
  const cardRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const colStart = item.colStart || 1;
  const rowStart = item.rowStart || 1;
  const colSpan = item.colSpan || 1;
  const rowSpan = item.rowSpan || 1;

  // Resize handler for bottom-right corner grabber
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startColSpan = colSpan;
    const startRowSpan = rowSpan;

    // Get parent grid width to compute column width in 24-column grid
    const parentGrid = cardRef.current?.parentElement;
    const gridWidth = parentGrid ? parentGrid.getBoundingClientRect().width : 1200;
    const colWidthPx = gridWidth / 24;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const colChange = Math.round(deltaX / colWidthPx);
      const newColSpan = Math.max(1, Math.min(25 - colStart, startColSpan + colChange));

      // Row height estimate (~52px per row unit in 4-row layout)
      const rowChange = Math.round(deltaY / 52);
      const newRowSpan = Math.max(1, Math.min(5 - rowStart, startRowSpan + rowChange));

      if (newColSpan !== colSpan || newRowSpan !== rowSpan) {
        onUpdateItem({
          ...item,
          colSpan: newColSpan,
          rowSpan: newRowSpan,
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={cardRef}
      onDragOver={(e) => onDragOver(item.id, e)}
      onDrop={(e) => onDrop(item.id, e)}
      style={{
        gridColumn: `${colStart} / span ${colSpan}`,
        gridRow: `${rowStart} / span ${rowSpan}`,
        zIndex: isDragging ? 50 : isDragOver ? 40 : 10,
      }}
      className={`relative flex flex-col transition-all duration-150 rounded-xl min-w-0 ${
        !item.visible ? (isEditMode ? 'opacity-40 border border-slate-700' : 'hidden') : ''
      } ${
        isDragging
          ? 'opacity-30 scale-95 border-2 border-dashed border-cyan-400 bg-cyan-950/20'
          : isDragOver
          ? 'ring-2 ring-cyan-400 border-cyan-400 scale-[1.01] shadow-[0_0_15px_rgba(6,182,212,0.3)]'
          : ''
      } ${
        isEditMode
          ? 'border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-slate-900/40 p-1'
          : ''
      } ${isResizing ? 'select-none ring-2 ring-amber-400' : ''}`}
    >
      {/* EDIT MODE TOP CONTROLS BAR */}
      {isEditMode && (
        <div
          draggable
          onDragStart={(e) => onDragStart(item.id, e)}
          onDragEnd={onDragEnd}
          className="flex flex-col gap-1 bg-slate-950/95 border border-slate-800 px-1.5 py-1 rounded-lg mb-1 text-[9px] font-mono cursor-grab active:cursor-grabbing select-none shadow-md z-20"
        >
          {/* Header Row 1: Grip + Title + Visibility */}
          <div className="flex items-center justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-amber-400 text-xs font-bold tracking-tighter" title="Trascina nello spazio 4x24">
                ⠿
              </span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta?.color || '#38bdf8' }}
              />
              <span className="font-bold text-slate-200 truncate" title={meta?.name || item.id}>
                {meta?.shortName || item.id}
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateItem({ ...item, visible: !item.visible });
              }}
              className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                item.visible
                  ? 'bg-slate-900 border border-slate-800 text-slate-300'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}
              title={item.visible ? 'Nascondi modulo' : 'Mostra modulo'}
            >
              {item.visible ? '👁' : '🚫'}
            </button>
          </div>

          {/* Header Row 2: Precise 4x24 Position (X, Y) and Dimension (W, H) */}
          <div className="flex flex-wrap items-center justify-between gap-0.5 text-[8px] border-t border-slate-850 pt-0.5">
            {/* Col Start (X) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1 py-0.5 gap-0.5">
              <span className="text-slate-500 font-bold">X:</span>
              <button
                disabled={colStart <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, colStart: Math.max(1, colStart - 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Sposta a sinistra"
              >
                ◀
              </button>
              <span className="text-amber-300 font-bold min-w-[14px] text-center">{colStart}</span>
              <button
                disabled={colStart + colSpan - 1 >= 24}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, colStart: Math.min(25 - colSpan, colStart + 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Sposta a destra"
              >
                ▶
              </button>
            </div>

            {/* Row Start (Y) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1 py-0.5 gap-0.5">
              <span className="text-slate-500 font-bold">Y:</span>
              <button
                disabled={rowStart <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, rowStart: Math.max(1, rowStart - 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Sposta in alto"
              >
                ▲
              </button>
              <span className="text-cyan-300 font-bold min-w-[10px] text-center">{rowStart}</span>
              <button
                disabled={rowStart + rowSpan - 1 >= 4}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, rowStart: Math.min(5 - rowSpan, rowStart + 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Sposta in basso"
              >
                ▼
              </button>
            </div>

            {/* Width (W) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1 py-0.5 gap-0.5">
              <span className="text-slate-500 font-bold">W:</span>
              <button
                disabled={colSpan <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, colSpan: Math.max(1, colSpan - 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Riduci larghezza"
              >
                -
              </button>
              <span className="text-emerald-300 font-bold min-w-[14px] text-center">{colSpan}</span>
              <button
                disabled={colStart + colSpan - 1 >= 24}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, colSpan: Math.min(25 - colStart, colSpan + 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Aumenta larghezza"
              >
                +
              </button>
            </div>

            {/* Height (H) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1 py-0.5 gap-0.5">
              <span className="text-slate-500 font-bold">H:</span>
              <button
                disabled={rowSpan <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, rowSpan: Math.max(1, rowSpan - 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Riduci altezza"
              >
                -
              </button>
              <span className="text-purple-300 font-bold min-w-[10px] text-center">{rowSpan}</span>
              <button
                disabled={rowStart + rowSpan - 1 >= 4}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateItem({ ...item, rowSpan: Math.min(5 - rowStart, rowSpan + 1) });
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer font-bold"
                title="Aumenta altezza"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET LIVE CONTENT */}
      <div className="flex-1 min-h-0 flex flex-col justify-between">
        {children}
      </div>

      {/* EDIT MODE BOTTOM-RIGHT INTERACTIVE RESIZE HANDLE */}
      {isEditMode && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-nwse-resize select-none text-slate-400 hover:text-amber-400 transition z-30"
          title="Trascina questo angolo per ridimensionare larghezza e altezza"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current">
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="4" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
};
