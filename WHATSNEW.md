# What's New / Changelog

[English](#english) | [Italiano](#italiano)

---

<a name="english"></a>
## English

All notable changes to **01V96 Studio** are documented here in reverse chronological order.

### [v0.5.7] - 2026-10-28
- **Added**:
  - Direct numeric value input: clicking numerical labels on rotary knobs (`RotaryKnob.tsx`) and fader strips (`FaderStrip.tsx`) opens an inline input field with instant validation and range clamping (supporting dB notation such as `+6.0 dB`, `-inf`, or raw numeric levels).
  - Lightweight error notifications via `Toast.tsx` and WebSocket/HTTP error handling.
  - Live safety confirmation dialogs for Demo Wave (physical motorized faders warning) and Scene Store (overwrite warning).
  - Single source of truth for `ClientCommand`: derived directly from Zod schema via `z.infer<typeof ClientCommandSchema>`.
  - Added `"typecheck": "tsc --noEmit"` to project scripts.
- **Changed**:
  - `YamahaUsbTransport`: Added fader message coalescing (last value wins) to protect hardware queue buffers during rapid fader drags.
  - Atomic persistence with `.tmp` write and `renameSync` in `layout-storage.ts` and `scene-labels-storage.ts`.
  - Graceful shutdown (`SIGINT` and `SIGTERM`) handling in Node.js server.
- **Fixed**:
  - Fixed Zod validation schema for `set_routing` to strictly require `busIndex` when `target === 'bus'`.
  - Fixed TypeScript compiler errors in `widgets.test.ts`.

### [v0.5.6] - 2026-10-28
- **Added**:
  - "Deep Pair" mode: toggleable option in Channel Rack linking EQ, Dynamics, Preamp, Routing, Aux Sends, and Delay across stereo paired channels.
  - Streaming meter protocol in binary format (`ArrayBuffer` over WebSocket) for high-performance DSP telemetry.
- **Fixed**:
  - Synchronized paired fader motion and mute state over WebSocket in real time.

### [v0.5.0] - 2026-10-27
- **Added**:
  - Scene-aware custom channel, aux, bus, and scene labels with disk persistence (`data/scene-labels.json`).
  - Modular channel strip layout system with 24-column grid and customizable presets.
  - Interactive 4-band Parametric EQ curve visualizer with band drag controls.
  - Dynamic meters simulator for offline/demo development.

### [v0.3.0] - 2026-10-25
- **Added**:
  - Multi-client real-time synchronization over WebSocket.
  - Scene Recall (0–99) and Store commands.
  - Channel strip views with preamp, routing, aux sends, compressor, and gate.

### [v0.1.0] - 2026-10-24
- **Added**:
  - Initial direct USB-MIDI communication driver with Yamaha 01V96 / 01V96 VCM using `libusb`.
  - Core SysEx parameter framing and state synchronization.
  - Basic web console interface.

---

<a name="italiano"></a>
## Italiano

Tutte le modifiche rilevanti apportate a **01V96 Studio** sono documentate qui in ordine cronologico inverso.

### [v0.5.7] - 2026-10-28
- **Novità (Added)**:
  - Inserimento diretto dei valori numerici: cliccando sui valori testuali dei potenziometri rotativi (`RotaryKnob.tsx`) e delle channel strip (`FaderStrip.tsx`) compare un campo di input inline con validazione immediata e vincolo al range consentito (supporto notazione dB es. `+6.0 dB`, `-inf` o valori numerici diretti).
  - Notifiche toast leggere per errori tramite `Toast.tsx` e gestione unificata errori WebSocket/HTTP.
  - Finestre di dialogo di conferma per operazioni critiche su hardware reale: attivazione Demo Wave (avviso movimento motorizzato fader) e Store Memoria Scena (avviso sovrascrittura).
  - Singola fonte di verità per `ClientCommand`: derivato direttamente dallo schema Zod tramite `z.infer<typeof ClientCommandSchema>`.
  - Aggiunto comando `"typecheck": "tsc --noEmit"` negli script del progetto.
- **Modifiche (Changed)**:
  - `YamahaUsbTransport`: coalescing dei messaggi fader nella coda di invio ("last value wins") per preservare i buffer hardware durante movimenti rapidi.
  - Persistenza atomica su disco tramite scrittura su file temporaneo `.tmp` e `renameSync` in `layout-storage.ts` e `scene-labels-storage.ts`.
  - Gestione del segnale di terminazione controllata (`SIGINT` e `SIGTERM`) nel server Node.js.
- **Correzioni (Fixed)**:
  - Corretto schema di validazione Zod per `set_routing` che ora richiede obbligatoriamente `busIndex` se `target === 'bus'`.
  - Risolti errori di compilazione TypeScript nei test di `widgets.test.ts`.

### [v0.5.6] - 2026-10-28
- **Novità (Added)**:
  - Modalità "Deep Pair": opzione attivabile nel Channel Rack per sincronizzare istantaneamente EQ, Dinamica, Preamp, Routing, mandate Aux e Delay tra canali accoppiati in stereo.
  - Streaming meter in formato binario (`ArrayBuffer` su WebSocket) per telemetria DSP ad alta frequenza e basso overhead.
- **Correzioni (Fixed)**:
  - Sincronizzazione in tempo reale via WebSocket del movimento fader e dello stato mute tra canali in pair.

### [v0.5.0] - 2026-10-27
- **Novità (Added)**:
  - Etichette personalizzate per canale, mandate aux, bus e titolo scena persistenti su file JSON (`data/scene-labels.json`).
  - Layout modulare a 24 colonne con preset personalizzabili e strip riconfigurabili.
  - Visualizzatore interattivo della curva di equalizzazione parametrica a 4 bande con manipolazione diretta dei punti.
  - Simulatore DSP di dinamica e meter per test offline.

### [v0.3.0] - 2026-10-25
- **Novità (Added)**:
  - Sincronizzazione multi-client in tempo reale tramite WebSocket.
  - Richiamo e salvataggio delle memorie di scena (0–99).
  - Viste channel strip con preamp, routing, mandate aux, compressore e noise gate.

### [v0.1.0] - 2026-10-24
- **Novità (Added)**:
  - Driver di comunicazione diretta USB-MIDI con Yamaha 01V96 / 01V96 VCM via `libusb`.
  - Protocollo di framing SysEx e sincronizzazione dello stato mixer.
  - Interfaccia web console iniziale.
