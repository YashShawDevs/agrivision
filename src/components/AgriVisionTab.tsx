import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Leaf, DollarSign, MapPin, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Clock, BarChart3, Sprout, FlaskConical,
  Maximize2, Info
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  detectImage, detectVideo, pollJob, getWeedMap, clearWeedMap,
  getSavings, getFieldInfo,
  type Detection, type SavingsReport, type FieldInfo, type GeoJSON,
} from "@/lib/api";
import { SimToggle } from "@/components/SimToggle";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const FIELD_CENTER: [number, number] = [19.0760, 72.8777];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec/60)}m ${Math.round(sec%60)}s`;
}

// ── Weed Map ─────────────────────────────────────────────────────────────────
function WeedMap({ geojson, fieldInfo }: { geojson: GeoJSON|null; fieldInfo: FieldInfo|null }) {
  const divRef  = useRef<HTMLDivElement>(null);
  const mapRef  = useRef<L.Map|null>(null);
  const layRef  = useRef<L.GeoJSON|null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: fieldInfo ? [fieldInfo.field_center_lat, fieldInfo.field_center_lon] : FIELD_CENTER,
      zoom: 17, zoomControl: true, attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) {
      layRef.current?.remove(); layRef.current = null;
      return;
    }
    layRef.current?.remove(); layRef.current = null;
    if (!geojson.features.length) return;

    const layer = L.geoJSON(geojson as never, {
      style: () => ({ color:"#dc2626", weight:2, fillColor:"#ef4444", fillOpacity:0.35 }),
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`
          <div style="font-size:12px;line-height:1.7;min-width:140px">
            <b style="color:#dc2626">🌿 ${p.weed_type}</b><br/>
            Confidence: <b>${(p.confidence*100).toFixed(0)}%</b><br/>
            Spray: <b style="color:#dc2626">YES</b><br/>
            <span style="color:#6b7280;font-size:11px">${p.lat?.toFixed(5)}, ${p.lon?.toFixed(5)}</span>
          </div>
        `, { maxWidth: 200 });
      },
    }).addTo(map);
    layRef.current = layer;
    try { map.fitBounds(layer.getBounds(), { padding:[24,24], maxZoom:19 }); } catch {}
  }, [geojson]);

  const zoneCount = geojson?.total_zones ?? 0;

  return (
    // FIX: added `relative` so the absolute empty-state overlay positions correctly
    <div className="card-base overflow-hidden relative" style={{ height: 340 }}>
      {/* Map header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gray-50">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary"/>
          <span className="text-xs font-semibold text-foreground">GPS Spray Zones</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {fieldInfo && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                {zoneCount} weed zone{zoneCount !== 1 ? "s" : ""}
              </span>
              <span>{fieldInfo.field_hectares} ha field</span>
              {fieldInfo.scan_duration_sec > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3"/>
                  {fmtDuration(fieldInfo.scan_duration_sec)}
                </span>
              )}
              <span className="status-pill-gray status-pill text-[10px] py-0 px-1.5">
                {fieldInfo.inference_mode}
              </span>
            </>
          )}
        </div>
      </div>
      <div ref={divRef} className="w-full" style={{ height: 296 }}/>
      {(!geojson || !zoneCount) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none"
          style={{ top: 40 }}>
          <MapPin className="w-8 h-8 text-gray-300"/>
          <p className="text-xs text-gray-400">Spray zones appear after detection</p>
        </div>
      )}
    </div>
  );
}

// ── Detection List ────────────────────────────────────────────────────────────
function DetectionList({ dets }: { dets: Detection[] }) {
  if (!dets.length) return null;
  const weeds = dets.filter(d => d.spray);
  const crops = dets.filter(d => !d.spray);
  return (
    <div className="card-base p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Detections</h3>
        <div className="flex gap-1.5">
          <span className="status-pill status-pill-red">{weeds.length} weeds</span>
          <span className="status-pill status-pill-green">{crops.length} crops</span>
        </div>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
        {dets.slice(0,30).map(d => (
          <div key={d.id} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 border border-border text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.spray?"bg-red-500":"bg-green-500"}`}/>
              <span className="font-medium capitalize text-foreground">{d.class}</span>
              <span className="text-muted-foreground">{(d.conf*100).toFixed(0)}%</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {d.lat.toFixed(5)}, {d.lon.toFixed(5)}
            </span>
          </div>
        ))}
        {dets.length > 30 && (
          <p className="text-[11px] text-muted-foreground text-center py-1">+{dets.length-30} more</p>
        )}
      </div>
    </div>
  );
}

