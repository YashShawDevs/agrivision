import { useState } from "react";
import { Camera, Maximize2, Wifi, WifiOff, Circle } from "lucide-react";

const DEFAULT_STREAM = "http://192.168.1.100:8080/?action=stream";

export function CameraFeed({ streamUrl = DEFAULT_STREAM }: { streamUrl?: string }) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="card-base overflow-hidden relative group h-full" style={{ minHeight: 200 }}>
      {streaming && !error ? (
        <div className="w-full h-full bg-black relative">
          <img src={streamUrl} alt="Drone feed"
            className="w-full h-full object-cover"
            onError={() => { setError(true); setStreaming(false); }}/>
          {/* Live badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5">
            <Circle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse"/>
            <span className="text-[10px] font-bold text-white tracking-wider">LIVE</span>
          </div>
          {/* Corner marks */}
          {["top-2 left-2","top-2 right-2","bottom-2 left-2","bottom-2 right-2"].map((pos,i) => (
            <div key={i} className={`absolute ${pos} w-3 h-3 border-white/30 ${
              i<2?"border-t":"border-b"} ${i%2===0?"border-l":"border-r"}`}/>
          ))}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-50 p-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 border border-border flex items-center justify-center">
            {error ? <WifiOff className="w-6 h-6 text-red-400"/> : <Camera className="w-6 h-6 text-gray-400"/>}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{error ? "Stream Disconnected" : "Camera Feed"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error ? "Could not connect to MJPEG stream" : "Awaiting drone connection"}
            </p>
          </div>
          <button onClick={() => { setError(false); setStreaming(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium hover:bg-primary/20 transition-colors">
            <Wifi className="w-3 h-3"/>{error ? "Retry Connection" : "Connect Stream"}
          </button>
        </div>
      )}
      <button className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/80 border border-border
        flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <Maximize2 className="w-3.5 h-3.5 text-foreground"/>
      </button>
    </div>
  );
}
