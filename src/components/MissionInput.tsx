import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppState } from "@/hooks/useMissionState";
import { SimToggle } from "@/components/SimToggle";

interface MissionInputProps {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  appState: AppState;
}

export function MissionInput({ value, onChange, onGenerate, appState }: MissionInputProps) {
  const isGenerating = appState === "generating";
  const isDisabled   = appState === "executing" || appState === "preflight";
  const isRegenerate = appState === "generated" || appState === "completed" || appState === "aborted";

  return (
    <div className="glass-card-glow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-label text-primary">Mission Input</h2>
        <SimToggle mode="mission" label="Sim Mode" />
      </div>
      <textarea
        className="w-full h-28 bg-muted/40 border border-border/60 rounded-lg p-3 text-sm
          text-foreground placeholder:text-muted-foreground/60 resize-none
          focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all"
        placeholder="Describe your mission... (e.g., 'Scan north field for weeds at 20m altitude')"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={isDisabled}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">{value.length} chars</span>
        <Button
          onClick={onGenerate}
          disabled={isGenerating || isDisabled || value.trim().length === 0}
          className="btn-glow-primary px-5 py-2 rounded-lg text-sm"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{isRegenerate ? "Regenerate" : "Generate Mission"}</>
          )}
        </Button>
      </div>
    </div>
  );
}
