import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

function scoreStyle(s: number) {
  if (s >= 85) return { text:"text-green-700", bar:"bg-green-500", bg:"bg-green-50 border-green-200" };
  if (s >= 70) return { text:"text-amber-700", bar:"bg-amber-500", bg:"bg-amber-50 border-amber-200" };
  return       { text:"text-red-700",   bar:"bg-red-500",   bg:"bg-red-50 border-red-200" };
}
function dotColor(v: number) {
  if (v > 85) return "bg-green-500"; if (v > 70) return "bg-amber-500"; return "bg-red-500";
}

interface Props { visible: boolean; confidenceScore?: number; confidenceFactors?: {label:string;value:number}[] }

export function MissionConfidence({ visible, confidenceScore, confidenceFactors }: Props) {
  const [anim, setAnim] = useState(0);
  const score = confidenceScore ?? 0;

  useEffect(() => {
    if (!visible || !score) { setAnim(0); return; }
    setAnim(0);
    let cur = 0;
    const step = Math.max(1, Math.ceil(score / 30));
    const t = setInterval(() => {
      cur = Math.min(cur + step, Math.round(score));
      setAnim(cur);
      if (cur >= Math.round(score)) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [visible, score]);

  if (!visible || (!score && !confidenceFactors?.length)) return null;
  const s = scoreStyle(score);

  return (
    <div className={`card-base p-4 space-y-3 animate-fade-up border ${s.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${s.text}`} />
          <h2 className="text-sm font-semibold text-foreground">Mission Confidence</h2>
        </div>
        <span className={`text-2xl font-bold font-mono tabular-nums ${s.text}`}>{anim}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${s.bar} transition-all duration-1000`} style={{ width:`${anim}%` }} />
      </div>
      {!!confidenceFactors?.length && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {confidenceFactors.map(f => (
            <div key={f.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor(f.value)}`} />
                <span className="text-muted-foreground">{f.label}</span>
              </div>
              <span className="font-mono text-foreground">{Math.round(f.value)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
