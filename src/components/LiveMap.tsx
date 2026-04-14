import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AppState } from "@/hooks/useMissionState";

// Inline drone marker — no external asset dependency, eliminates build-crash risk
const DRONE_ICON_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' width='36' height='36'>
    <circle cx='24' cy='24' r='22' fill='%23166534' stroke='%2322c55e' stroke-width='2'/>
    <path d='M14 20h4v8h-4zM30 20h4v8h-4zM20 14v4h8v-4zM20 30v4h8v-4z' fill='%2322c55e'/>
    <circle cx='24' cy='24' r='5' fill='white'/>
    <circle cx='24' cy='24' r='2.5' fill='%23166534'/>
  </svg>`
)}`;

const HOME: [number, number] = [19.0760, 72.8777];
const WAYPOINTS: [number, number][] = [
  [19.0760, 72.8777],[19.0768, 72.8788],[19.0775, 72.8795],
  [19.0780, 72.8788],[19.0783, 72.8775],[19.0778, 72.8762],
  [19.0771, 72.8758],[19.0765, 72.8768],[19.0760, 72.8777],
];

export function LiveMap({ appState = "idle" }: { appState?: AppState }) {
  const [coords, setCoords] = useState<[number,number]>(HOME);
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<L.Map|null>(null);
  const marker    = useRef<L.Marker|null>(null);
  const homeM     = useRef<L.Marker|null>(null);
  const trail     = useRef<L.Polyline|null>(null);
  const planned   = useRef<L.Polyline|null>(null);
  const animFrame = useRef<number|null>(null);
  const wpIdx     = useRef(0);
  const prog      = useRef(0);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { center: HOME, zoom: 16, zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    // Use SVG data-URI so the marker always renders regardless of asset pipeline
    const icon = L.icon({ iconUrl: DRONE_ICON_SVG, iconSize:[36,36], iconAnchor:[18,18] });
    marker.current = L.marker(HOME, { icon }).addTo(map);
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInst.current; const m = marker.current;
    if (!map || !m) return;

    if (appState === "executing") {
      const homeIcon = L.divIcon({ html:`<div style="width:24px;height:24px;background:#2563eb;border:2px solid #93c5fd;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`, iconSize:[24,24], iconAnchor:[12,12], className:"" });
      homeM.current = L.marker(HOME, { icon: homeIcon, interactive: false }).addTo(map);
      planned.current = L.polyline(WAYPOINTS, { color:"#22c55e", weight:2, opacity:0.4, dashArray:"6 8" }).addTo(map);
      trail.current = L.polyline([], { color:"#16a34a", weight:3, opacity:0.9 }).addTo(map);
      wpIdx.current = 0; prog.current = 0;
      const trailC: [number,number][] = [WAYPOINTS[0]];

      const animate = () => {
        const i = wpIdx.current;
        if (i >= WAYPOINTS.length - 1) return;
        prog.current += 0.009;
        if (prog.current >= 1) { prog.current = 0; wpIdx.current += 1; if (wpIdx.current >= WAYPOINTS.length-1) { m.setLatLng(WAYPOINTS[WAYPOINTS.length-1]); return; } }
        const f = WAYPOINTS[wpIdx.current]; const t2 = WAYPOINTS[wpIdx.current+1]; const tt = prog.current;
        const lat = f[0]+(t2[0]-f[0])*tt; const lng = f[1]+(t2[1]-f[1])*tt;
        m.setLatLng([lat,lng]); setCoords([lat,lng]);
        trailC.push([lat,lng]); trail.current?.setLatLngs(trailC);
        animFrame.current = requestAnimationFrame(animate);
      };
      animFrame.current = requestAnimationFrame(animate);
      return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
    }

    if (appState === "idle") {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      homeM.current?.remove(); homeM.current = null;
      trail.current?.remove(); trail.current = null;
      planned.current?.remove(); planned.current = null;
      m.setLatLng(HOME); wpIdx.current = 0; prog.current = 0;
    } else if (appState === "completed" || appState === "aborted") {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    }
  }, [appState]);

  return (
    <div className="map-container relative group h-full" style={{ minHeight: 200 }}>
      <div ref={mapRef} className="w-full h-full"/>
      {appState === "executing" && (
        <div className="absolute bottom-2 left-2 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-mono shadow-sm">
          <span className="text-muted-foreground">LAT</span>
          <span className="text-foreground font-semibold">{coords[0].toFixed(5)}</span>
          <span className="text-muted-foreground">LNG</span>
          <span className="text-foreground font-semibold">{coords[1].toFixed(5)}</span>
        </div>
      )}
      <button className="absolute top-2 right-2 z-[1000] w-7 h-7 rounded-md bg-white/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <Maximize2 className="w-3.5 h-3.5 text-foreground"/>
      </button>
    </div>
  );
}
