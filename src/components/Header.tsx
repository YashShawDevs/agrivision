import { useEffect, useState } from "react";
import { Wifi, WifiOff, Leaf } from "lucide-react";

// Inline "S" mark — eliminates build-crash from missing S.png asset file
function SMarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="20" height="20">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#16a6ff"/>
          <stop offset="100%" stopColor="#22d3ee"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#020617"/>
      <rect x="7" y="7" width="50" height="50" rx="12" fill="url(#bg)"/>
      <text x="32" y="42" textAnchor="middle" fontFamily="system-ui, sans-serif"
        fontSize="30" fill="#0f172a" fontWeight="700">S</text>
    </svg>
  );
}

interface HeaderProps { connected: boolean }

export function Header({ connected }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-border shadow-sm z-50 relative">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
          <SMarkIcon />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
            SAGE <span className="text-primary">AI</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">× AgriVision</span>
          </h1>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Ground Control Station</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* AgriVision badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full">
          <Leaf className="w-3 h-3 text-green-600" />
          <span className="text-[11px] font-semibold text-green-700">Precision Agriculture</span>
        </div>

        {/* Clock */}
        <span className="hidden md:block text-xs font-mono text-muted-foreground tabular-nums">
          {time.toLocaleTimeString("en-US", { hour12: false })}
        </span>

        {/* Connection */}
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Wifi className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">Connected</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-red-600 font-medium">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
