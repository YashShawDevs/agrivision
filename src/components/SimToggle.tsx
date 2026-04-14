import { useState, useEffect } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { getSimMode, setMissionSim, setWeedDemo } from "@/lib/api";

interface Props {
  mode: "mission" | "weed";
  label: string;
}

export function SimToggle({ mode, label }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync with backend on mount
  useEffect(() => {
    getSimMode()
      .then(s => setEnabled(mode === "mission" ? s.mission_sim : s.weed_demo))
      .catch(() => {});
  }, [mode]);

  const toggle = async () => {
    setLoading(true);
    try {
      const next = !enabled;
      if (mode === "mission") await setMissionSim(next);
      else                    await setWeedDemo(next);
      setEnabled(next);
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
          ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`}
    >
      {loading
        ? <Loader2 className="w-3 h-3 animate-spin"/>
        : <FlaskConical className={`w-3 h-3 ${enabled ? "text-amber-500" : "text-gray-400"}`}/>
      }
      {label}
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-amber-400" : "bg-gray-300"}`}/>
    </button>
  );
}
