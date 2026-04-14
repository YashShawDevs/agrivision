// constants/api.ts
// ─────────────────────────────────────────────────────────────
// Change BACKEND_URL to your laptop's IP when on the same WiFi.
// Example: "http://192.168.1.100:8000"
// ─────────────────────────────────────────────────────────────

export const BACKEND_URL = "http://152.59.13.20:8000"; // IPv4 — laptop on same WiFi

// ── Types matching backend contracts ──────────────────────────

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

// ── API calls ──────────────────────────────────────────────────

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((e as any).detail || `HTTP ${res.status}`);
  }
  return res.json();
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
