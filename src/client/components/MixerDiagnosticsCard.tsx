import React, { useCallback, useEffect, useState } from 'react';
import {
  ClientCommand,
  MixerState,
  SysExPingResult,
  UsbDiagnosticsReport,
} from '../../shared/types';

interface MixerDiagnosticsCardProps {
  state: MixerState;
  sendCommand: (cmd: ClientCommand) => void;
}

export const MixerDiagnosticsCard: React.FC<MixerDiagnosticsCardProps> = ({
  state,
  sendCommand,
}) => {
  const [report, setReport] = useState<UsbDiagnosticsReport | null>(null);
  const [pingResult, setPingResult] = useState<SysExPingResult | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingReconnect, setLoadingReconnect] = useState(false);
  const [loadingPing, setLoadingPing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const usbCable = state.studioSettings?.usbCable ?? 0;
  const midiChannel = state.studioSettings?.midiChannel ?? 1;

  const runScan = useCallback(async () => {
    setLoadingScan(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/diagnostics/usb');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UsbDiagnosticsReport = await res.json();
      setReport(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Errore scansione USB');
    } finally {
      setLoadingScan(false);
    }
  }, []);

  useEffect(() => {
    runScan();
  }, [runScan, state.connected]);

  const runReconnect = async (pidOverride?: number) => {
    setLoadingReconnect(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/diagnostics/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pidOverride ? { pidOverride } : {}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.report) setReport(data.report);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Errore riconnessione USB');
    } finally {
      setLoadingReconnect(false);
    }
  };

  const runPing = async (autoProbe: boolean) => {
    setLoadingPing(true);
    setFetchError(null);
    setPingResult(null);
    try {
      const res = await fetch('/api/diagnostics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cable: usbCable,
          midiChannel,
          autoProbe,
          timeoutMs: autoProbe ? 800 : 1200,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data: SysExPingResult = await res.json();
      setPingResult(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Errore durante il ping SysEx');
    } finally {
      setLoadingPing(false);
    }
  };

  const copyDiagnosticReport = async () => {
    const payload = {
      usbDiagnostics: report,
      lastPing: pingResult,
      studioSettings: {
        usbCable,
        midiChannel,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFetchError('Impossibile copiare negli appunti dal browser.');
    }
  };

  const severityStyles: Record<string, string> = {
    ok: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200',
    info: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200',
    warn: 'bg-amber-500/10 border-amber-500/40 text-amber-200',
    error: 'bg-rose-500/10 border-rose-500/40 text-rose-200',
  };

  const severityIcon: Record<string, string> = {
    ok: '✅',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  return (
    <div className="bg-[#0c1018] border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-mono font-bold text-emerald-300 uppercase">
              🩺 DIAGNOSTICA & RILEVAMENTO MIXER USB
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
            {report && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300">
                {report.platform}/{report.arch} • Node {report.nodeVersion}
                {report.inDocker ? ' • DOCKER' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Verifica i dispositivi Yamaha rilevati dal sistema operativo, individua conflitti driver/permessi
            e testa la comunicazione SysEx (DIO/SETUP → MIDI/HOST).
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runScan}
            disabled={loadingScan}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition disabled:opacity-50"
          >
            {loadingScan ? '⏳ Scansione...' : '🔍 Scansiona USB'}
          </button>
          <button
            onClick={() => runReconnect()}
            disabled={loadingReconnect}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-mono font-bold cursor-pointer transition disabled:opacity-50"
          >
            {loadingReconnect ? '⏳ Riconnessione...' : '🔌 Riconnetti'}
          </button>
          <button
            onClick={() => runPing(false)}
            disabled={loadingPing || !state.connected}
            className="px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loadingPing ? '⏳ Test...' : '📡 Ping SysEx'}
          </button>
          <button
            onClick={() => runPing(true)}
            disabled={loadingPing || !state.connected}
            title="Prova automaticamente USB Port 1..8 e MIDI Channel 1..16"
            className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-mono font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🧭 Auto-Probe
          </button>
          <button
            onClick={copyDiagnosticReport}
            disabled={!report}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono cursor-pointer transition disabled:opacity-40"
          >
            {copied ? '✅ Copiato!' : '📋 Copia Report'}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-mono text-rose-200">
          ❌ {fetchError}
        </div>
      )}

      {/* USB Port & MIDI Channel Override */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-[#070a0f] border border-slate-800/90 rounded-xl p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase">
            USB-MIDI Port (Cable)
          </label>
          <select
            value={usbCable}
            onChange={(e) =>
              sendCommand({
                type: 'set_studio_settings',
                usbCable: Number(e.target.value),
              })
            }
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-200"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>
                USB Port {i + 1} (Cable {i}){i === 0 ? ' — Default' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase">
            MIDI Device ID / Channel
          </label>
          <select
            value={midiChannel}
            onChange={(e) =>
              sendCommand({
                type: 'set_studio_settings',
                midiChannel: Number(e.target.value),
              })
            }
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-200"
          >
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Channel {i + 1}
                {i === 0 ? ' — Default' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-center gap-0.5 text-[11px] font-mono text-slate-400">
          <div>
            Dispositivi USB totali OS:{' '}
            <strong className="text-slate-200">{report ? report.totalUsbDevices : '—'}</strong>
          </div>
          <div>
            Dispositivi Yamaha (0x0499):{' '}
            <strong className={report && report.yamahaDevices.length > 0 ? 'text-emerald-300' : 'text-amber-300'}>
              {report ? report.yamahaDevices.length : '—'}
            </strong>
          </div>
          {report?.activeDevice && (
            <div className="text-emerald-300 truncate">
              Attivo: {report.activeDevice.vid}:{report.activeDevice.pid} (if#{report.activeDevice.interfaceIndex})
            </div>
          )}
        </div>
      </div>

      {/* Last libusb Error (when disconnected) */}
      {report && !state.connected && report.lastError && (
        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-200 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">Ultimo errore USB ({report.lastErrorCode ?? 'USB_ERROR'}):</span>
            {report.lastAttemptAt && (
              <span className="text-[10px] text-rose-300/70">
                {new Date(report.lastAttemptAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <code className="text-[11px] text-rose-100 break-all">{report.lastError}</code>
        </div>
      )}

      {/* Smart Diagnostic Hints */}
      {report && report.hints.length > 0 && (
        <div className="flex flex-col gap-2">
          {report.hints.map((hint, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs font-mono flex flex-col gap-1 ${
                severityStyles[hint.severity] || severityStyles.info
              }`}
            >
              <div className="font-bold">
                {severityIcon[hint.severity] || 'ℹ️'} {hint.title}
              </div>
              <div className="opacity-90 leading-relaxed">{hint.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* Detected Yamaha USB Devices */}
      {report && report.yamahaDevices.length > 0 && (
        <div className="bg-[#070a0f] border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="text-[11px] font-mono font-bold text-slate-300 uppercase">
            Dispositivi Yamaha rilevati sul bus USB
          </div>
          <div className="flex flex-col gap-2">
            {report.yamahaDevices.map((dev, idx) => (
              <div
                key={`${dev.busNumber}-${dev.deviceAddress}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300 font-bold">
                      {dev.vid}:{dev.pid}
                    </span>
                    <span className="text-slate-200">
                      {dev.matchedModel ?? 'Dispositivo Yamaha sconosciuto'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Bus {dev.busNumber} / Addr {dev.deviceAddress} • {dev.interfaceCount} if
                    </span>
                  </div>
                  {dev.endpointsSummary.length > 0 && (
                    <div className="text-[10px] text-slate-400 break-all">
                      {dev.endpointsSummary.join(' | ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => runReconnect(dev.pidNum)}
                  disabled={loadingReconnect}
                  className="px-2.5 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-[11px] font-mono font-bold cursor-pointer transition disabled:opacity-50"
                >
                  Connetti ({dev.pid})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SysEx Ping Result */}
      {pingResult && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex flex-col gap-2 ${
            pingResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              {pingResult.ok ? '✅ Handshake SysEx OK' : '⚠️ Nessuna risposta SysEx dal mixer'}
            </span>
            {pingResult.latencyMs !== null && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px]">
                {pingResult.latencyMs} ms • {pingResult.responsesReceived} msg
              </span>
            )}
          </div>
          <p className="leading-relaxed">{pingResult.diagnosis}</p>

          {(pingResult.detectedCable !== undefined || pingResult.detectedMidiChannel !== undefined) && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() =>
                  sendCommand({
                    type: 'set_studio_settings',
                    usbCable: pingResult.detectedCable ?? usbCable,
                    midiChannel: pingResult.detectedMidiChannel ?? midiChannel,
                  })
                }
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition"
              >
                Applica USB Port {(pingResult.detectedCable ?? usbCable) + 1} / MIDI Ch{' '}
                {pingResult.detectedMidiChannel ?? midiChannel}
              </button>
            </div>
          )}

          {pingResult.sampleHex.length > 0 && (
            <code className="text-[10px] text-slate-300 bg-slate-950/70 p-2 rounded-lg overflow-x-auto">
              RX: {pingResult.sampleHex[0]}
            </code>
          )}
        </div>
      )}

      {/* Quick Mixer DIO/SETUP Checklist */}
      <details className="bg-[#070a0f] border border-slate-800/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-400">
        <summary className="cursor-pointer text-slate-300 font-bold select-none">
          📘 Checklist impostazioni consigliate sul mixer fisico Yamaha 01V96
        </summary>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong className="text-cyan-300">DIO/SETUP → MIDI/HOST</strong>: imposta{' '}
            <code className="text-slate-200">GENERAL</code> /{' '}
            <code className="text-slate-200">STUDIO MANAGER</code> su{' '}
            <code className="text-emerald-300">USB</code> (Port 1).
          </li>
          <li>
            <strong className="text-cyan-300">MIDI → SETUP</strong>: imposta{' '}
            <code className="text-slate-200">TX CH = 1</code>,{' '}
            <code className="text-slate-200">RX CH = 1</code>,{' '}
            <code className="text-emerald-300">PARAMETER CHANGE TX/RX = ON</code>.
          </li>
          <li>
            <strong className="text-cyan-300">Compatibilità</strong>: Yamaha 01V96 (v1), 01V96V2 e
            01V96 VCM (VID <code className="text-slate-200">0x0499</code>, PID{' '}
            <code className="text-slate-200">0x5008</code>). Su macOS chiudi Studio Manager / DAW
            (il driver Yamaha USB-MIDI può impedire il claim diretto via libusb).
          </li>
        </ul>
      </details>
    </div>
  );
};
