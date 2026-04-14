import { CheckCircle2, Circle, Loader2, Zap, Shield, ArrowUp, Navigation,
         Pause, RotateCcw, ArrowDown, LandPlot } from "lucide-react";
import type { MissionPhase, AppState } from "@/hooks/useMissionState";

const ICONS: Record<string, React.ElementType> = {
  "Arm Motors": Zap, "Pre-flight Systems Check": Shield, "Takeoff": ArrowUp,
  "Ascend to Target Altitude": Navigation, "Hover at Position": Pause,
  "Return to Home": RotateCcw, "Descend": ArrowDown, "Landing": LandPlot,
};

export function MissionProgress({ phases, appState }: { phases: MissionPhase[]; appState: AppState }) {
  return (
    <div className="card-base p-4 space-y-3">
      <h2 className="section-label">Mission Phases</h2>
      {phases.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Generate a mission to see phases</p>
      ) : (
        <div className="space-y-1">
          {phases.map(p => {
            const Icon = ICONS[p.name] || Circle;
            const done = p.status === "completed";
            const live = p.status === "in_progress";
            return (
              <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                live ? "bg-amber-50 border border-amber-200"
                : done ? "bg-green-50/60" : "opacity-50"}`}>
                {done  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 animate-check-bounce"/>
                : live ? <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0"/>
                       : <Circle className="w-4 h-4 text-gray-300 shrink-0"/>}
                <Icon className={`w-3.5 h-3.5 shrink-0 ${done?"text-green-600":live?"text-amber-600":"text-gray-400"}`}/>
                <span className={`flex-1 text-sm ${done?"text-green-700":live?"text-amber-700 font-medium":"text-muted-foreground"}`}>
                  {p.name}
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {live && p.timeRemaining ? `${p.timeRemaining}s` : `${p.duration}s`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
