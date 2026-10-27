import React, { useMemo } from 'react';

interface SingleVuMeterProps {
  type: 'in' | 'out' | 'gr';
  value: number; // For in/out: 0..255; For gr: 0..24 dB
  label: string;
  subLabel?: string;
}

/**
 * Calculates needle angle (-36deg to +34deg) for IN/OUT and GR meters.
 */
function calculateNeedleAngle(type: 'in' | 'out' | 'gr', val: number): number {
  if (type === 'gr') {
    // GR Meter: 0 dB is at the far RIGHT (+32 deg)
    // As gain reduction increases (grDb > 0), the needle swings to the LEFT (-35 deg)
    const gr = Math.max(0, Math.min(20, val));
    if (gr <= 0.05) return 32;
    // Non-linear deflection: 0..20 dB mapped to +32 deg down to -35 deg
    const norm = Math.pow(gr / 20, 0.72); // slightly non-linear response
    return 32 - norm * 67;
  }

  // IN / OUT Meters: 0..255 level
  // 0 level rests at -36 deg
  if (val <= 0) return -36;
  const norm = Math.min(1, val / 255);
  // Power curve to model logarithmic VU ballistic
  const logFactor = Math.pow(norm, 0.65);
  return -36 + logFactor * 70; // -36 deg up to +34 deg
}

export const SingleVuMeter: React.FC<SingleVuMeterProps> = ({
  type,
  value,
  label,
  subLabel,
}) => {
  const angle = useMemo(() => calculateNeedleAngle(type, value), [type, value]);

  const isGr = type === 'gr';

  // Readout string
  let displayReadout = '';
  if (isGr) {
    displayReadout = value > 0.1 ? `-${value.toFixed(1)} dB` : '0 dB';
  } else {
    displayReadout = value <= 0 ? '-∞' : `${(-60 + (value / 255) * 60).toFixed(1)} dB`;
  }

  return (
    <div className="flex flex-col items-center bg-[#0e131d] border border-amber-900/40 rounded-xl p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] select-none w-full max-w-[210px]">
      {/* Header Label */}
      <div className="flex items-center justify-between w-full px-1 mb-1 border-b border-amber-900/30 pb-0.5">
        <span
          className={`text-[9px] font-mono font-bold tracking-wider uppercase ${
            isGr ? 'text-amber-400' : type === 'in' ? 'text-cyan-400' : 'text-emerald-400'
          }`}
        >
          {label}
        </span>
        <span className="text-[9px] font-mono text-slate-400 font-semibold">{displayReadout}</span>
      </div>

      {/* Analog Meter Glass & Dial Face */}
      <div className="relative w-full aspect-[14/9] rounded-lg overflow-hidden bg-gradient-to-b from-[#f9f5e8] via-[#f4ecd2] to-[#dfd3b0] border border-[#786c4e] shadow-[inset_0_2px_6px_rgba(0,0,0,0.4),0_1px_3px_rgba(255,255,255,0.1)]">
        {/* Subtle Incandescent Bulb Warm Glow */}
        <div className="absolute inset-0 bg-radial from-amber-200/40 via-transparent to-amber-950/20 pointer-events-none" />

        <svg viewBox="0 0 140 90" className="w-full h-full">
          <defs>
            <filter id={`needle-shadow-${type}`} x="-20%" y="-20%" width="150%" height="150%">
              <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#000000" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Scale Arcs */}
          {isGr ? (
            // GR Scale: 0 is on the RIGHT, -20 on the LEFT
            <>
              {/* Main scale arc */}
              <path
                d="M 28 42 A 70 70 0 0 1 112 42"
                fill="none"
                stroke="#332a1e"
                strokeWidth="1.2"
              />
              {/* Highlight arc for extreme reduction */}
              <path
                d="M 28 42 A 70 70 0 0 1 54 34"
                fill="none"
                stroke="#b91c1c"
                strokeWidth="2"
              />

              {/* Ticks and Labels: -20, -15, -10, -6, -3, -1, 0 */}
              <line x1="28" y1="42" x2="33" y2="45" stroke="#b91c1c" strokeWidth="1.2" />
              <text x="24" y="52" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#b91c1c">20</text>

              <line x1="42" y1="36" x2="45" y2="40" stroke="#332a1e" strokeWidth="1" />
              <text x="39" y="47" fontSize="5" fontFamily="monospace" fill="#443828">15</text>

              <line x1="57" y1="33" x2="59" y2="38" stroke="#332a1e" strokeWidth="1" />
              <text x="55" y="45" fontSize="5" fontFamily="monospace" fill="#443828">10</text>

              <line x1="73" y1="33" x2="73" y2="38" stroke="#332a1e" strokeWidth="1" />
              <text x="71" y="45" fontSize="5" fontFamily="monospace" fill="#443828">6</text>

              <line x1="88" y1="35" x2="86" y2="40" stroke="#332a1e" strokeWidth="1" />
              <text x="86" y="47" fontSize="5" fontFamily="monospace" fill="#443828">3</text>

              <line x1="101" y1="38" x2="98" y2="43" stroke="#332a1e" strokeWidth="1" />
              <text x="98" y="50" fontSize="5" fontFamily="monospace" fill="#443828">1</text>

              <line x1="112" y1="42" x2="108" y2="46" stroke="#047857" strokeWidth="1.4" />
              <text x="110" y="52" fontSize="6.5" fontFamily="monospace" fontWeight="bold" fill="#047857">0</text>

              <text x="70" y="22" textAnchor="middle" fontSize="5" fontFamily="monospace" fontWeight="bold" fill="#78603e" letterSpacing="0.5">
                GAIN REDUCTION dB
              </text>
            </>
          ) : (
            // Standard VU Scale: -20 dB on left to +3 dB on right
            <>
              {/* Black normal arc (-20 to 0) */}
              <path
                d="M 28 42 A 70 70 0 0 1 98 34"
                fill="none"
                stroke="#332a1e"
                strokeWidth="1.2"
              />
              {/* Red overload arc (0 to +3) */}
              <path
                d="M 98 34 A 70 70 0 0 1 114 42"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2.5"
              />

              {/* Ticks and Labels: -20, -10, -7, -5, -3, -1, 0, +1, +2, +3 */}
              <line x1="28" y1="42" x2="33" y2="45" stroke="#332a1e" strokeWidth="1" />
              <text x="23" y="52" fontSize="5" fontFamily="monospace" fill="#443828">-20</text>

              <line x1="45" y1="36" x2="48" y2="40" stroke="#332a1e" strokeWidth="1" />
              <text x="43" y="47" fontSize="5" fontFamily="monospace" fill="#443828">-10</text>

              <line x1="62" y1="33" x2="63" y2="38" stroke="#332a1e" strokeWidth="1" />
              <text x="61" y="45" fontSize="5" fontFamily="monospace" fill="#443828">-5</text>

              <line x1="78" y1="33" x2="77" y2="38" stroke="#332a1e" strokeWidth="1" />
              <text x="76" y="45" fontSize="5" fontFamily="monospace" fill="#443828">-3</text>

              <line x1="98" y1="34" x2="96" y2="40" stroke="#dc2626" strokeWidth="1.4" />
              <text x="96" y="47" fontSize="6.5" fontFamily="monospace" fontWeight="bold" fill="#dc2626">0</text>

              <line x1="106" y1="37" x2="103" y2="42" stroke="#dc2626" strokeWidth="1" />
              <line x1="114" y1="42" x2="110" y2="46" stroke="#dc2626" strokeWidth="1.4" />
              <text x="111" y="52" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#dc2626">+3</text>

              <text x="70" y="22" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fontWeight="bold" fill="#78603e" letterSpacing="1">
                VU
              </text>
            </>
          )}

          {/* Sub-label */}
          {subLabel && (
            <text x="70" y="58" textAnchor="middle" fontSize="4.5" fontFamily="monospace" fill="#8c7a5c">
              {subLabel}
            </text>
          )}

          {/* Needle with authentic analog inertia */}
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: '70px 92px',
              transition: 'transform 85ms cubic-bezier(0.12, 0.88, 0.32, 1)',
            }}
          >
            {/* Needle Line */}
            <line
              x1="70"
              y1="92"
              x2="70"
              y2="28"
              stroke={isGr ? '#b45309' : '#1e293b'}
              strokeWidth="1.2"
              strokeLinecap="round"
              filter={`url(#needle-shadow-${type})`}
            />
            {/* Needle Tip Red Accent */}
            <line
              x1="70"
              y1="34"
              x2="70"
              y2="28"
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>

          {/* Pivot Screw / Cap */}
          <circle cx="70" cy="92" r="8" fill="#1e1e1e" stroke="#524838" strokeWidth="1" />
          <circle cx="70" cy="92" r="4" fill="#3a342a" />
          <line x1="68" y1="92" x2="72" y2="92" stroke="#6b5e4a" strokeWidth="0.8" />
        </svg>

        {/* Vintage Glass Reflection Glare */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-lg" />
      </div>
    </div>
  );
};

