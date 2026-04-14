import { Sparkles, Loader2 } from "lucide-react";
import type { AppState } from "@/hooks/useMissionState";
import { SimToggle } from "@/components/SimToggle";

interface Props { value: string; onChange: (v: string) => void; onGenerate: () => void; appState: AppState }

export function MissionInput({ value, onChange, onGenerate, appState }: Props) {
  const busy     = appState === "generating";
  const disabled = appState === "executing" || appState === "preflight";
  const regen    = ["generated","completed","aborted"].includes(appState);

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-label">Mission Input</h2>
        <SimToggle mode="mission" label="Sim Mode"/>
      </div>
      <textarea
        className="input-base h-28 resize-none"
        placeholder="Describe your mission… e.g. 'Scan north field at 20m altitude, detect weeds, return home'"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">{value.length} chars</span>
        <button
          onClick={onGenerate}
          disabled={busy || disabled || !value.trim()}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Generating…</>
                : <><Sparkles className="w-3.5 h-3.5"/>{regen ? "Regenerate" : "Generate Mission"}</>}
        </button>
      </div>
    </div>
  );
}
