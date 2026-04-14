/**
 * api.ts — Unified SAGE AI + AgriVision API client
 * Covers laptop → cloud → edge inference pathway.
 */
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function api<T>(path: string, opts: RequestInit = {}, timeoutMs = 100_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...opts.headers },
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((e as { detail?: string }).detail || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError")
      throw new Error("Request timed out — Gemini is taking too long, please retry");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── SAGE AI ────────────────────────────────────────────────────────────────
export interface MissionPhaseResponse   { id: number; name: string; duration: number }
export interface ConfidenceFactorResponse { label: string; value: number }
export interface GenerateMissionResponse {
  missionSummary: string; missionPhases: MissionPhaseResponse[];
  confidenceScore: number; confidenceFactors: ConfidenceFactorResponse[];
  estimatedDuration: number; warnings: string[];
}
export interface ActionResponse { success: boolean; message: string }

export const generateMission = (missionInput: string) =>
  api<GenerateMissionResponse>("/api/generate-mission", { method:"POST", body: JSON.stringify({missionInput}) });
export const executeMission  = () => api<ActionResponse>("/api/execute",     { method:"POST" });
export const abortMission    = () => api<ActionResponse>("/api/abort",       { method:"POST" });
export const returnHome      = () => api<ActionResponse>("/api/return-home", { method:"POST" });

// ── AgriVision types ───────────────────────────────────────────────────────
export interface Detection {
  id: string; class: string; conf: number;
  bbox: [number,number,number,number];
  lat: number; lon: number;
  polygon: number[][]; spray: boolean; frame?: number;
}
export interface ImageResult {
  job_id: string; detections: Detection[];
  weed_count: number; crop_count: number; annotated_url: string;
}
export interface VideoJob {
  job_id: string; status: "processing"|"completed"|"failed"; progress: number;
  result?: { weed_count:number; crop_count:number; total_frames:number; annotated_url:string };
  error?: string;
}
export interface SavingsReport {
  hectares_scanned: number; total_detections: number;
  weed_count: number; crop_count: number; weed_density_percent: number;
  blanket_spray_liters: number; precision_spray_liters: number;
  chemical_saved_liters: number; cost_saved_inr: number; savings_percent: number;
}
export interface FieldInfo {
  field_center_lat: number; field_center_lon: number; field_hectares: number;
  scan_duration_sec: number; weed_zone_count: number;
  bounds: { north:number; south:number; east:number; west:number } | null;
  inference_mode: string;
}
export interface GeoJSON {
  type: "FeatureCollection"; total_zones: number;
  features: { type:"Feature"; geometry:{type:"Polygon";coordinates:number[][][]};
    properties:{id:string;weed_type:string;confidence:number;spray:boolean;lat:number;lon:number} }[];
}
export interface SystemStatus {
  drone: { battery:number|null; altitude:number|null; latitude:number|null;
           longitude:number|null; gpsLock:boolean|null; executing:boolean };
  weeds: SavingsReport; field: FieldInfo;
}

// ── AgriVision calls ───────────────────────────────────────────────────────
export async function detectImage(file: File): Promise<ImageResult> {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch(`${BASE}/api/detect/image`, { method:"POST", body:fd });
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).detail || `HTTP ${r.status}`);
  return r.json();
}
export async function detectVideo(file: File): Promise<{job_id:string;status:string}> {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch(`${BASE}/api/detect/video`, { method:"POST", body:fd });
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).detail || `HTTP ${r.status}`);
  return r.json();
}
export const pollJob       = (id: string) => api<VideoJob>(`/api/detect/status/${id}`);
export const getWeedMap    = ()           => api<GeoJSON>("/api/weed-map");
export const clearWeedMap  = ()           => api<{cleared:boolean}>("/api/weed-map/clear", {method:"POST"});
export const getSavings    = ()           => api<SavingsReport>("/api/savings");
export const getFieldInfo  = ()           => api<FieldInfo>("/api/field-info");
export const getStatus     = ()           => api<SystemStatus>("/api/status");
