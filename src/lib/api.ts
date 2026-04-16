/**
 * SAGE AI + AgriVision — unified API client.
 * Base URL from VITE_API_URL env var (default: http://localhost:8000).
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Core fetch helper ──────────────────────────────────────────────────────
async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── SAGE AI types ──────────────────────────────────────────────────────────
export interface MissionPhaseResponse  { id: number; name: string; duration: number }
export interface ConfidenceFactorResponse { label: string; value: number }
export interface GenerateMissionResponse {
  missionSummary: string;
  missionPhases: MissionPhaseResponse[];
  confidenceScore: number;
  confidenceFactors: ConfidenceFactorResponse[];
  estimatedDuration: number;
  warnings: string[];
}
export interface ActionResponse { success: boolean; message: string }

// ── SAGE AI calls ──────────────────────────────────────────────────────────
export function generateMission(missionInput: string): Promise<GenerateMissionResponse> {
  return fetchApi("/api/generate-mission", {
    method: "POST",
    body: JSON.stringify({ missionInput }),
  });
}
export const executeMission = (): Promise<ActionResponse> =>
  fetchApi("/api/execute", { method: "POST" });
export const abortMission = (): Promise<ActionResponse> =>
  fetchApi("/api/abort", { method: "POST" });
export const returnHome = (): Promise<ActionResponse> =>
  fetchApi("/api/return-home", { method: "POST" });

// ── Simulation mode types + calls ─────────────────────────────────────────
export interface SimMode { mission_sim: boolean; weed_demo: boolean }

export const getSimMode = (): Promise<SimMode> =>
  fetchApi("/api/sim-mode");
export const setMissionSim = (enabled: boolean): Promise<SimMode> =>
  fetchApi(`/api/sim-mode/mission?enabled=${enabled}`, { method: "POST" });
export const setWeedDemo = (enabled: boolean): Promise<SimMode> =>
  fetchApi(`/api/sim-mode/weed?enabled=${enabled}`, { method: "POST" });

// ── AgriVision types ───────────────────────────────────────────────────────
export interface Detection {
  id: string;
  class: string;
  conf: number;
  bbox: [number, number, number, number];
  lat: number;
  lon: number;
  polygon: number[][];
  spray: boolean;
  frame?: number;
}
export interface ImageDetectResult {
  job_id: string;
  detections: Detection[];
  weed_count: number;
  crop_count: number;
  annotated_url: string;
}
export interface VideoJob {
  job_id: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  result?: { weed_count: number; crop_count: number; total_frames: number; annotated_url: string };
  error?: string;
}
export interface SavingsReport {
  hectares_scanned: number;
  total_detections: number;
  weed_count: number;
  crop_count: number;
  weed_density_percent: number;
  blanket_spray_liters: number;
  precision_spray_liters: number;
  chemical_saved_liters: number;
  cost_saved_inr: number;
  savings_percent: number;
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
export interface WeedMapGeoJSON {
  type: "FeatureCollection";
  total_zones: number;
  features: {
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: {
      id: string; weed_type: string; confidence: number;
      spray: boolean; lat: number; lon: number;
    };
  }[];
}

// ── AgriVision calls ───────────────────────────────────────────────────────
export async function detectImage(file: File): Promise<ImageDetectResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/detect/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
  return res.json();
}

export async function detectVideo(file: File): Promise<{ job_id: string; status: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/detect/video`, { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
  return res.json();
}

export const pollJob     = (id: string): Promise<VideoJob> => fetchApi(`/api/detect/status/${id}`);
export const getWeedMap  = (): Promise<WeedMapGeoJSON>     => fetchApi("/api/weed-map");
export const clearWeedMap = (): Promise<{ cleared: boolean }> =>
  fetchApi("/api/weed-map/clear", { method: "POST" });
export const getSavings  = (): Promise<SavingsReport>      => fetchApi("/api/savings");
export const getFieldInfo = (): Promise<FieldInfo>          => fetchApi("/api/field-info");
