import React, { useEffect, useRef, useState } from 'react';

export interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  savedValue?: number;
  defaultValue: number;
  displayValue: string;
  color?: string;
  size?: number;
  bipolar?: boolean;
  onChange: (newValue: number) => void;
  subControls?: React.ReactNode;
}

export function resolveKnobReset(
  _current: number,
  saved: number | undefined,
  factoryDefault: number,
  forceFactoryDefault = false
): number {
  if (!forceFactoryDefault && saved !== undefined) {
    return saved;
  }
  return factoryDefault;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (Math.abs(endAngle - startAngle) < 0.5) return '';
  const s = Math.min(startAngle, endAngle);
  const e = Math.max(startAngle, endAngle);
  const start = polarToCartesian(cx, cy, r, e);
  const end = polarToCartesian(cx, cy, r, s);
  const largeArcFlag = e - s <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  savedValue,
  defaultValue,
  displayValue,
  color = '#22d3ee',
  size = 46,
  bipolar = false,
  onChange,
  subControls,
}) => {
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; x: number; startVal: number; moved: boolean } | null>(
    null
  );

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  const range = Math.max(1, max - min);
  const norm = Math.max(0, Math.min(1, (value - min) / range));
  const angle = -135 + norm * 270; // -135 deg (7:30) to +135 deg (4:30)

  const zeroNorm = bipolar ? Math.max(0, Math.min(1, (0 - min) / range)) : 0;
  const zeroAngle = -135 + zeroNorm * 270;

  const hasSavedDiff = savedValue !== undefined && savedValue !== value;
  const savedNorm =
    savedValue !== undefined ? Math.max(0, Math.min(1, (savedValue - min) / range)) : 0;
  const savedAngle = -135 + savedNorm * 270;

  const lastSentRef = useRef(value);
  lastSentRef.current = value;

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dy = dragStartRef.current.y - e.clientY;
      const dx = e.clientX - dragStartRef.current.x;
      const deltaPx = dy + dx * 0.35;

      // 3px deadzone so double-clicks never accidentally alter the value before onDoubleClick fires
      if (!dragStartRef.current.moved && Math.abs(deltaPx) < 3) {
        return;
      }
      dragStartRef.current.moved = true;

      const sensitivity = e.shiftKey ? 260 : 120;
      const nextVal = clamp(dragStartRef.current.startVal + (deltaPx / sensitivity) * range);
      if (nextVal !== lastSentRef.current) {
        lastSentRef.current = nextVal;
        onChange(nextVal);
      }
    };

    const handlePointerUp = () => {
      setDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, min, max, range, onChange]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dir = e.deltaY < 0 ? 1 : -1;
    const next = clamp(value + dir * step);
    if (next !== value) {
      onChange(next);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetVal = resolveKnobReset(value, savedValue, defaultValue, e.shiftKey || e.altKey);
    onChange(targetVal);
  };

  const cx = 26;
  const cy = 26;
  const trackR = 20;
  const capR = 14.5;

  const trackPath = describeArc(cx, cy, trackR, -135, 135);
  const activePath = bipolar
    ? describeArc(cx, cy, trackR, zeroAngle, angle)
    : describeArc(cx, cy, trackR, -135, angle);

  const pointerInner = polarToCartesian(cx, cy, 4.5, angle);
  const pointerOuter = polarToCartesian(cx, cy, capR - 1.5, angle);

  const savedInner = polarToCartesian(cx, cy, trackR - 2.5, savedAngle);
  const savedOuter = polarToCartesian(cx, cy, trackR + 2.5, savedAngle);

  return (
    <div
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      title="Trascina su/giù o usa la rotella · Doppio click: ripristina valore scena / default"
      className="flex flex-col items-center justify-between gap-0.5 select-none group"
    >
      {label ? (
        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 group-hover:text-white tracking-tight uppercase truncate max-w-full leading-tight">
          {label}
        </span>
      ) : null}

      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          dragStartRef.current = {
            y: e.clientY,
            x: e.clientX,
            startVal: value,
            moved: false,
          };
          setDragging(true);
        }}
        className="relative cursor-ns-resize touch-none flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 52 52" className="w-full h-full overflow-visible">
          {/* Background 270° Arc */}
          <path
            d={trackPath}
            fill="none"
            stroke="#1e293b"
            strokeWidth={3.6}
            strokeLinecap="round"
          />

          {/* Active LED Ring Arc */}
          {activePath && (
            <path
              d={activePath}
              fill="none"
              stroke={color}
              strokeWidth={3.6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
            />
          )}

          {/* Saved Scene Value Ghost Tick (Amber) */}
          {hasSavedDiff && (
            <line
              x1={savedInner.x}
              y1={savedInner.y}
              x2={savedOuter.x}
              y2={savedOuter.y}
              stroke="#fbbf24"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Potentiometer Metallic/Dark Cap */}
          <circle
            cx={cx}
            cy={cy}
            r={capR}
            fill="#0b1018"
            stroke={dragging ? color : '#334155'}
            strokeWidth={1.6}
          />
          <circle cx={cx} cy={cy} r={capR - 2.5} fill="#111824" />

          {/* Indicator Line on Cap */}
          <line
            x1={pointerInner.x}
            y1={pointerInner.y}
            x2={pointerOuter.x}
            y2={pointerOuter.y}
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Numeric Readout Badge (Double-click also triggers reset) */}
      <div className="flex items-center gap-1">
        {subControls}
        <span
          onDoubleClick={handleDoubleClick}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer leading-tight ${
            hasSavedDiff
              ? 'bg-slate-950 text-amber-300 border-amber-500/40'
              : 'bg-slate-950/90 text-slate-100 border-slate-800/90 group-hover:border-slate-700'
          }`}
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
};
