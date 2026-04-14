import { AlertTriangle, Home } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
         AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
         AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { AppState } from "@/hooks/useMissionState";

export function EmergencyControls({ appState, onAbort, onReturnHome }:
  { appState: AppState; onAbort: () => void; onReturnHome: () => void }) {
  const on = appState === "executing";
  return (
    <div className="card-base p-4 space-y-2 border-red-100">
      <h2 className="section-label text-red-600">Emergency Controls</h2>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button disabled={!on} className={`btn-danger w-full py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${on ? "animate-pulse-green" : ""}`}>
            <AlertTriangle className="w-4 h-4"/>ABORT MISSION
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="card-base">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Abort Mission?</AlertDialogTitle>
            <AlertDialogDescription>This will immediately stop all motors. The drone will attempt emergency landing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-outline text-sm px-4 py-2">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onAbort} className="btn-danger text-sm px-4 py-2">Confirm Abort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button disabled={!on} className="btn-warning w-full py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed">
            <Home className="w-4 h-4"/>Return to Home
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="card-base">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600">Return to Home?</AlertDialogTitle>
            <AlertDialogDescription>The drone will abandon the mission and return to launch coordinates.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-outline text-sm px-4 py-2">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReturnHome} className="btn-warning text-sm px-4 py-2">Confirm RTH</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
