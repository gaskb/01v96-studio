import React, { useState } from 'react';
import { WidgetId } from './layoutTypes';

export interface WidgetOption {
  id: WidgetId;
  label: string;
  category: string;
}

export const AVAILABLE_WIDGET_OPTIONS: WidgetOption[] = [
  { id: 'meter_vu', label: '🕰️ VU-Meters Analogici (IN / GR / OUT)', category: 'Metering' },
  { id: 'meter_vertical', label: '📶 Indicatori LED Verticali (IN / GR / OUT)', category: 'Metering' },
  { id: 'eq_graph', label: '📊 Analizzatore Spettro & Curva EQ', category: 'Equalizzatore' },
  { id: 'compressor', label: '🎛️ Compressore Dinamico', category: 'Dinamiche' },
  { id: 'gate', label: '🚪 Noise Gate Dinamico', category: 'Dinamiche' },
  { id: 'preamp', label: '🎚️ Preamp (ATTEN & PAN)', category: 'Preamp' },
  { id: 'eq_bands', label: '🎛️ Stack 4 Bande Parametriche EQ', category: 'Equalizzatore' },
  { id: 'eq_high', label: '🔵 EQ Banda HIGH (Acuti)', category: 'Bande EQ' },
  { id: 'eq_himid', label: '🟢 EQ Banda HI-MID (Medio-Acuti)', category: 'Bande EQ' },
  { id: 'eq_lomid', label: '🟡 EQ Banda LO-MID (Medio-Bassi)', category: 'Bande EQ' },
  { id: 'eq_low', label: '🔴 EQ Banda LOW (Bassi)', category: 'Bande EQ' },
  { id: 'aux_1_2', label: '🎚️ Mandate AUX 1 & 2', category: 'Mandate Aux' },
  { id: 'aux_3_4', label: '🎚️ Mandate AUX 3 & 4', category: 'Mandate Aux' },
  { id: 'aux_5_6', label: '🎚️ Mandate AUX 5 & 6', category: 'Mandate Aux' },
  { id: 'aux_7_8', label: '🎚️ Mandate AUX 7 & 8', category: 'Mandate Aux' },
  { id: 'aux_sends', label: '🎚️ Tutte le Mandate AUX 1-8', category: 'Mandate Aux' },
  { id: 'routing', label: '🔀 Bus Routing & Delay', category: 'Routing' },
];

interface AddWidgetDropdownProps {
  onAddWidget: (widgetId: WidgetId) => void;
  className?: string;
  buttonLabel?: string;
}

export const AddWidgetDropdown: React.FC<AddWidgetDropdownProps> = ({
  onAddWidget,
  className = '',
  buttonLabel = '+',
}) => {
  const [selectedId, setSelectedId] = useState<WidgetId>('meter_vu');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAdd = () => {
    onAddWidget(selectedId);
    setFeedback('Aggiunto!');
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <div className={`flex items-center gap-1.5 bg-[#0b0e14] border border-cyan-500/40 rounded-lg px-2 py-1 shadow-sm ${className}`}>
      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider hidden sm:inline">
        AGGIUNGI:
      </span>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value as WidgetId)}
        className="bg-transparent text-xs font-mono text-slate-100 focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[210px] md:max-w-[260px] truncate"
        title="Seleziona un modulo o strumento da inserire nel canale"
      >
        <optgroup label="Metering & VU" className="bg-slate-900 text-amber-400 font-bold">
          <option value="meter_vu" className="bg-slate-900 text-slate-100">
            🕰️ VU-Meters Analogici (IN / GR / OUT)
          </option>
          <option value="meter_vertical" className="bg-slate-900 text-slate-100">
            📶 Indicatori LED Verticali (IN / GR / OUT)
          </option>
        </optgroup>

        <optgroup label="Equalizzazione" className="bg-slate-900 text-sky-400 font-bold">
          <option value="eq_graph" className="bg-slate-900 text-slate-100">
            📊 Spettro & Curva EQ Interattiva
          </option>
          <option value="eq_bands" className="bg-slate-900 text-slate-100">
            🎛️ Tutte le 4 Bande Parametriche EQ
          </option>
          <option value="eq_high" className="bg-slate-900 text-slate-100">
            🔵 EQ Banda HIGH
          </option>
          <option value="eq_himid" className="bg-slate-900 text-slate-100">
            🟢 EQ Banda HI-MID
          </option>
          <option value="eq_lomid" className="bg-slate-900 text-slate-100">
            🟡 EQ Banda LO-MID
          </option>
          <option value="eq_low" className="bg-slate-900 text-slate-100">
            🔴 EQ Banda LOW
          </option>
        </optgroup>

        <optgroup label="Dinamiche & Preamp" className="bg-slate-900 text-emerald-400 font-bold">
          <option value="compressor" className="bg-slate-900 text-slate-100">
            🎛️ Compressore Dinamico
          </option>
          <option value="gate" className="bg-slate-900 text-slate-100">
            🚪 Noise Gate Dinamico
          </option>
          <option value="preamp" className="bg-slate-900 text-slate-100">
            🎚️ Preamp (ATTEN & PAN)
          </option>
        </optgroup>

        <optgroup label="Mandate Ausiliarie & Routing" className="bg-slate-900 text-amber-400 font-bold">
          <option value="aux_sends" className="bg-slate-900 text-slate-100">
            🎚️ Tutte le Mandate AUX 1-8
          </option>
          <option value="aux_1_2" className="bg-slate-900 text-slate-100">
            🎚️ Mandate AUX 1 & 2
          </option>
          <option value="aux_3_4" className="bg-slate-900 text-slate-100">
            🎚️ Mandate AUX 3 & 4
          </option>
          <option value="aux_5_6" className="bg-slate-900 text-slate-100">
            🎚️ Mandate AUX 5 & 6
          </option>
          <option value="aux_7_8" className="bg-slate-900 text-slate-100">
            🎚️ Mandate AUX 7 & 8
          </option>
          <option value="routing" className="bg-slate-900 text-slate-100">
            🔀 Bus Routing & Delay
          </option>
        </optgroup>
      </select>

      <button
        onClick={handleAdd}
        title="Inserisci questo modulo nel rack del canale"
        className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono cursor-pointer transition shadow-[0_0_8px_rgba(6,182,212,0.4)] flex items-center gap-1 shrink-0"
      >
        <span>{buttonLabel}</span>
      </button>

      {feedback && (
        <span className="text-[10px] font-mono text-emerald-400 font-bold animate-pulse">
          {feedback}
        </span>
      )}
    </div>
  );
};
