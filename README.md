# AgriVision

Drone-based precision agriculture system: AI mission planning + weed detection + GPS spray mapping.

## Project Structure

```
agrivision/
├── backend/
│   ├── main.py              # Unified FastAPI server
│   ├── agrivision.py        # YOLOv8 detector + GPS projection + weed store
│   ├── sage_ai.py           # Gemini mission generation
│   ├── drone_control.py     # RPi SSH deploy + abort + RTH
│   ├── mission_store.py     # Shared mission + telemetry state
│   ├── models.py            # Pydantic schemas
│   ├── requirements.txt
│   ├── .env                 # Your keys (copy from .env.example)
│   └── .env.example
├── src/
│   ├── components/
│   │   ├── AgriVisionTab.tsx  # Upload → detect → GPS map → savings
│   │   ├── CameraFeed.tsx
│   │   ├── LiveMap.tsx
│   │   └── …
│   ├── lib/api.ts
│   └── pages/Index.tsx
└── AgriVision-App/          # React Native (Expo) Android app
    ├── app/(tabs)/
    ├── constants/api.ts
    └── hooks/useStatus.ts
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: add GOOGLE_API_KEY and Pi credentials
# Optionally copy your trained weights:
# cp /path/to/agrivision_best.pt .

python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Web Frontend

```bash
npm install
npm run dev
# Opens on http://localhost:8080
```

### 3. Android App

```bash
cd AgriVision-App
npm install
# Edit constants/api.ts → set BACKEND_URL to your laptop IP
npx expo start
# Scan QR with Expo Go on your phone
```

## Inference Modes

Set `INFERENCE_MODE` in backend `.env`:

| Mode     | Description                    | Status   |
|----------|--------------------------------|----------|
| `laptop` | YOLOv8s runs locally (default) | ✅ Ready |
| `cloud`  | POST to cloud endpoint         | 🔜 Future |
| `edge`   | Lightweight model on RPi       | 🔜 Future |

## API Endpoints

### Mission Control
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/generate-mission` | Generate flight script + plan via Gemini |
| POST | `/api/execute` | Deploy to RPi and run |
| POST | `/api/abort` | Emergency stop |
| POST | `/api/return-home` | RTH signal |
| POST | `/api/phase-update` | Pi reports phase completion |

### AgriVision Detection
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/detect/image` | Run YOLOv8 on image → instant result |
| POST | `/api/detect/video` | Submit video for background processing |
| GET  | `/api/detect/status/{id}` | Poll video job |
| GET  | `/api/weed-map` | GeoJSON spray zones |
| POST | `/api/weed-map/clear` | Reset zones |
| GET  | `/api/savings` | Chemical/cost savings report |
| GET  | `/api/field-info` | Field metadata + bounds + scan time |
| GET  | `/api/status` | Unified telemetry + weed summary |

## Android App

The Android app polls `/api/status` every 2s:

```json
{
  "drone": { "battery": 87, "altitude": 18.5, "gpsLock": true, "executing": true },
  "weeds": { "weed_count": 45, "cost_saved_inr": 9920, "savings_percent": 78 },
  "field": { "field_hectares": 2.4, "weed_zone_count": 12 }
}
```

## RPi Integration

The backend SSH-deploys Python flight scripts to the Pi. The Pi must have:
- DroneKit installed in a venv at `PI_VENV_PATH`
- Script landing at `PI_SCRIPT_PATH`
- Port 22 accessible from laptop

The Pi calls back `/api/phase-update` at each mission phase to send telemetry.

## Demo Mode

If `agrivision_best.pt` is not found, the detector falls back to demo mode with 5 hardcoded detections (3 weeds + 2 crops). The full pipeline — map, savings calculator, GPS zones — still works.
