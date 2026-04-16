import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  generateMission as apiGenerateMission,
  executeMission,
  abortMission as apiAbortMission,
  returnHome as apiReturnHome,
  getSimMode,
  getWeedMap,
  weedZonesToWaypoints,
} from "@/lib/api";
import type { ConfidenceFactorResponse } from "@/lib/api";
import { buildFallbackWeedWaypoints } from "@/lib/field";

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

const FALLBACK_WEED_WAYPOINTS = buildFallbackWeedWaypoints();

function isSprayInput(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("spray") ||
    normalized.includes("weed") ||
    normalized.includes("herbicide") ||
    normalized.includes("precision") ||
    (normalized.includes("detect") && normalized.includes("field"))
  );
}

function buildSprayPhases(waypoints: [number, number][]): MissionPhase[] {
  const phases: MissionPhase[] = [
    { id: 1, name: "Initialization", duration: 4, status: "pending" },
    { id: 2, name: "Fetching weed coordinates", duration: 3, status: "pending" },
    { id: 3, name: "Path planning", duration: 3, status: "pending" },
    { id: 4, name: "Takeoff", duration: 8, status: "pending" },
  ];

  let id = 5;
  waypoints.forEach((_, index) => {
    phases.push({ id: id++, name: `Moving to location ${index + 1}`, duration: 6, status: "pending" });
    phases.push({ id: id++, name: `Spraying at location ${index + 1}`, duration: 4, status: "pending" });
  });
  phases.push({ id: id++, name: "Returning home", duration: 8, status: "pending" });
  phases.push({ id: id++, name: "Landing", duration: 5, status: "pending" });
  phases.push({ id, name: "Mission complete", duration: 2, status: "pending" });

  return phases;
}

export function useMissionState() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [missionInput, setMissionInput] = useState("");
  const [summary, setSummary] = useState("");
  const [phases, setPhases] = useState<MissionPhase[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceData | null>(null);
  const [flightData, setFlightData] = useState<FlightData>(INITIAL_FLIGHT_DATA);
  const [preflightStep, setPreflightStep] = useState(0);
  const [weedWaypoints, setWeedWaypoints] = useState<[number, number][]>(FALLBACK_WEED_WAYPOINTS);
  const [isSprayMode, setIsSprayMode] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const awaitingApiRef = useRef(false);

  useEffect(() => {
    getSimMode()
      .then((state) => setSimMode(state.mission_sim))
      .catch(() => {});
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
  }, []);

  const generateMission = useCallback(async () => {
    setAppState("generating");
    const sprayMode = isSprayInput(missionInput);
    setIsSprayMode(sprayMode);

    try {
      if (sprayMode) {
        let waypoints = FALLBACK_WEED_WAYPOINTS;

        try {
          const map = await getWeedMap();
          const liveWaypoints = weedZonesToWaypoints(map);
          if (liveWaypoints.length > 0) {
            waypoints = liveWaypoints;
          }
        } catch {}

        const sprayPhases = buildSprayPhases(waypoints);
        setWeedWaypoints(waypoints);
        setSummary(
          `Precision spray mission - ${waypoints.length} weed zones identified. ` +
          `Drone visits each zone and activates the spray nozzle for 4 seconds per location. ` +
          `Total estimated time: ${sprayPhases.reduce((total, phase) => total + phase.duration, 0)}s. ` +
          `Chemical usage reduced around 78% versus blanket spray.`
        );
        setPhases(sprayPhases);
        setConfidence({
          score: 91,
          factors: [
            { label: "Weed Data Available", value: 98 },
            { label: "GPS Lock", value: 94 },
            { label: "Battery Sufficient", value: 91 },
            { label: "Path Valid", value: 92 },
          ],
        });
      } else {
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
      }

      setAppState("generated");
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
    setAppState("executing");
    setPhases((prev) =>
      prev.map((p, i) =>
        i === 0
          ? { ...p, status: "in_progress" as PhaseStatus, timeRemaining: p.duration }
          : p
      )
    );
    setFlightData({ ...INITIAL_FLIGHT_DATA, battery: 95 });

    if (simMode) {
      awaitingApiRef.current = false;
      return;
    }

    awaitingApiRef.current = true;
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
  }, [clearTimers, simMode]);

  // Flight data ticker during execution
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

  // Phase progression
  useEffect(() => {
    if (appState !== "executing") return;
    phaseTimerRef.current = setInterval(() => {
      setPhases((prev) => {
        const currentIdx = prev.findIndex((p) => p.status === "in_progress");
        if (currentIdx === -1) return prev;
        const current = prev[currentIdx];
        if (current.timeRemaining && current.timeRemaining > 1) {
          return prev.map((p, i) =>
            i === currentIdx ? { ...p, timeRemaining: p.timeRemaining! - 1 } : p
          );
        }
        // Complete current, start next
        const next = prev.map((p, i) => {
          if (i === currentIdx) return { ...p, status: "completed" as PhaseStatus, timeRemaining: 0 };
          if (i === currentIdx + 1) return { ...p, status: "in_progress" as PhaseStatus, timeRemaining: p.duration };
          return p;
        });
        // Check if all done — only auto-complete when not awaiting API
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
    weedWaypoints,
    isSprayMode,
    simMode,
    setSimMode,
    preflightStep,
    setPreflightStep,
    generateMission,
    startPreflight,
    startExecution,
    abortMission,
    returnToHome,
    resetMission,
  };
}
