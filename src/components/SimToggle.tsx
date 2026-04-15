import { useState, useEffect } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { getSimMode, setMissionSim, setWeedDemo } from "@/lib/api";

interface Props {
  mode: "mission" | "weed";
  label: string;
  /** Optional: called after toggle so parent (Index) can sync useMissionState */
  onToggle?: (enabled: boolean) => void;
}

export function SimToggle({ mode, label, onToggle }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync with backend on mount
  useEffect(() => {
    getSimMode()
      .then((s) => setEnabled(mode === "mission" ? s.mission_sim : s.weed_demo))
      .catch(() => {}); // silently ignore if backend is down
  }, [mode]);

  const toggle = async () => {
    setLoading(true);
    try {
      const next = !enabled;
      if (mode === "mission") await setMissionSim(next);
      else                    await setWeedDemo(next);
      setEnabled(next);
      onToggle?.(next);
    } catch {
      // silently ignore if backend is down
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={enabled ? `Disable ${label}` : `Enable ${label}`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all
        ${enabled
          ? "bg-warning/10 border-warning/30 text-warning hover:bg-warning/20"
          : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`}
    >
      {loading
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <FlaskConical className={`w-3 h-3 ${enabled ? "text-warning" : "text-muted-foreground"}`} />
      }
      {label}
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-warning" : "bg-muted-foreground/40"}`} />
    </button>
  );
}
