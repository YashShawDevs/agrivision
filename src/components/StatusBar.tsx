import { Activity, Cpu, Server } from "lucide-react";
export function StatusBar() {
  return (
    <footer className="h-7 flex items-center justify-between px-6 border-t border-border bg-gray-50 text-[10px] font-mono text-muted-foreground z-50">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-green-500" />System OK</span>
        <span className="flex items-center gap-1"><Server className="w-3 h-3" />localhost:8000</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />YOLOv8s · mAP 82.1%</span>
        <span className="text-muted-foreground/50">SAGE AI × AgriVision v2.0</span>
      </div>
    </footer>
  );
}
