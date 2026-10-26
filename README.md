# 🎚️ 01V96 Studio

Modern Web Remote Controller & Channel Strip Interface for **Yamaha 01V96 / 01V96 VCM** digital mixing consoles.

01V96 Studio connects directly to the mixer's rear USB port (no external MIDI interface or legacy Yamaha Studio Manager required) and exposes a responsive, low-latency web interface with real-time bidirectional synchronization via WebSockets.

---

## ✨ Features

- **Direct USB-MIDI Communication**: Connects directly via USB using `libusb` (Yamaha USB VID `0x0499`, PID `0x5008`).
- **Simulated Fallback Mode**: Automatically falls back to simulated mixer mode when physical hardware is not detected, enabling testing and development anywhere.
- **Full Channel Strip & Modular Layout**:
  - 4-band Parametric EQ with interactive frequency curve and band drag controls
  - Compressor & Noise Gate with real-time gain reduction meters
  - Preamp attenuation, pan, phase, routing (Stereo, Direct, Bus 1–8)
  - Aux sends 1–8 (pre/post fader levels and on/off toggles)
  - Custom modular layout system (24-column grid, presets, split blocks, customizable heights)
- **Scene-Aware Custom Labels**:
  - In-place editable names for channels (`Mic Lead`, `Kick`, etc.), Aux sends (`To Tape`, `In-Ear 1`), Busses, and Scene titles.
  - Persistent storage in JSON format per scene number.
- **Real-Time Metering & DSP Sync**:
  - High-frequency metering requests for peak meters and gain reduction.
  - SysEx parameter queue with throttling to respect mixer buffer limits.
- **Scene Management**:
  - Scene Recall (0–99) and Store.
  - Scene Compare mode to audit live changes against saved scene parameters.

---

## 🛠️ Architecture

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

## 🔌 Hardware Setup & Linux Permissions

The mixer connects to the host machine using a standard USB A-to-B cable.

### Mixer USB Identification
- **Vendor ID (VID)**: `0x0499` (Yamaha Corporation)
- **Product ID (PID)**: `0x5008` (01V96 Digital Audio Mixer)

### Linux udev Rules (Homelab / Server)

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

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 22 LTS or newer
- `libusb-1.0-0-dev`, `python3`, `make`, `g++` (required to compile native Node `usb` bindings)

#### Ubuntu / Debian
```bash
sudo apt-get install -y libusb-1.0-0-dev build-essential python3
```

#### macOS
```bash
brew install libusb
```

### Installation & Run

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

## 🧪 Testing & Code Quality

The test suite runs with Vitest and validates SysEx protocol framing, USB queue rate-limiting, Zod schema validation, audio converters, and channel modular layout engines.

```bash
# Run all unit tests
npm test

# Run tests with code coverage report
npm run test:coverage
```

---

## 🐳 Docker Deployment

A multi-stage `Dockerfile` is provided, packaging the production build and native `libusb` runtime into a lean `node:22-bookworm-slim` image.

### Using Docker Compose

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

## 📡 API Reference

### HTTP Endpoints
- `GET /api/status`: Returns mixer connection status, connection mode (`usb-direct` or `simulated`), current scene, and active layer.
- `GET /api/scene-labels`: Returns all custom labels indexed by scene number.
- `POST /api/scene-labels`: Updates custom labels for a given scene. Payload:
  ```json
  {
    "scene": 1,
    "labels": {
      "channelLabels": { "1": "Lead Vocal", "2": "Backing Vocal" },
      "auxLabels": { "1": "IEM 1", "2": "Reverb Send" },
      "busLabels": { "1": "Drums Sub" },
      "sceneTitle": "Live Setup Act 1"
    }
  }
  ```

### WebSocket API (`/ws`)
Full duplex communication transmitting:
- `full_state`: Broadcast on initial connection.
- `param_change`: Individual fader, pan, mute, EQ, dynamic changes.
- `meter_update`: Peak meter levels and compressor gain reduction.
- `labels_update`: Real-time updates to custom channel/bus/aux labels.
