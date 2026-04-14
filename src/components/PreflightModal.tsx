import { useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CHECKS = [
  "Connecting to drone…", "Checking battery levels…", "Verifying GPS signal…",
  "Initializing flight controller…", "All systems ready!",
];

interface Props { open: boolean; step: number; onStepChange: (s: number) => void; onComplete: () => void }

export function PreflightModal({ open, step, onStepChange, onComplete }: Props) {
  useEffect(() => {
    if (!open) return;
    if (step < CHECKS.length) {
      const t = setTimeout(() => onStepChange(step + 1), 700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [open, step, onStepChange, onComplete]);

  return (
    <Dialog open={open}>
      <DialogContent className="card-base max-w-sm [&>button]:hidden">
        <div className="space-y-5 py-1">
          <div className="text-center">
            <h2 className="text-base font-semibold text-foreground">Pre-flight Checklist</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Verifying all systems before launch</p>
          </div>
          <div className="space-y-2">
            {CHECKS.map((check, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${
                i < step ? "opacity-100" : i === step ? "opacity-70" : "opacity-0"}`}
                style={{ transitionDelay: `${i * 80}ms` }}>
                {i < step
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 animate-check-bounce"/>
                  : <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0"/>}
                <span className={`text-sm ${i < step ? "text-green-700" : "text-muted-foreground"}`}>{check}</span>
              </div>
            ))}
          </div>
          {step >= CHECKS.length && (
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"/>
                <span className="text-xs font-semibold text-green-700">Launching mission…</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
