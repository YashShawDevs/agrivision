// constants/api.ts
// Expo injects EXPO_PUBLIC_* variables at build time.
// - EXPO_PUBLIC_BACKEND_URL=https://your-backend.example.com
// - EXPO_PUBLIC_ALLOW_HTTP=true (only for trusted local testing)

// FIX: Increased from 8000ms to 95000ms for mission generation calls.
// The backend allows up to 90s for Gemini; 8s always timed out on mobile.
// Non-mission calls (status, weed-map, savings) are fast enough that this is safe.
const REQUEST_TIMEOUT_MS = 95_000;

const RAW_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() ?? "";
const ALLOW_HTTP_IN_BUILD = process.env.EXPO_PUBLIC_ALLOW_HTTP === "true";

function normalizeBackendUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;

  try {
    const parsedUrl = new URL(rawUrl);
    const isHttp = parsedUrl.protocol === "http:";
    const isHttps = parsedUrl.protocol === "https:";

    if (!isHttp && !isHttps) return null;
    if (isHttp && !(__DEV__ || ALLOW_HTTP_IN_BUILD)) return null;

    return parsedUrl.origin;
  } catch {
    return null;
  }
}

export const BACKEND_URL = normalizeBackendUrl(RAW_BACKEND_URL);
export const LIVE_BACKEND_CONFIG_ERROR =
  RAW_BACKEND_URL && !BACKEND_URL
    ? "Installed builds only allow https:// backends by default. Use EXPO_PUBLIC_ALLOW_HTTP=true only for trusted local testing."
    : null;

export interface Telemetry {
  battery: number | null;
  altitude: number | null;
  latitude: number | null;
  longitude: number | null;
  gpsLock: boolean | null;
  executing: boolean;
}

export interface WeedSummary {
  weed_count: number;
  crop_count: number;
  weed_density_percent: number;
  blanket_spray_liters: number;
  precision_spray_liters: number;
  chemical_saved_liters: number;
  cost_saved_inr: number;
  savings_percent: number;
  hectares_scanned: number;
  total_detections: number;
}

export interface FieldInfo {
  field_center_lat: number;
  field_center_lon: number;
  field_hectares: number;
  scan_duration_sec: number;
  weed_zone_count: number;
  bounds: { north: number; south: number; east: number; west: number } | null;
  inference_mode: string;
}

export interface SystemStatus {
  drone: Telemetry;
  weeds: WeedSummary;
  field: FieldInfo;
}

export interface MissionPhase {
  id: number;
  name: string;
  duration: number;
}

export interface GenerateMissionResponse {
  missionSummary: string;
  missionPhases: MissionPhase[];
  confidenceScore: number;
  confidenceFactors: { label: string; value: number }[];
  estimatedDuration: number;
  warnings: string[];
}

export interface WeedZone {
  id: string;
  lat: number;
  lon: number;
  confidence: number;
  weed_type: string;
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error(LIVE_BACKEND_CONFIG_ERROR ?? "Live backend is not configured.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...opts.headers,
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((errorBody as { detail?: string }).detail || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getStatus = () => api<SystemStatus>("/api/status");

export const generateMission = (missionInput: string) =>
  api<GenerateMissionResponse>("/api/generate-mission", {
    method: "POST",
    body: JSON.stringify({ missionInput }),
  });

export const executeMission = () =>
  api<{ success: boolean; message: string }>("/api/execute", { method: "POST" });

export const abortMission = () =>
  api<{ success: boolean; message: string }>("/api/abort", { method: "POST" });

export const returnHome = () =>
  api<{ success: boolean; message: string }>("/api/return-home", { method: "POST" });

export const getWeedMap = () =>
  api<{ type: string; features: any[]; total_zones: number }>("/api/weed-map");

export const getSavings = () => api<WeedSummary>("/api/savings");

export const getFieldInfo = () => api<FieldInfo>("/api/field-info");
