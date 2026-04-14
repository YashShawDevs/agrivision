import { useEffect, useState } from "react";
import { Brain } from "lucide-react";

const LINES = [
  "Analyzing terrain topology…", "Computing optimal waypoints…",
  "Evaluating GPS coordinates…", "Simulating flight dynamics…",
  "Assessing battery drain…", "Generating safety margins…",
  "Verifying no-fly zones…", "Optimizing altitude profile…",
];
const NODES = Array.from({ length: 14 }, (_, i) => ({
  id: i, x: 10 + Math.random()*80, y: 10 + Math.random()*80, d: Math.random()*2,
}));
const EDGES = NODES.slice(0,10).map((n,i) => ({
  from: n, to: NODES[(i+3+Math.floor(Math.random()*4)) % NODES.length], d: Math.random()*1.5,
}));

export function AIThinkingOverlay() {
  const [lines, setLines] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx(p => { const n = (p+1)%LINES.length;
        setLines(prev => { const u = [...prev, LINES[n]]; return u.length>4 ? u.slice(-4) : u; });
        return n; });
    }, 450);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card-base p-4 space-y-3 animate-fade-up border-l-4 border-l-primary">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center relative">
          <Brain className="w-4 h-4 text-primary animate-pulse"/>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-ping"/>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary"/>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">SAGE AI planning mission<span className="animate-pulse">…</span></p>
          <p className="text-xs text-muted-foreground">Computing optimal flight plan</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2" style={{ height: 96 }}>
        {/* Neural viz */}
        <div className="rounded-lg bg-gray-50 border border-border overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {EDGES.map((e,i) => (
              <line key={i} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
                stroke="hsl(142 70% 35%)" strokeWidth="0.4" opacity="0.3">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur={`${1.5+e.d}s`} repeatCount="indefinite"/>
              </line>
            ))}
            {NODES.map(n => (
              <circle key={n.id} cx={n.x} cy={n.y} r="1.5" fill="hsl(142 70% 35%)" opacity="0.5">
                <animate attributeName="r" values="0.8;2;0.8" dur={`${2+n.d}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${2+n.d}s`} repeatCount="indefinite"/>
              </circle>
            ))}
          </svg>
        </div>
        {/* Code lines */}
        <div className="rounded-lg bg-gray-50 border border-border p-2 overflow-hidden flex flex-col justify-end">
          {lines.map((l,i) => (
            <div key={`${idx}-${i}`} className="flex items-center gap-1 font-mono text-[10px]"
              style={{ opacity: i === lines.length-1 ? 1 : 0.3 + (i/lines.length)*0.5 }}>
              <span className="text-primary">▸</span>
              <span className="text-muted-foreground truncate">{l}</span>
              {i === lines.length-1 && <span className="w-1 h-3 bg-primary animate-pulse inline-block"/>}
            </div>
          ))}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-primary animate-shimmer" style={{ backgroundSize:"200% 100%" }}/>
      </div>
    </div>
  );
}
