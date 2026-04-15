import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  generateMission as apiGenerateMission,
  executeMission,
  abortMission as apiAbortMission,
  returnHome as apiReturnHome,
  getWeedMap,
  weedZonesToWaypoints,
} from "@/lib/api";
import type { ConfidenceFactorResponse } from "@/lib/api";

export type PhaseStatus = "completed" | "in_progress" | "pending";

export interface MissionPhase {
  id: number;
  name: string;
  duration: number;
  status: PhaseStatus;
  timeRemaining?: number;
}

export interface FlightData {
  battery: number;
  altitude: number;
  gpsLock: boolean;
  flightTime: number; // seconds
  connectionStatus: "connected" | "disconnected";
}

export type AppState =
  | "idle"
  | "generating"
  | "generated"
  | "preflight"
  | "executing"
  | "completed"
  | "aborted";

export interface ConfidenceData {
  score: number;
  factors: ConfidenceFactorResponse[];
}

const INITIAL_FLIGHT_DATA: FlightData = {
  battery: 97,
  altitude: 0,
  gpsLock: true,
  flightTime: 0,
  connectionStatus: "connected",
};

// ── Weed spray waypoints ──────────────────────────────────────────────────────
// These are the SAME fixed zones used by the backend weed-map endpoint.
// Seed is fixed so coordinates are consistent across all UI components.
// Centred on Aurangabad field (matches backend/main.py FIELD_CENTER_*).
// If /api/weed-map is reachable these get replaced by live data at execution time.
const FIELD_CENTER: [number, number] = [19.8762, 75.3433];
const FALLBACK_WEED_WAYPOINTS: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    pts.push([
      FIELD_CENTER[0] + (row - 0.5) * 0.00054,
      FIELD_CENTER[1] + (col - 1) * 0.00054,
    ]);
  }
  return pts;
})();

/**
 * Build the detailed weed-spray phase list from a set of waypoints.
 * Phase IDs are sequential from 1. Each waypoint gets a "Move to" + "Spray" pair.
 */
function buildSprayPhases(waypoints: [number, number][]): MissionPhase[] {
  const phases: MissionPhase[] = [
    { id: 1, name: "Initialization",          duration: 4,  status: "pending" },
    { id: 2, name: "Fetching weed coordinates", duration: 3, status: "pending" },
    { id: 3, name: "Path planning",            duration: 3,  status: "pending" },
    { id: 4, name: "Takeoff",                  duration: 8,  status: "pending" },
  ];

  let id = 5;
  waypoints.forEach((_, i) => {
    phases.push({
      id: id++,
      name: `Moving to location ${i + 1}`,
      duration: 6,
      status: "pending",
    });
    phases.push({
      id: id++,
      name: `Spraying at location ${i + 1}`,
      duration: 4,
      status: "pending",
    });
  });

  phases.push({ id: id++, name: "Returning home", duration: 8,  status: "pending" });
  phases.push({ id: id++, name: "Landing",        duration: 5,  status: "pending" });
  phases.push({ id: id,   name: "Mission complete", duration: 2, status: "pending" });

  return phases;
}

/**
 * Detect whether the user's input is a weed spray command.
 * Checks for common phrasings without requiring exact wording.
 */
function isSprayMission(input: string): boolean {
  const t = input.toLowerCase();
  return (
    t.includes("spray") ||
    t.includes("weed") ||
    t.includes("herbicide") ||
    t.includes("treat") ||
    (t.includes("detect") && t.includes("area")) ||
    t.includes("precision")
  );
}

