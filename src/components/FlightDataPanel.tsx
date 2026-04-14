import { Battery, ArrowUp, Satellite, Clock } from "lucide-react";
import type { FlightData } from "@/hooks/useMissionState";

function fmt(s: number) {
  const m = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(Math.floor(s%60)).padStart(2,"0");
  return `00:${m}:${ss}`;
}

export function FlightDataPanel({ data }: { data: FlightData }) {
  const bColor = data.battery > 50 ? "text-green-600" : data.battery > 30 ? "text-amber-600" : "text-red-600";
  const bBg    = data.battery > 50 ? "bg-green-50 border-green-200" : data.battery > 30 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const circ   = 2 * Math.PI * 22;
  const offset = circ - (data.battery / 100) * circ;

  return (
    <div className="card-base p-4 space-y-3">
      <h2 className="section-label">Flight Data</h2>
      <div className="grid grid-cols-2 gap-2">
        {/* Battery */}
        <div className={`rounded-lg border p-3 flex flex-col items-center gap-1.5 ${bBg}`}>
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="hsl(var(--border))" strokeWidth="3"/>
              <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                className={`${bColor} transition-all duration-1000`}/>
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${bColor}`}>
              {Math.round(data.battery)}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Battery className={`w-3 h-3 ${bColor}`}/>Battery
          </span>
        </div>

        {/* Altitude */}
        <div className="rounded-lg border border-border bg-white p-3 flex flex-col items-center justify-center gap-1.5">
          <span className="text-xl font-bold text-foreground tabular-nums">{data.altitude.toFixed(1)}<span className="text-xs text-muted-foreground ml-0.5">m</span></span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ArrowUp className="w-3 h-3 text-primary"/>Altitude</span>
        </div>

        {/* GPS */}
        <div className="rounded-lg border border-border bg-white p-3 flex flex-col items-center justify-center gap-1.5">
          {data.gpsLock
            ? <span className="text-sm font-semibold text-green-600">Locked</span>
            : <span className="text-sm font-semibold text-amber-600 animate-pulse">Searching…</span>}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Satellite className={`w-3 h-3 ${data.gpsLock?"text-green-500":"text-amber-500"}`}/>GPS
          </span>
        </div>

        {/* Time */}
        <div className="rounded-lg border border-border bg-white p-3 flex flex-col items-center justify-center gap-1.5">
          <span className="text-sm font-bold font-mono tabular-nums text-foreground">{fmt(data.flightTime)}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-primary"/>Flight Time</span>
        </div>
      </div>
    </div>
  );
}
