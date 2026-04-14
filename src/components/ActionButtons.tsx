import { CheckCircle2, Play, XCircle } from "lucide-react";
import type { AppState } from "@/hooks/useMissionState";

interface Props { appState: AppState; onApprove: () => void; onCancel: () => void; onReset: () => void }

export function ActionButtons({ appState, onApprove, onCancel, onReset }: Props) {
  if (appState === "completed" || appState === "aborted") {
    return (
      <button onClick={onReset} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm">
        <Play className="w-4 h-4"/>Start New Mission
      </button>
    );
  }
  const on = appState === "generated";
  return (
    <div className="flex gap-2">
      <button onClick={onApprove} disabled={!on}
        className="btn-success flex-1 py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
        <CheckCircle2 className="w-4 h-4"/>Approve & Execute
      </button>
      <button onClick={onCancel} disabled={!on}
        className="btn-outline flex-1 py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
        <XCircle className="w-4 h-4"/>Cancel
      </button>
    </div>
  );
}
