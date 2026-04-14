# AgriVision Android App

React Native (Expo) app for the AgriVision system.
Works on any Android phone via Expo Go — no build or Play Store needed.

---

## Project Structure

```
AgriVision-App/
├── app/
│   ├── _layout.tsx          # Root layout (GestureHandler + StatusBar)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar (Dashboard / Weed Map / SAGE AI / Control)
│       ├── index.tsx        # Dashboard screen
│       ├── map.tsx          # Weed Map screen
│       ├── chat.tsx         # SAGE AI Chat screen
│       └── control.tsx      # Drone Control screen
├── constants/
│   └── api.ts               # Backend URL + all API calls + TypeScript types
├── hooks/
│   └── useStatus.ts         # Polling hook — /api/status every 2s
├── assets/                  # Icons / splash (add your own)
├── app.json                 # Expo config
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## Setup (5 minutes)

### 1. Install dependencies
```bash
cd AgriVision-App
npm install
```

### 2. Set your laptop's IP address
Edit `constants/api.ts` line 7:
```ts
export const BACKEND_URL = "http://YOUR_LAPTOP_IP:8000";
```
Find your IP:
- Windows → `ipconfig` (look for IPv4 Address)
- Mac/Linux → `ifconfig`

Both laptop and phone must be on the **same WiFi network**.

### 3. Start the backend (on your laptop)
```bash
cd backend
venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Install Expo Go on your phone
Download **Expo Go** from the Play Store (free).

### 5. Start the app
```bash
cd AgriVision-App
npx expo start
```
Scan the QR code with Expo Go. App opens instantly.

---

## App Screens

### Dashboard
- Live telemetry: battery, altitude, GPS lock, mission status
- Hero savings card: ₹ saved, % reduction, litres eliminated
- Spray comparison (blanket vs precision)
- Pull-to-refresh
- Demo mode when backend is offline

### Weed Map
- All GPS weed zones with coordinates and confidence scores
- Simulated field view with zone dots
- Savings summary card
- Polls `/api/weed-map` and `/api/savings`

### SAGE AI Chat
- Chatbot powered by Gemini
- Intent routing: flight mission / weed query / abort / RTH / status
- Quick suggestion chips
- Approve & Execute button fires mission directly from chat
- Demo fallbacks when backend offline

### Control
- Live telemetry strip
- Edge vs Cloud mode toggle
- D-Pad for manual drone movement
- Emergency controls: ABORT (with confirmation) + Return to Home
- Command log + spray test trigger

---

## Demo Mode

All screens work without a backend — they show realistic simulated data.
The connection badge shows **Demo** vs **Live** clearly.

---

## Architecture

```
Phone (Expo Go)
    ↓ HTTP polling every 2s
FastAPI Backend (laptop :8000)
    ├── /api/status           ← dashboard polling
    ├── /api/weed-map         ← weed zone list
    ├── /api/savings          ← savings report
    ├── /api/generate-mission ← SAGE AI chatbot
    ├── /api/execute          ← mission execution
    ├── /api/abort            ← emergency stop
    └── /api/return-home      ← RTH command
         ↓ SSH
       RPi 5
         ↓ MAVLink/DroneKit
       Drone (Pixhawk)
```
