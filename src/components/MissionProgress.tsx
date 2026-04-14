import {
  CheckCircle, Circle, Loader, Zap, Navigation, ArrowUp, Pause,
  RotateCcw, ArrowDown, LandPlot, Shield, MapPin, Droplets,
  Route, Radio, Plane, Flag,
} from "lucide-react";
import type { MissionPhase, AppState } from "@/hooks/useMissionState";

// ── Icon map — covers standard phases + weed spray phases ─────────────────────
const PHASE_ICONS: Record<string, React.ElementType> = {
  // Generic
  "Arm Motors":                  Zap,
  "Pre-flight Systems Check":    Shield,
  "Takeoff":                     ArrowUp,
  "Ascend to Target Altitude":   Navigation,
  "Hover at Position":           Pause,
  "Return to Home":              RotateCcw,
  "Returning home":              RotateCcw,
  "Descend":                     ArrowDown,
  "Landing":                     LandPlot,
  // Spray mission specific
  "Initialization":              Radio,
  "Fetching weed coordinates":   MapPin,
  "Path planning":               Route,
  "Mission complete":            Flag,
};

// Prefix-based icon matching for dynamic "Moving to X" / "Spraying at X" phases
function getIcon(name: string): React.ElementType {
  if (PHASE_ICONS[name]) return PHASE_ICONS[name];
  if (name.startsWith("Moving to"))  return Plane;
  if (name.startsWith("Spraying at")) return Droplets;
  return Circle;
}

interface MissionProgressProps {
  phases: MissionPhase[];
  appState: AppState;
  isSprayMode?: boolean;
}

export function MissionProgress({
  phases,
  appState,
  isSprayMode = false,
}: MissionProgressProps) {
  const activeIdx = phases.findIndex((p) => p.status === "in_progress");

  return (
    <div className="glass-card-glow p-4 space-y-3 flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="section-label text-primary">Mission Phases</h2>
        {isSprayMode && appState === "executing" && (
          <span className="text-[10px] font-semibold text-success animate-pulse uppercase tracking-widest">
            Spray Active
          </span>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground/60 text-sm">
          Generate a mission to see phases
        </div>
      ) : (
        // Scrollable phase list — shows up to ~7 rows then scrolls
        <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: "340px" }}>
          {phases.map((phase, i) => {
            const Icon = getIcon(phase.name);
            const isSprayPhase = phase.name.startsWith("Spraying at");
            const isMovePhase  = phase.name.startsWith("Moving to");

            return (
              <div
                key={phase.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                  phase.status === "in_progress"
                    ? isSprayPhase
                      ? "bg-success/10 border border-success/30"
                      : "bg-warning/10 border border-warning/20"
                    : phase.status === "completed"
                    ? "bg-success/[0.04]"
                    : i < activeIdx
                    ? "opacity-40"    // past phases dim out
                    : "opacity-50"
                }`}
              >
                {/* Status icon */}
                {phase.status === "completed" ? (
                  <CheckCircle className="w-4 h-4 text-success shrink-0" />
                ) : phase.status === "in_progress" ? (
                  <Loader
                    className={`w-4 h-4 shrink-0 ${
                      isSprayPhase ? "text-success" : "text-warning"
                    } animate-spin-slow`}
                  />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}

                {/* Phase-type icon */}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    phase.status === "completed"
                      ? "text-success"
                      : phase.status === "in_progress"
                      ? isSprayPhase
                        ? "text-success"
                        : "text-warning"
                      : "text-muted-foreground"
                  } ${
                    isSprayPhase && phase.status === "in_progress"
                      ? "animate-bounce"   // droplets icon bounces while spraying
                      : ""
                  }`}
                />

                {/* Phase name */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-medium truncate block ${
                      phase.status === "completed"
                        ? "text-success"
                        : phase.status === "in_progress"
                        ? isSprayPhase
                          ? "text-success"
                          : "text-warning"
                        : "text-muted-foreground"
                    }`}
                  >
                    {phase.name}
                  </span>
                </div>

                {/* Timer / duration */}
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {phase.status === "in_progress" && phase.timeRemaining
                    ? `${phase.timeRemaining}s`
                    : `${phase.duration}s`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar at bottom */}
      {phases.length > 0 && (
        <div className="pt-1">
          <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{
                width: `${
                  (phases.filter((p) => p.status === "completed").length /
                    phases.length) *
                  100
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
            <span>{phases.filter((p) => p.status === "completed").length} / {phases.length} done</span>
            <span>
              {phases
                .filter((p) => p.status !== "completed")
                .reduce((a, p) => a + p.duration, 0)}
              s remaining
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
