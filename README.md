# 🎚️ 01V96 Studio

[English](#english) | [Italiano](#italiano)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/gaskb/01v96-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/gaskb/01v96-studio/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](Dockerfile)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-gaskb%2F01v96--studio-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/gaskb/01v96-studio)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-orange?style=flat&logo=kofi)](https://ko-fi.com/gaskb)

---

<a name="english"></a>
## English

Modern Web Remote Controller & Channel Strip Interface for **Yamaha 01V96 / 01V96 VCM** digital mixing consoles.

01V96 Studio connects directly to the mixer's rear USB port (no external MIDI interface or legacy Yamaha Studio Manager required) and exposes a responsive, low-latency web interface with real-time bidirectional synchronization via WebSockets.

---

### ✨ Features

- **Direct USB-MIDI Communication**: Connects directly via USB using `libusb` (Yamaha USB VID `0x0499`, PID `0x5008`).
- **Simulated Fallback Mode**: Automatically falls back to simulated mixer mode when physical hardware is not detected, enabling testing and development anywhere.
- **Full Channel Strip & Modular Layout**:
  - 4-band Parametric EQ with interactive frequency curve and band drag controls.
  - Compressor & Noise Gate with real-time gain reduction meters.
  - Preamp attenuation, pan, phase, routing (Stereo, Direct, Bus 1–8).
  - Aux sends 1–8 (pre/post fader levels and on/off toggles).
  - Custom modular layout system (24-column grid, presets, split blocks, customizable heights).
- **Stereo Pair & Deep Pair**:
  - Real-time bidirectional fader and mute synchronization between paired channels.
  - Optional "Deep Pair" mode linking EQ, Dynamics, Preamp, Routing, Aux Sends, and Delay.
- **Scene-Aware Custom Labels**:
  - In-place editable names for channels (`Lead Vocal`, `Kick`, etc.), Aux sends (`To Tape`, `IEM 1`), Busses, and Scene titles.
  - Persistent storage in JSON format per scene number.
- **Direct Numeric Value Typing**:
  - Click on any knob or fader readout to directly type desired numerical or dB values (`+6.0 dB`, `-12 dB`, `-inf`) with automatic range validation.
- **Real-Time Metering & DSP Sync**:
  - High-frequency binary streaming meter protocol (`ArrayBuffer` over WebSocket).
  - SysEx parameter queue with throttling and fader coalescing to respect hardware buffer limits.
- **Scene Management & Live Safety**:
  - Scene Recall (0–99) and Store with safety confirmation dialogs.
  - Scene Compare mode to audit live changes against saved scene parameters.
  - Safety confirmation modal before running Demo Wave on real motorized faders.
- **Show Backup & Restore**:
  - Full or selective export of scenes, custom channel/aux/bus names, and modular layouts into portable JSON show packages.
  - Interactive restore wizard allowing selective scene restoration and slot remapping (e.g. restore scene #01 from file into slot #05 on the console).
- **Built-in USB Mixer Diagnostics & Discovery (`SETUP & CONF`)**:
  - Live USB scanner for connected Yamaha devices (`VID 0x0499`), OS/Docker detection, exact `libusb` error reporting, and contextual troubleshooting hints.
  - SysEx Handshake Ping & **Auto-Probe** across USB Ports `1..8` and MIDI Channels `1..16` with one-click diagnostic report copy.

---

### 🛠️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Web Browser UI                       │
│        (React 19 + TypeScript + Tailwind CSS)          │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket (/ws) + REST API
┌───────────────────────────▼────────────────────────────┐
│                    Node.js Server                      │
│             (Express + ws + Zod Validation)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │                MixerController                   │  │
│  │  - In-memory mixer state (32 In, 8 Bus, 8 Aux)  │  │
│  │  - Parameter change validation & clamping        │  │
│  │  - Scene Labels manager (persisted to disk)      │  │
│  └──────────────────────────▲───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │               YamahaUsbTransport                 │  │
│  │  - USB-MIDI 1.0 Packet Encoder / Decoder         │  │
│  │  - Priority Send Queue with rate throttling      │  │
│  │  - native libusb driver (VID 0x0499: PID 0x5008) │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────▲────────────────────────────┘
                            │ USB Type-B Cable
┌───────────────────────────▼────────────────────────────┐
│              Yamaha 01V96 / 01V96 VCM Console          │
└────────────────────────────────────────────────────────┘
```

---

### 🔌 Hardware Setup, Compatibility & OS Notes

The mixer connects to the host machine using a standard USB Type-A to Type-B cable.

#### Supported Mixers
| Model | USB VID:PID | Support |
| :--- | :--- | :--- |
| **Yamaha 01V96 (v1) / 01V96V2 / 01V96 VCM** | `0x0499:0x5008` | ✅ Fully supported |
| **Yamaha 01V96i** | `0x0499:0x1509` | ⚠️ Experimental (selectable via **SETUP & CONF → USB Diagnostics**) |
| **02R96 / DM1000 / DM2000** | Other PIDs | ❌ Not officially supported |

#### Required Settings on the Physical 01V96 Mixer
1. **`DIO/SETUP` → `MIDI/HOST`**: set **`GENERAL`** / **`STUDIO MANAGER`** to **`USB`** (Port `1`).
2. **`MIDI` → `SETUP`**: set **`TX CH = 1`**, **`RX CH = 1`**, and **`PARAMETER CHANGE TX/RX = ON`**.
3. If your console uses a different USB Port (`1–8`) or MIDI Channel (`1–16`), open **⚙️ SETUP & CONF → Mixer USB Diagnostics** and run **🧭 Auto-Probe** to detect and apply them automatically.

#### Linux udev Rules (Homelab / Server)

On Linux hosts, raw USB access requires non-root user permissions. Create a udev rule:

```bash
sudo tee /etc/udev/rules.d/99-yamaha-01v96.rules << 'EOF'
# Yamaha 01V96 / 01V96 VCM USB-MIDI
SUBSYSTEM=="usb", ATTR{idVendor}=="0499", ATTR{idProduct}=="5008", MODE="0666", GROUP="audio"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger
```

Make sure your server user belongs to the `audio` and `plugdev` groups:
```bash
sudo usermod -aG audio,plugdev $USER
```

#### macOS Troubleshooting (Important!)
- **Do NOT use Docker Desktop on macOS for live USB control**: Docker Desktop runs inside a Linux VM that does **not** support `/dev/bus/usb` passthrough — it will always stay in `simulated` (offline) mode. Run 01V96 Studio natively with `npm start` instead.
- **Yamaha USB-MIDI Driver / CoreMIDI conflict (`LIBUSB_ERROR_ACCESS`)**: Close Yamaha Studio Manager and any DAW (Logic, Cubase, etc.) before starting. If the official Yamaha USB-MIDI Driver is installed in `/Library/Audio/MIDI Drivers/`, macOS may automatically claim the mixer interface and prevent `libusb` direct access.
- **USB-C Hubs**: If no Yamaha device appears in **SETUP & CONF → 🔍 Scan USB**, try bypassing cheap multi-port USB-C hubs with a direct USB-B to USB-C cable/adapter.

---

### 🚀 Getting Started (Local Development)

#### Prerequisites
- Node.js 22 LTS or newer
- `libusb-1.0-0-dev`, `python3`, `make`, `g++` (required on Linux or when building native Node `usb` bindings from source)

##### Ubuntu / Debian
```bash
sudo apt-get install -y libusb-1.0-0-dev build-essential python3
```

##### macOS (via Homebrew)
If you don't have **Homebrew** installed yet, follow the official guide at [brew.sh](https://brew.sh) or run this command in Terminal:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
*(On Apple Silicon Macs, run the `eval "$(/opt/homebrew/bin/brew shellenv)"` command printed at the end of the installer.)*

Then install Node.js and `libusb`:
```bash
brew install node libusb
```

#### Installation & Run

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/gaskb/01v96-studio.git
cd 01v96-studio
npm install

# 2. Start full development environment (Vite UI on 5173 + Server on 8096)
npm run dev

# 3. Build for production
npm run build

# 4. Start production server
npm start
```

Open [http://localhost:8096](http://localhost:8096) in your browser.

---

### 🧪 Testing & Code Quality

The test suite runs with Vitest and validates SysEx protocol framing, USB queue rate-limiting, Zod schema validation, audio converters, and channel modular layout engines.

```bash
# Run all unit tests
npm test

# Run tests with code coverage report
npm run test:coverage

# TypeScript type check
npm run typecheck
```

---

### 🐳 Docker Deployment (Linux Only for USB)

> **⚠️ macOS & Windows Notice**: Docker Desktop on macOS and Windows runs inside a virtual machine and **does not support USB passthrough (`/dev/bus/usb`)**. To connect a physical Yamaha 01V96 on macOS or Windows, run the app natively using `npm start` (see [Getting Started](#getting-started-local-development)).

A multi-stage `Dockerfile` is provided, packaging the production build and native `libusb` runtime into a lean `node:22-bookworm-slim` image.

#### Using Docker Compose

```yaml
services:
  01v96-studio:
    image: gaskb/01v96-studio:latest
    container_name: 01v96-studio
    restart: unless-stopped
    ports:
      - "8096:8096"
    privileged: true
    devices:
      - /dev/bus/usb:/dev/bus/usb
    volumes:
      - ./data:/app/data
    environment:
      - PORT=8096
      - NODE_ENV=production
```

Run container:
```bash
docker compose up -d
```

Custom channel and scene labels will be automatically preserved in `./data/scene-labels.json`.

---

### 📡 API Reference

#### HTTP Endpoints
- `GET /api/health`: Returns service status, software versions (`appVersion`, `uiVersion`, `apiVersion`), and connection mode.
- `GET /api/status`: Returns mixer connection status, connection mode (`usb-direct` or `simulated`), current scene, and active layer.
- `GET /api/state`: Returns the full in-memory mixer state snapshot.
- `POST /api/command`: Dispatches a validated `ClientCommand` (Zod schema verified).
- `GET /api/scenes`: Returns list of available scenes with titles and archive metadata.
- `GET /api/backup`: Exports a portable `MixerBackupPackage` with selective scene filtering and global layouts (`?scenes=1,2&includeGlobal=true&download=true`).
- `POST /api/backup/restore`: Restores scenes with customizable target slot remapping and Zod schema validation.
- `GET /api/scene-labels`: Returns all custom labels indexed by scene number.
- `POST /api/scene-labels`: Updates custom labels for a given scene.
- `GET /api/diagnostics/usb`: Scans USB bus for Yamaha devices (`VID 0x0499`), reports OS/Docker environment, last `libusb` error, and contextual hints.
- `POST /api/diagnostics/reconnect`: Forces a clean USB disconnect/reconnect cycle (supports optional `pidOverride`).
- `POST /api/diagnostics/ping`: Runs a live SysEx handshake test (and optional `autoProbe` across USB Ports `1–8` and MIDI Channels `1–16`).

#### WebSocket API (`/ws`)
Full-duplex real-time communication:
- `full_state`: Broadcast on initial connection.
- `param_change`: Individual fader, pan, mute, EQ, dynamics changes.
- `meter_update` / Binary ArrayBuffer: High-speed peak meters and gain reduction.
- `labels_update`: Real-time updates to custom channel/bus/aux labels.
- `toast` / `error`: Non-blocking notification messages.

For a full changelog of releases, see [WHATSNEW.md](WHATSNEW.md).

If you find this project useful, feel free to support its development on [Ko-fi](https://ko-fi.com/gaskb) ☕

---

<br>

<a name="italiano"></a>
## Italiano

Interfaccia di controllo remoto web e channel strip per mixer digitali **Yamaha 01V96 / 01V96 VCM**.

01V96 Studio si connette direttamente alla porta USB posteriore del mixer (senza necessità di interfacce MIDI esterne o dell'obsoleto Yamaha Studio Manager) ed espone un'interfaccia web responsive, a bassissima latenza con sincronizzazione bidirezionale in tempo reale via WebSocket.

---

### ✨ Caratteristiche Principali

- **Comunicazione USB-MIDI Diretta**: Connessione nativa via USB con `libusb` (Yamaha USB VID `0x0499`, PID `0x5008`).
- **Modalità Simulazione / Fallback Automatico**: Passaggio trasparente al simulatore virtuale integrato quando il mixer fisico non è collegato, per test e sviluppo ovunque.
- **Channel Strip Completa & Layout Modulare**:
  - Equalizzatore parametrico a 4 bande con curva grafica interattiva e trascinamento delle bande.
  - Compressore e Noise Gate con indicatori di riduzione del guadagno (Gain Reduction) in tempo reale.
  - Attenuazione preamp, pan, fase, routing (Stereo, Direct, Bus 1–8).
  - Mandate Aux 1–8 (livelli pre/post fader e selettori on/off).
  - Sistema di layout modulare su griglia a 24 colonne con preset personalizzabili.
- **Accoppiamento Stereo & Modalità "Deep Pair"**:
  - Sincronizzazione fader e mute bidirezionale tra canali accoppiati in stereo.
  - Modalità opzionale "Deep Pair" per sincronizzare EQ, Dinamica, Preamp, Routing, Mandate Aux e Delay tra i due canali.
- **Etichette Personalizzate per Scena**:
  - Nomi modificabili al volo per canali (`Voce Lead`, `Cassa`, ecc.), mandate Aux (`Spia 1`, `Riverbero`), Bus e titoli di scena.
  - Salvataggio persistente in formato JSON per ciascuna memoria di scena.
- **Inserimento Numerico Diretto**:
  - Cliccando sui valori numerici o in dB di manopole e fader (`+6.0 dB`, `-12 dB`, `-inf`), è possibile digitare direttamente il valore desiderato con validazione e limiti di sicurezza immediati.
- **Telemetria Meter & Sincronizzazione DSP in Tempo Reale**:
  - Protocollo di streaming meter in formato binario (`ArrayBuffer` su WebSocket) ad alte prestazioni.
  - Coda messaggi SysEx con rate limiting e coalescing dei movimenti fader per rispettare i limiti di buffer del mixer.
- **Gestione Scene & Sicurezza dal Vivo**:
  - Richiamo e salvataggio memorie scena (0–99) con finestre di dialogo di conferma per evitare sovrascritture accidentali.
  - Modalità Scene Compare per confrontare i parametri attuali con quelli salvati nella memoria.
  - Finestra di conferma di sicurezza prima di avviare il movimento motorizzato della funzione Demo Wave sui fader reali.
- **Backup & Ripristino Show File**:
  - Esportazione selettiva o totale di scene del mixer, etichette personalizzate e layout in file JSON compatti e portabili.
  - Wizard interattivo di ripristino che consente la selezione scena per scena e la rimappatura libera degli slot di destinazione (es. ripristina la scena #01 del file nello slot #05 del mixer).
- **Diagnostica & Rilevamento Mixer USB Integrato (`SETUP & CONF`)**:
  - Scansione in tempo reale dei dispositivi Yamaha (`VID 0x0499`), rilevamento OS/Docker, errore esatto `libusb` e suggerimenti guidati.
  - Test Handshake SysEx (**Ping**) e **Auto-Probe** automatico su Porte USB `1..8` e Canali MIDI `1..16`, con copia del report diagnostico in un clic.

---

### 🛠️ Architettura del Sistema

```
┌────────────────────────────────────────────────────────┐
│                   Interfaccia Web                      │
│        (React 19 + TypeScript + Tailwind CSS)          │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket (/ws) + REST API
┌───────────────────────────▼────────────────────────────┐
│                    Server Node.js                      │
│             (Express + ws + Validazione Zod)           │
│  ┌──────────────────────────────────────────────────┐  │
│  │                MixerController                   │  │
│  │  - Stato in-memory (32 Ch In, 8 Bus, 8 Aux)      │  │
│  │  - Validazione e clamping parametri              │  │
│  │  - Gestione etichette scena (persistenza disco)  │  │
│  └──────────────────────────▲───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │               YamahaUsbTransport                 │  │
│  │  - Encoder / Decoder pacchetti USB-MIDI 1.0      │  │
│  │  - Coda prioritaria con rate throttling          │  │
│  │  - Driver nativo libusb (VID 0x0499: PID 0x5008) │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────▲────────────────────────────┘
                            │ Cavo USB Type-B
┌───────────────────────────▼────────────────────────────┐
│              Mixer Yamaha 01V96 / 01V96 VCM            │
└────────────────────────────────────────────────────────┘
```

---

### 🔌 Connessione Hardware, Compatibilità & Note per Sistema Operativo

Il mixer si collega al computer host tramite un comune cavo USB da tipo A a tipo B.

#### Mixer Compatibili
| Modello | USB VID:PID | Supporto |
| :--- | :--- | :--- |
| **Yamaha 01V96 (v1) / 01V96V2 / 01V96 VCM** | `0x0499:0x5008` | ✅ Pienamente supportato |
| **Yamaha 01V96i** | `0x0499:0x1509` | ⚠️ Sperimentale (selezionabile da **SETUP & CONF → Diagnostica USB**) |
| **02R96 / DM1000 / DM2000** | Altri PID | ❌ Non supportati ufficialmente |

#### Impostazioni Richieste sul Mixer Fisico 01V96
1. **`DIO/SETUP` → `MIDI/HOST`**: imposta **`GENERAL`** / **`STUDIO MANAGER`** su **`USB`** (Porta `1`).
2. **`MIDI` → `SETUP`**: imposta **`TX CH = 1`**, **`RX CH = 1`** e **`PARAMETER CHANGE TX/RX = ON`**.
3. Se il tuo mixer usa una Porta USB (`1–8`) o un Canale MIDI (`1–16`) diverso, apri **⚙️ SETUP & CONF → Diagnostica & Rilevamento Mixer USB** e clicca **🧭 Auto-Probe** per rilevarli e applicarli in un clic.

#### Regole udev per Linux (Server / Homelab)

Sui sistemi Linux l'accesso diretto ai dispositivi USB richiede i permessi per gli utenti non-root:

```bash
sudo tee /etc/udev/rules.d/99-yamaha-01v96.rules << 'EOF'
# Yamaha 01V96 / 01V96 VCM USB-MIDI
SUBSYSTEM=="usb", ATTR{idVendor}=="0499", ATTR{idProduct}=="5008", MODE="0666", GROUP="audio"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger
```

Assicurati che l'utente appartenga ai gruppi `audio` e `plugdev`:
```bash
sudo usermod -aG audio,plugdev $USER
```

#### Risoluzione Problemi su macOS (Importante!)
- **NON usare Docker Desktop su macOS per il controllo USB**: Docker Desktop gira dentro una VM Linux e **non supporta il passthrough USB (`/dev/bus/usb`)**, quindi resterà sempre in modalità offline/simulata. Su Mac avvia 01V96 Studio nativamente con `npm start`.
- **Conflitto Driver Yamaha USB-MIDI / CoreMIDI (`LIBUSB_ERROR_ACCESS`)**: chiudi Yamaha Studio Manager ed eventuali DAW (Logic, Cubase, ecc.) prima di avviare il server. Se il driver ufficiale Yamaha USB-MIDI è installato in `/Library/Audio/MIDI Drivers/`, macOS aggancia automaticamente il mixer bloccando l'accesso diretto via `libusb`.
- **Hub USB-C multiporta**: se nella scansione (**SETUP & CONF → 🔍 Scansiona USB**) non compare nessun dispositivo Yamaha, prova a collegare il mixer con un cavo/adattatore diretto USB-B → USB-C bypassando hub economici.

---

### 🚀 Installazione & Avvio Locale

#### Prerequisiti
- Node.js 22 LTS o superiore
- Pacchetti `libusb-1.0-0-dev`, `python3`, `make`, `g++` (necessari su Linux o per compilare il binding nativo `usb` da sorgente)

##### Ubuntu / Debian
```bash
sudo apt-get install -y libusb-1.0-0-dev build-essential python3
```

##### macOS (tramite Homebrew)
Se non hai ancora installato **Homebrew**, segui la guida ufficiale su [brew.sh](https://brew.sh) oppure incolla questo comando nel **Terminale**:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
*(Su Mac Apple Silicon M1/M2/M3/M4, esegui il comando `eval "$(/opt/homebrew/bin/brew shellenv)"` mostrato al termine dell'installazione.)*

Poi installa Node.js e `libusb`:
```bash
brew install node libusb
```

#### Installazione e Avvio

```bash
# 1. Clona il repository e installa i pacchetti
git clone https://github.com/gaskb/01v96-studio.git
cd 01v96-studio
npm install

# 2. Avvia l'ambiente di sviluppo (Vite UI su :5173 + Server su :8096)
npm run dev

# 3. Compila per produzione
npm run build

# 4. Avvia il server di produzione
npm start
```

Apri [http://localhost:8096](http://localhost:8096) nel browser.

---

### 🧪 Test Automatici & Qualità del Codice

La suite di test automatici eseguita con Vitest valida la composizione dei pacchetti SysEx, il rate limiting della coda USB, gli schemi Zod, i convertitori audio e il motore di layout:

```bash
# Esegui tutti i test
npm test

# Esegui i test con report di copertura (coverage)
npm run test:coverage

# Verifica tipi TypeScript
npm run typecheck
```

---

### 🐳 Deploy con Docker (Solo Linux per accesso USB)

> **⚠️ Avviso per macOS e Windows**: Docker Desktop su macOS e Windows gira in una macchina virtuale e **non supporta il passthrough USB (`/dev/bus/usb`)**. Per controllare fisicamente lo Yamaha 01V96 da Mac o Windows, esegui l'app nativamente con `npm start` (vedi [Installazione & Avvio Locale](#installazione--avvio-locale)).

Il progetto include un `Dockerfile` multi-stage che compila l'applicazione e impacchetta il runtime con `libusb` in un'immagine leggera basata su `node:22-bookworm-slim`.

#### Utilizzo con Docker Compose

```yaml
services:
  01v96-studio:
    image: gaskb/01v96-studio:latest
    container_name: 01v96-studio
    restart: unless-stopped
    ports:
      - "8096:8096"
    privileged: true
    devices:
      - /dev/bus/usb:/dev/bus/usb
    volumes:
      - ./data:/app/data
    environment:
      - PORT=8096
      - NODE_ENV=production
```

Avvio del container:
```bash
docker compose up -d
```

I dati persistenti delle etichette e della configurazione saranno salvati nella directory `./data`.

---

### 📡 Riferimento API

#### Endpoint HTTP REST
- `GET /api/health`: Restituisce lo stato del servizio, le versioni software (`appVersion`, `uiVersion`, `apiVersion`) e la modalità di connessione.
- `GET /api/status`: Restituisce lo stato di connessione al mixer, modalità (`usb-direct` o `simulated`), scena corrente e layer attivo.
- `GET /api/state`: Restituisce l'intero stato in memoria del mixer.
- `POST /api/command`: Invia un comando validato con schema Zod.
- `GET /api/scenes`: Restituisce l'elenco delle scene disponibili con titoli e metadati di archivio.
- `GET /api/backup`: Esporta un pacchetto portabile `MixerBackupPackage` con filtro selettivo scene e layout globali (`?scenes=1,2&includeGlobal=true&download=true`).
- `POST /api/backup/restore`: Ripristina le scene con rimappatura degli slot di destinazione e validazione dello schema Zod.
- `GET /api/scene-labels`: Restituisce tutte le etichette personalizzate indicizzate per scena.
- `POST /api/scene-labels`: Aggiorna le etichette di una scena.
- `GET /api/diagnostics/usb`: Scansiona il bus USB cercando dispositivi Yamaha (`VID 0x0499`), mostra ambiente OS/Docker, ultimo errore `libusb` e suggerimenti mirati.
- `POST /api/diagnostics/reconnect`: Forza un ciclo di disconnessione/riconnessione USB (supporta `pidOverride` opzionale).
- `POST /api/diagnostics/ping`: Esegue un test di handshake SysEx live (con `autoProbe` opzionale su Porte USB `1–8` e Canali MIDI `1–16`).

#### WebSocket (`/ws`)
Canale bidirezionale in tempo reale:
- `full_state`: Inviato alla connessione iniziale del client.
- `param_change`: Variazioni individuali di fader, pan, mute, EQ e dinamica.
- `meter_update` / ArrayBuffer binario: Streaming ad alta frequenza per peak meter e gain reduction.
- `labels_update`: Aggiornamenti istantanei delle etichette personalizzate.
- `toast` / `error`: Notifiche di errore o di stato non bloccanti.

Per lo storico completo delle novità introdotte in ciascuna release, consulta [WHATSNEW.md](WHATSNEW.md).

Se trovi utile questo progetto, sentiti libero di offrirmi un caffè su [Ko-fi](https://ko-fi.com/gaskb) ☕
