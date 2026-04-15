/**
 * SAGE AI Backend API client.
 * Base URL from VITE_API_URL (default: http://localhost:8000).
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface MissionPhaseResponse {
  id: number;
  name: string;
  duration: number;
}

export interface ConfidenceFactorResponse {
  label: string;
  value: number;
}

export interface GenerateMissionResponse {
  missionSummary: string;
  missionPhases: MissionPhaseResponse[];
  confidenceScore: number;
  confidenceFactors: ConfidenceFactorResponse[];
  estimatedDuration: number;
  warnings: string[];
}

export interface ActionResponse {
  success: boolean;
  message: string;
}

// ── Weed zone types (from AgriVision module) ──────────────────────────────────
export interface WeedZone {
  id: string;
  lat: number;
  lon: number;
  confidence: number;
  weed_type: string;
  spray: boolean;
}

export interface WeedMapResponse {
  type: string;
  total_zones: number;
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[][][] };
    properties: {
      id: string;
      weed_type: string;
      confidence: number;
      spray: boolean;
      lat: number;
      lon: number;
    };
  }>;
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function generateMission(
  missionInput: string
): Promise<GenerateMissionResponse> {
  return fetchApi<GenerateMissionResponse>("/api/generate-mission", {
    method: "POST",
    body: JSON.stringify({ missionInput }),
  });
}

export async function executeMission(): Promise<ActionResponse> {
  return fetchApi<ActionResponse>("/api/execute", { method: "POST" });
}

export async function abortMission(): Promise<ActionResponse> {
  return fetchApi<ActionResponse>("/api/abort", { method: "POST" });
}

export async function returnHome(): Promise<ActionResponse> {
  return fetchApi<ActionResponse>("/api/return-home", { method: "POST" });
}

/**
 * Fetch weed spray zones from the AgriVision/detection module.
 * Falls back gracefully if endpoint not yet available.
 */
export async function getWeedMap(): Promise<WeedMapResponse | null> {
  try {
    return await fetchApi<WeedMapResponse>("/api/weed-map");
  } catch {
    return null;
  }
}

/**
 * Extract ordered [lat, lon] waypoints from weed map response.
 * Returns null if no data — caller must handle fallback.
 */
export function weedZonesToWaypoints(
  map: WeedMapResponse
): [number, number][] | null {
  const sprayZones = map.features.filter((f) => f.properties.spray);
  if (sprayZones.length === 0) return null;
  return sprayZones.map((f) => [f.properties.lat, f.properties.lon]);
}