// ── Savings Panel ─────────────────────────────────────────────────────────────
function SavingsPanel({ r, fi }: { r: SavingsReport|null; fi: FieldInfo|null }) {
  if (!r || !r.total_detections) return null;
  return (
    <div className="card-base p-4 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-green-600"/>
        <h3 className="text-sm font-semibold text-foreground">Impact Analysis</h3>
        {fi?.scan_duration_sec ? (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3"/>Scan: {fmtDuration(fi.scan_duration_sec)}
          </span>
        ) : null}
      </div>

      {/* Big metrics */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Sprout,     label:"Hectares",         value: `${r.hectares_scanned} ha`,           sub:"field scanned",                  hi:false },
          { icon: BarChart3,  label:"Weed Density",     value: `${r.weed_density_percent}%`,          sub:"of field area",                  hi:false },
          { icon: FlaskConical,label:"Chemical Saved",  value: `${r.chemical_saved_liters} L`,        sub:`vs ${r.blanket_spray_liters}L blanket`, hi:true },
          { icon: DollarSign, label:"Cost Saved",       value: `₹${r.cost_saved_inr.toLocaleString()}`, sub:"per mission",                 hi:true },
        ].map(({ icon: Icon, label, value, sub, hi }) => (
          <div key={label} className={hi ? "metric-card-highlight" : "metric-card"}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${hi?"text-green-600":"text-primary"}`}/>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
            </div>
            <span className={`text-xl font-bold tabular-nums ${hi?"text-green-700":"text-foreground"}`}>{value}</span>
            <span className="text-[11px] text-muted-foreground">{sub}</span>
          </div>
        ))}
      </div>

      {/* Savings bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Herbicide reduction vs blanket spray</span>
          <span className="font-semibold text-green-700">{r.savings_percent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
            style={{ width:`${Math.min(r.savings_percent,100)}%` }}/>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {r.precision_spray_liters}L targeted · {r.blanket_spray_liters}L blanket ·
          <span className="text-green-700 font-medium"> {r.chemical_saved_liters}L saved</span>
        </p>
      </div>

      {/* Detection summary */}
      <div className="flex gap-3 text-xs pt-1 border-t border-border">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-red-500"/>Weeds: <b className="text-foreground">{r.weed_count}</b>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500"/>Crops: <b className="text-foreground">{r.crop_count}</b>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
          Total: <b className="text-foreground">{r.total_detections}</b>
        </span>
      </div>
    </div>
  );
}

// ── Main AgriVision Tab ───────────────────────────────────────────────────────
type UpState = "idle"|"uploading"|"processing"|"done"|"error";

export function AgriVisionTab() {
  const [state, setState]         = useState<UpState>("idle");
  const [errMsg, setErrMsg]       = useState("");
  const [dets, setDets]           = useState<Detection[]>([]);
  const [annUrl, setAnnUrl]       = useState<string|null>(null);
  const [geojson, setGeojson]     = useState<GeoJSON|null>(null);
  const [savings, setSavings]     = useState<SavingsReport|null>(null);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo|null>(null);
  const [jobId, setJobId]         = useState<string|null>(null);
  const [drag, setDrag]           = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // FIX: stopPoll is stable - no deps needed
  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // FIX: wrap refresh in useCallback so handleFile can safely depend on it
  const refresh = useCallback(async () => {
    const [g, sv, fi] = await Promise.all([getWeedMap(), getSavings(), getFieldInfo()]);
    setGeojson(g); setSavings(sv); setFieldInfo(fi);
  }, []);

  useEffect(() => {
    if (!jobId) return;

    // FIX: always clear any existing interval before starting a new one
    stopPoll();

    pollRef.current = setInterval(async () => {
      try {
        const s = await pollJob(jobId);
        if (s.status === "completed" && s.result) {
          stopPoll();
          setAnnUrl(`${API_BASE}${s.result.annotated_url}`);
          await refresh();
          setState("done");
        } else if (s.status === "failed") {
          stopPoll();
          setErrMsg(s.error || "Video processing failed");
          setState("error");
        }
      } catch {}
    }, 2000);
    return stopPoll;
  }, [jobId, stopPoll, refresh]);

  // FIX: refresh in deps array - no stale closure
  const handleFile = useCallback(async (file: File) => {
    setErrMsg(""); setDets([]); setAnnUrl(null); setState("uploading");
    try {
      if (file.type.startsWith("video/")) {
        setState("processing");
        const j = await detectVideo(file);
        setJobId(j.job_id);
      } else {
        setState("processing");
        const r = await detectImage(file);
        setDets(r.detections);
        setAnnUrl(`${API_BASE}${r.annotated_url}`);
        await refresh();
        setState("done");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    }
  }, [refresh]);

  const reset = useCallback(async () => {
    stopPoll(); setState("idle"); setDets([]); setAnnUrl(null);
    setJobId(null); setErrMsg("");
    await clearWeedMap();
    setGeojson(null); setSavings(null); setFieldInfo(null);
  }, [stopPoll]);

  const busy = state === "uploading" || state === "processing";

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-600"/>
          <h2 className="text-sm font-semibold text-foreground">Weed Detection & Spray Mapping</h2>
        </div>
        <div className="flex items-center gap-2">
          <SimToggle mode="weed" label="Demo Mode"/>
          {state !== "idle" && (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-3 h-3"/>New scan
            </button>
          )}
        </div>
      </div>

      {/* ── Upload zone ── */}
      {state === "idle" && (
        <label
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50 hover:border-primary/50 hover:bg-green-50/30"}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}>
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary"/>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Drop aerial footage here</p>
            <p className="text-xs text-muted-foreground mt-0.5">Image (JPG/PNG) or Video (MP4/MOV) · Drag or click</p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <span className="status-pill status-pill-green">YOLOv8s · mAP 82.1%</span>
            <span className="status-pill status-pill-blue">GPS projection</span>
            <span className="status-pill status-pill-gray">Demo mode available</span>
          </div>
          <input type="file" accept="image/*,video/*" className="hidden"
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }}/>
        </label>
      )}

      {/* ── Processing ── */}
      {busy && (
        <div className="card-base p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin"/>
          <p className="text-sm font-semibold text-foreground">
            {state === "uploading" ? "Uploading…" : "Running YOLOv8 inference…"}
          </p>
          {state === "processing" && jobId && (
            <p className="text-xs text-muted-foreground">Video processing — polling every 2s · job {jobId}</p>
          )}
          <div className="w-48 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-primary animate-shimmer" style={{ backgroundSize:"200% 100%" }}/>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {state === "error" && (
        <div className="card-base p-4 flex gap-3 border-l-4 border-l-red-500 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-red-700">Detection failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errMsg}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure <code className="bg-red-100 px-1 rounded">agrivision_best.pt</code> is in the backend folder, or demo mode will activate automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Success banner ── */}
      {state === "done" && (
        <div className="card-base p-3 flex items-center gap-3 bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600"/>
          <p className="text-xs font-semibold text-green-700">
            Detection complete · {dets.filter(d=>d.spray).length} weed zones mapped · {dets.filter(d=>!d.spray).length} crops identified
          </p>
        </div>
      )}

      {/* ── Annotated result ── */}
      {annUrl && (
        <div className="card-base overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gray-50">
            <span className="text-xs font-semibold text-foreground">Annotated Result</span>
            <span className="text-[11px] text-muted-foreground">
              {annUrl.includes(".mp4") ? "Video" : "Image"} · YOLOv8 inference
            </span>
          </div>
          {annUrl.includes(".mp4")
            ? <video src={annUrl} controls className="w-full" style={{ maxHeight:260 }}/>
            : <img src={annUrl} alt="Detection result" className="w-full object-contain" style={{ maxHeight:260 }}/>}
        </div>
      )}

      {/* ── Detections ── */}
      <DetectionList dets={dets}/>

      {/* ── Weed Map ── */}
      <WeedMap geojson={geojson} fieldInfo={fieldInfo}/>

      {/* ── Savings ── */}
      <SavingsPanel r={savings} fi={fieldInfo}/>

      {/* ── Info note ── */}
      <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
        <p>GPS coordinates are derived from drone IMU + altitude. Spray zones are exported as GeoJSON for mission planning. Set <code className="bg-blue-100 px-1 rounded">INFERENCE_MODE</code> in backend .env to switch between laptop / cloud / edge deployment.</p>
      </div>
    </div>
  );
}