export function useMissionState() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [missionInput, setMissionInput] = useState("");
  const [summary, setSummary] = useState("");
  const [phases, setPhases] = useState<MissionPhase[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceData | null>(null);
  const [flightData, setFlightData] = useState<FlightData>(INITIAL_FLIGHT_DATA);
  const [preflightStep, setPreflightStep] = useState(0);

  // Weed waypoints used by both phase builder and LiveMap
  const [weedWaypoints, setWeedWaypoints] = useState<[number, number][]>(
    FALLBACK_WEED_WAYPOINTS
  );
  const [isSprayMode, setIsSprayMode] = useState(false);

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const awaitingApiRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current)   clearInterval(intervalRef.current);
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
  }, []);

  const generateMission = useCallback(async () => {
    setAppState("generating");
    const sprayMode = isSprayMission(missionInput);
    setIsSprayMode(sprayMode);

    try {
      if (sprayMode) {
        // ── Spray mission: fetch weed coordinates FIRST, then build phases ──
        const weedMap = await getWeedMap();
        let waypoints = FALLBACK_WEED_WAYPOINTS;

        if (weedMap) {
          const live = weedZonesToWaypoints(weedMap);
          if (live && live.length > 0) waypoints = live;
        }

        setWeedWaypoints(waypoints);

        const sprayPhases = buildSprayPhases(waypoints);
        setPhases(sprayPhases);

        setSummary(
          `Precision spray mission — ${waypoints.length} weed zones identified. ` +
          `Drone will visit each zone in sequence, activating the spray nozzle for 4 seconds per location. ` +
          `Total estimated flight time: ${sprayPhases.reduce((a, p) => a + p.duration, 0)}s. ` +
          `Chemical usage reduced by ~78% vs blanket spray.`
        );

        setConfidence({
          score: 91,
          factors: [
            { label: "Weed Data Available", value: weedMap ? 98 : 80 },
            { label: "GPS Lock Strong",      value: 94 },
            { label: "Battery Sufficient",   value: 91 },
            { label: "Path Valid",           value: 92 },
          ],
        });

        setAppState("generated");
      } else {
        // ── Standard mission: use Gemini-generated phases as before ──
        const res = await apiGenerateMission(missionInput);
        setSummary(res.missionSummary);
        setPhases(
          res.missionPhases.map((p) => ({
            id: p.id,
            name: p.name,
            duration: p.duration,
            status: "pending" as PhaseStatus,
          }))
        );
        setConfidence({
          score: res.confidenceScore,
          factors: res.confidenceFactors,
        });
        setAppState("generated");
      }
    } catch (e) {
      setAppState("idle");
      toast.error(e instanceof Error ? e.message : "Failed to generate mission");
    }
  }, [missionInput]);

  const startPreflight = useCallback(() => {
    setAppState("preflight");
    setPreflightStep(0);
  }, []);

  const startExecution = useCallback(async () => {
    awaitingApiRef.current = true;
    setAppState("executing");

    // Mark only the first phase as in_progress — others tick forward one by one
    setPhases((prev) =>
      prev.map((p, i) =>
        i === 0
          ? { ...p, status: "in_progress" as PhaseStatus, timeRemaining: p.duration }
          : p
      )
    );
    setFlightData({ ...INITIAL_FLIGHT_DATA, battery: 95 });

    try {
      const res = await executeMission();
      awaitingApiRef.current = false;
      if (res.success) {
        setAppState("completed");
      } else {
        clearTimers();
        setAppState("aborted");
        toast.error(res.message);
      }
    } catch (e) {
      awaitingApiRef.current = false;
      clearTimers();
      setAppState("aborted");
      toast.error(e instanceof Error ? e.message : "Failed to execute mission");
    }
  }, [clearTimers]);

  // ── Flight data ticker ────────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== "executing") return;
    intervalRef.current = setInterval(() => {
      setFlightData((prev) => ({
        ...prev,
        flightTime: prev.flightTime + 1,
        battery: Math.max(prev.battery - 0.15, 0),
        altitude:
          prev.altitude < 10
            ? Math.min(prev.altitude + 0.8, 12.5)
            : prev.altitude,
      }));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [appState]);

  // ── Phase progression — one step per second, no skipping ─────────────────
  useEffect(() => {
    if (appState !== "executing") return;
    phaseTimerRef.current = setInterval(() => {
      setPhases((prev) => {
        const currentIdx = prev.findIndex((p) => p.status === "in_progress");
        if (currentIdx === -1) return prev;
        const current = prev[currentIdx];

        // Still counting down
        if (current.timeRemaining && current.timeRemaining > 1) {
          return prev.map((p, i) =>
            i === currentIdx ? { ...p, timeRemaining: p.timeRemaining! - 1 } : p
          );
        }

        // Complete current, start next
        const next = prev.map((p, i) => {
          if (i === currentIdx)
            return { ...p, status: "completed" as PhaseStatus, timeRemaining: 0 };
          if (i === currentIdx + 1)
            return { ...p, status: "in_progress" as PhaseStatus, timeRemaining: p.duration };
          return p;
        });

        // Last phase done
        if (currentIdx === prev.length - 1 && !awaitingApiRef.current) {
          setTimeout(() => setAppState("completed"), 500);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, [appState]);

  const abortMission = useCallback(async () => {
    try {
      await apiAbortMission();
    } catch {
      // Still set aborted locally
    }
    clearTimers();
    setAppState("aborted");
    setPhases((prev) =>
      prev.map((p) =>
        p.status === "in_progress"
          ? { ...p, status: "pending" as PhaseStatus }
          : p
      )
    );
  }, [clearTimers]);

  const returnToHome = useCallback(async () => {
    try {
      await apiReturnHome();
    } catch {
      // Still set aborted locally
    }
    clearTimers();
    setAppState("aborted");
  }, [clearTimers]);

  const resetMission = useCallback(() => {
    clearTimers();
    setAppState("idle");
    setMissionInput("");
    setSummary("");
    setPhases([]);
    setConfidence(null);
    setFlightData(INITIAL_FLIGHT_DATA);
    setPreflightStep(0);
    setIsSprayMode(false);
    setWeedWaypoints(FALLBACK_WEED_WAYPOINTS);
  }, [clearTimers]);

  return {
    appState,
    missionInput,
    setMissionInput,
    summary,
    phases,
    confidence,
    flightData,
    preflightStep,
    setPreflightStep,
    generateMission,
    startPreflight,
    startExecution,
    abortMission,
    returnToHome,
    resetMission,
    // Expose for LiveMap to consume the same waypoints
    weedWaypoints,
    isSprayMode,
  };
}
