import React, { useState } from 'react';
import { formatPan } from '../../../shared/converters';
import { ClientCommand, ControlMode, InputChannelState } from '../../../shared/types';
import { resolveKnobReset } from '../RotaryKnob';
import { handleSliderWheel } from './sliderWheelHelper';

export type ChannelStripTabId = 'eq' | 'dyn' | 'aux' | 'routing';

interface ChannelStripHeaderProps {
  channel: InputChannelState;
  savedChannel?: InputChannelState;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  activeTab: ChannelStripTabId;
  onSelectTab: (tab: ChannelStripTabId) => void;
  sendCommand: (cmd: ClientCommand) => void;
}

export const ChannelStripHeader: React.FC<ChannelStripHeaderProps> = ({
  channel,
  savedChannel,
  controlMode,
  onChangeControlMode,
  activeTab,
  onSelectTab,
  sendCommand,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(channel.name);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
      <div className="flex flex-wrap items-center gap-2">
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
          className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-sm cursor-pointer flex items-center gap-1.5"
        >
          <span>CH {channel.id} —</span>
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
              className="bg-transparent text-cyan-200 outline-none w-36"
            />
          ) : (
            <span className="truncate max-w-[200px]" title={channel.name}>
              {channel.name || `CH${channel.id}`}
            </span>
          )}
        </div>

        {/* Stereo Pair Toggle */}
        <button
          onClick={() => sendCommand({ type: 'set_pair', id: channel.id, value: !channel.pair })}
          className={`px-2 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
            channel.pair
              ? 'bg-purple-500/20 border-purple-400 text-purple-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          🔗 PAIR {channel.pair ? 'ON' : 'OFF'}
        </button>

        {/* Phase Normal/Reverse */}
        <button
          onClick={() => sendCommand({ type: 'set_phase', id: channel.id, value: !channel.phase })}
          className={`px-2 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
            channel.phase
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Ø {channel.phase ? '180°' : 'NORM'}
        </button>

        {/* Digital Attenuator (-36..+18 dB) */}
        <div
          onDoubleClick={(e) =>
            sendCommand({
              type: 'set_att',
              id: channel.id,
              value: resolveKnobReset(
                channel.att,
                savedChannel?.att,
                0,
                e.shiftKey || e.altKey
              ),
            })
          }
          title="Doppio click: ripristina valore memorizzato nella scena · Rotella mouse: regola"
          className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1 select-none cursor-pointer"
        >
          <span className="text-[10px] font-mono text-slate-400">ATT</span>
          <input
            type="range"
            min={-360}
            max={180}
            value={channel.att}
            onChange={(e) =>
              sendCommand({ type: 'set_att', id: channel.id, value: Number(e.target.value) })
            }
            onWheel={(e) =>
              handleSliderWheel(e, channel.att, -360, 180, 5, (val) =>
                sendCommand({ type: 'set_att', id: channel.id, value: val })
              )
            }
            className="w-16 accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
          <span className="text-[10px] font-mono text-slate-200 w-12 text-right">
            {(channel.att / 10).toFixed(1)}dB
          </span>
        </div>

        {/* Pan Control */}
        <div
          onDoubleClick={(e) =>
            sendCommand({
              type: 'set_pan',
              target: 'ch',
              id: channel.id,
              value: resolveKnobReset(
                channel.pan,
                savedChannel?.pan,
                0,
                e.shiftKey || e.altKey
              ),
            })
          }
          title="Doppio click: ripristina Pan memorizzato nella scena · Rotella mouse: regola"
          className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1 select-none cursor-pointer"
        >
          <span className="text-[10px] font-mono text-slate-400">PAN</span>
          <input
            type="range"
            min={-63}
            max={63}
            value={channel.pan}
            onChange={(e) =>
              sendCommand({
                type: 'set_pan',
                target: 'ch',
                id: channel.id,
                value: Number(e.target.value),
              })
            }
            onWheel={(e) =>
              handleSliderWheel(e, channel.pan, -63, 63, 1, (val) =>
                sendCommand({ type: 'set_pan', target: 'ch', id: channel.id, value: val })
              )
            }
            className="w-16 accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
          <span className="text-[10px] font-mono text-cyan-300 w-7 text-right">
            {formatPan(channel.pan)}
          </span>
        </div>
      </div>

      {/* Right Controls: Control Style Switcher (Knobs vs Sliders) + Section Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          title="Scegli tra Potenziometri Rotanti (stile console) e Barre Slider"
          className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono"
        >
          <button
            onClick={() => onChangeControlMode('knobs')}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
              controlMode === 'knobs'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎛️ KNOBS
          </button>
          <button
            onClick={() => onChangeControlMode('sliders')}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition ${
              controlMode === 'sliders'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎚️ SLIDERS
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[
            { id: 'eq', label: '📊 4-BAND EQ' },
            { id: 'dyn', label: '🎛️ GATE & COMP' },
            { id: 'aux', label: '🎚️ AUX 1-8' },
            { id: 'routing', label: '🔀 ROUTING & DELAY' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTab(t.id as ChannelStripTabId)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer ${
                activeTab === t.id
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
