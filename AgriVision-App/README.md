# AgriVision Android App

Expo Router app for the AgriVision mobile client.

## What changed for install safety

- Removed the hard-coded backend IP from the app.
- Disabled cleartext HTTP for installed Android builds by default.
- Added request timeouts so the app fails fast instead of hanging.
- Fixed chat safety so `Abort`, `Return to Home`, and mission execution need explicit confirmation.
- Kept demo mode as the fallback when no safe backend is configured.

## Project structure

```text
AgriVision-App/
├── app/
│   ├── _layout.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── map.tsx
│       ├── chat.tsx
│       └── control.tsx
├── assets/
├── constants/
│   └── api.ts
├── hooks/
│   └── useStatus.ts
├── .env.example
├── app.json
├── eas.json
└── package.json
```

## Safe setup

### 1) Install dependencies cleanly

From `AgriVision-App`:

```bash
npm install
```

If `node_modules` already exists from an older install, delete it first and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows PowerShell, use:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### 2) Configure the backend URL

Copy `.env.example` to `.env` inside `AgriVision-App`.

```env
EXPO_PUBLIC_BACKEND_URL=
EXPO_PUBLIC_ALLOW_HTTP=false
```

Use one of these modes:

- `https://your-server.example.com` for installed APK builds.
- `http://YOUR_LAPTOP_IP:8000` only for trusted local testing.

Important:

- Installed Android builds now block plain `http://` by default.
- If you really need local HTTP while testing, set `EXPO_PUBLIC_ALLOW_HTTP=true` before building.
- Leaving `EXPO_PUBLIC_BACKEND_URL` empty keeps the app in demo mode.

### 3) Start the backend

From the repo root:

```bash
cd backend
venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Run options

### Expo Go

Best for quick testing on the same Wi-Fi:

```bash
cd AgriVision-App
npx expo start
```

### Installable APK

Build an APK with EAS:

```bash
cd AgriVision-App
npx eas build -p android --profile preview
```

The `preview` profile is configured to generate an APK directly.

## Security notes

- Do not put a public IP directly in source files.
- Prefer HTTPS for any build you will install on your phone.
- Do not expose the backend to the public internet without authentication.
- Chat commands now require confirmation before sending flight-critical actions.

## Recommended readiness checklist

- `npm install` completes without dependency errors.
- `.env` is set correctly.
- Backend runs on port `8000`.
- `npx expo start` opens successfully.
- `npx eas build -p android --profile preview` completes successfully.
- Installed APK shows `Live` only when a safe backend is configured; otherwise it stays in `Demo`.