interface TripleVuMeterBridgeProps {
  meterIn: number;
  meterOut: number;
  grDb?: number;
  channelName?: string;
  onToggleStyle?: () => void;
  currentStyle?: 'vu' | 'led';
}

/**
 * 3 Vintage Analog VU-Meters (IN, GR with zero on right, OUT)
 */
export const TripleVuMeterBridge: React.FC<TripleVuMeterBridgeProps> = ({
  meterIn,
  meterOut,
  grDb = 0,
  channelName,
  onToggleStyle,
  currentStyle = 'vu',
}) => {
  return (
    <div className="bg-[#070a0f] border border-amber-900/30 rounded-xl p-2.5 flex flex-col gap-2 w-full shadow-lg">
      {/* Top Bar with Channel Label and Style Switcher */}
      <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-amber-300 uppercase tracking-wider">
            ANALOG VU METERS {channelName ? `— ${channelName}` : ''}
          </span>
        </div>

        {onToggleStyle && (
          <div className="flex items-center gap-1 bg-[#0b0e14] border border-slate-800 rounded-md p-0.5">
            <button
              onClick={onToggleStyle}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition ${
                currentStyle === 'led'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LED
            </button>
            <button
              onClick={onToggleStyle}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition ${
                currentStyle === 'vu'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VU
            </button>
          </div>
        )}
      </div>

      {/* 3 Analog Needle Meters: IN, GR (zero on right!), OUT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center justify-items-center py-1">
        <SingleVuMeter
          type="in"
          value={meterIn}
          label="INPUT VU"
          subLabel="PRE-DSP"
        />

        <SingleVuMeter
          type="gr"
          value={grDb}
          label="GAIN REDUCTION"
          subLabel="DYNAMICS"
        />

        <SingleVuMeter
          type="out"
          value={meterOut}
          label="OUTPUT VU"
          subLabel="POST-FADER"
        />
      </div>
    </div>
  );
};
