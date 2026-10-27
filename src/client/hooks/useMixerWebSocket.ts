import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientCommand, MixerState } from '../../shared/types';

export interface LiveMetersState {
  metersIn: Record<string, number>;
  metersOut: Record<string, number>;
  grs: Record<string, number>;
  stereoMeter: number;
}

export function useMixerWebSocket() {
  const [state, setState] = useState<MixerState | null>(null);
  const [savedState, setSavedState] = useState<MixerState | null>(null);
  const [liveMeters, setLiveMeters] = useState<LiveMetersState>({
    metersIn: {},
    metersOut: {},
    grs: {},
    stereoMeter: 0,
  });
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWs = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'full_state') {
            setState(msg.state);
            setSavedState(structuredClone(msg.state));
          } else if (msg.type === 'state_patch') {
            setState((prev) => {
              if (!prev) return prev;
              const next = { ...prev, ...msg.patch };
              if (
                msg.patch.sceneNumber !== undefined &&
                msg.patch.sceneNumber !== prev.sceneNumber
              ) {
                setSavedState(structuredClone(next));
              }
              return next;
            });
          } else if (msg.type === 'channel_update') {
            setState((prev) => {
              if (!prev) return prev;
              if (msg.target === 'ch') {
                const channels = prev.channels.map((c) =>
                  c.id === msg.id ? { ...c, ...msg.changes } : c
                );
                const savedChannels = msg.savedChannel
                  ? (prev.savedChannels ?? prev.channels).map((c) =>
                      c.id === msg.id ? msg.savedChannel : c
                    )
                  : prev.savedChannels;
                return { ...prev, channels, savedChannels };
              }
              if (msg.target === 'aux') {
                const auxes = prev.auxes.map((a) =>
                  a.id === msg.id ? { ...a, ...msg.changes } : a
                );
                return { ...prev, auxes };
              }
              if (msg.target === 'bus') {
                const buses = prev.buses.map((b) =>
                  b.id === msg.id ? { ...b, ...msg.changes } : b
                );
                return { ...prev, buses };
              }
              if (msg.target === 'stereo') {
                return { ...prev, stereo: { ...prev.stereo, ...msg.changes } };
              }
              return prev;
            });
          } else if (msg.type === 'meters') {
            setLiveMeters({
              metersIn: msg.metersIn ?? {},
              metersOut: msg.metersOut ?? {},
              grs: msg.grs ?? {},
              stereoMeter: msg.stereoMeter ?? 0,
            });
          } else if (msg.type === 'wave_frame') {
            setState((prev) => {
              if (!prev) return prev;
              const channels = prev.channels.map((c) =>
                msg.faders[c.id] !== undefined ? { ...c, fader: msg.faders[c.id] } : c
              );
              return { ...prev, channels };
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 1500);
      };
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const sendCommand = useCallback((cmd: ClientCommand) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    } else {
      fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      }).catch(() => {});
    }
  }, []);

  return {
    state,
    savedState,
    liveMeters,
    wsConnected,
    sendCommand,
  };
}
