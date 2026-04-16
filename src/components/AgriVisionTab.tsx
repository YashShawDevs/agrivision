import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Leaf, DollarSign, MapPin, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Clock, BarChart3, Sprout, FlaskConical, Info,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  detectImage, detectVideo, pollJob, getWeedMap, clearWeedMap,
  getSavings, getFieldInfo, toApiUrl,
  type Detection, type SavingsReport, type FieldInfo, type WeedMapGeoJSON,
} from "@/lib/api";
import { SimToggle } from "@/components/SimToggle";
import { FIELD_CENTER } from "@/lib/field";

function fmtDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

// ── GPS Weed Map ────────────────────────────────────────────────────────────
function WeedMap({ geojson, fieldInfo }: { geojson: WeedMapGeoJSON | null; fieldInfo: FieldInfo | null }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: fieldInfo
        ? [fieldInfo.field_center_lat, fieldInfo.field_center_lon]
        : FIELD_CENTER,
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    layRef.current?.remove();
    layRef.current = null;
    if (!geojson.features.length) return;

    const layer = L.geoJSON(geojson as never, {
      style: () => ({ color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.35 }),
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(
          `<div style="font-size:12px;line-height:1.8;min-width:150px">
            <b style="color:#ef4444">🌿 ${p.weed_type}</b><br/>
            Confidence: <b>${(p.confidence * 100).toFixed(0)}%</b><br/>
            Spray: <b style="color:#ef4444">YES</b><br/>
            <span style="color:#888;font-size:11px">${p.lat?.toFixed(5)}°, ${p.lon?.toFixed(5)}°</span>
          </div>`,
          { maxWidth: 220 }
        );
      },
    }).addTo(map);
    layRef.current = layer;
    try { map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 19 }); } catch {}
  }, [geojson]);

  const zoneCount = geojson?.total_zones ?? 0;

  return (
    <div className="glass-card overflow-hidden" style={{ height: 340 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] bg-muted/20">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">GPS Spray Zones</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {fieldInfo ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                {zoneCount} zone{zoneCount !== 1 ? "s" : ""}
              </span>
              <span>{fieldInfo.field_hectares} ha</span>
              {fieldInfo.scan_duration_sec > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDuration(fieldInfo.scan_duration_sec)}
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded-full bg-muted/60 border border-border/50 text-[10px]">
                {fieldInfo.inference_mode}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/50 italic">upload to populate</span>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={divRef} className="w-full" style={{ height: 296 }} />

      {/* Empty state overlay */}
      {(!geojson || !zoneCount) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none"
          style={{ top: 40 }}>
          <MapPin className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/40">Spray zones appear after detection</p>
        </div>
      )}
    </div>
  );
}

// ── Detection List ───────────────────────────────────────────────────────────
function DetectionList({ dets }: { dets: Detection[] }) {
  if (!dets.length) return null;
  const weeds = dets.filter(d => d.spray);
  const crops  = dets.filter(d => !d.spray);
  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Detections</h3>
        <div className="flex gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-destructive/15 border border-destructive/30 text-[11px] text-destructive font-medium">
            {weeds.length} weeds
          </span>
          <span className="px-2 py-0.5 rounded-full bg-success/15 border border-success/30 text-[11px] text-success font-medium">
            {crops.length} crops
          </span>
        </div>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
        {dets.slice(0, 30).map(d => (
          <div key={d.id}
            className="flex items-center justify-between py-1 px-2 rounded-lg bg-muted/30 border border-border/40 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.spray ? "bg-destructive" : "bg-success"}`} />
              <span className="font-medium capitalize text-foreground">{d.class}</span>
              <span className="text-muted-foreground">{(d.conf * 100).toFixed(0)}%</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {d.lat.toFixed(5)}, {d.lon.toFixed(5)}
            </span>
          </div>
        ))}
        {dets.length > 30 && (
          <p className="text-[11px] text-muted-foreground text-center py-1">+{dets.length - 30} more</p>
        )}
      </div>
    </div>
  );
}

// ── Savings Panel ────────────────────────────────────────────────────────────
function SavingsPanel({ r, fi }: { r: SavingsReport | null; fi: FieldInfo | null }) {
  if (!r || !r.total_detections) return null;
  return (
    <div className="glass-card-glow p-4 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-success" />
        <h3 className="text-sm font-semibold text-foreground">Impact Analysis</h3>
        {fi?.scan_duration_sec ? (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />Scan: {fmtDuration(fi.scan_duration_sec)}
          </span>
        ) : null}
      </div>

      {/* 4 metric tiles */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { icon: Sprout,      label: "Hectares",       value: `${r.hectares_scanned} ha`,              sub: "field scanned",           hi: false },
          { icon: BarChart3,   label: "Weed Density",   value: `${r.weed_density_percent}%`,            sub: "of field area",           hi: false },
          { icon: FlaskConical,label: "Chemical Saved", value: `${r.chemical_saved_liters} L`,          sub: `vs ${r.blanket_spray_liters}L blanket`, hi: true },
          { icon: DollarSign,  label: "Cost Saved",     value: `₹${r.cost_saved_inr.toLocaleString()}`, sub: "per mission",             hi: true },
        ] as const).map(({ icon: Icon, label, value, sub, hi }) => (
          <div key={label}
            className={`rounded-lg p-3 flex flex-col gap-1 border ${
              hi
                ? "bg-success/[0.08] border-success/20"
                : "bg-muted/30 border-border/50"
            }`}>
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${hi ? "text-success" : "text-primary"}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
            </div>
            <span className={`text-xl font-bold tabular-nums ${hi ? "text-success" : "text-foreground"}`}>{value}</span>
            <span className="text-[11px] text-muted-foreground">{sub}</span>
          </div>
        ))}
      </div>

      {/* Savings bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Herbicide reduction vs blanket spray</span>
          <span className="font-semibold text-success">{r.savings_percent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-all duration-1000"
            style={{ width: `${Math.min(r.savings_percent, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {r.precision_spray_liters}L targeted · {r.blanket_spray_liters}L blanket ·
          <span className="text-success font-medium"> {r.chemical_saved_liters}L saved</span>
        </p>
      </div>

      {/* Detection summary */}
      <div className="flex gap-3 text-xs pt-1 border-t border-white/[0.06]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          Weeds: <b className="text-foreground">{r.weed_count}</b>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success" />
          Crops: <b className="text-foreground">{r.crop_count}</b>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
          Total: <b className="text-foreground">{r.total_detections}</b>
        </span>
      </div>
    </div>
  );
}

// ── Main AgriVisionTab ───────────────────────────────────────────────────────
type UpState = "idle" | "uploading" | "processing" | "done" | "error";

export function AgriVisionTab() {
  const [state, setState]         = useState<UpState>("idle");
  const [errMsg, setErrMsg]       = useState("");
  const [dets, setDets]           = useState<Detection[]>([]);
  const [annUrl, setAnnUrl]       = useState<string | null>(null);
  const [geojson, setGeojson]     = useState<WeedMapGeoJSON | null>(null);
  const [savings, setSavings]     = useState<SavingsReport | null>(null);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo | null>(null);
  const [jobId, setJobId]         = useState<string | null>(null);
  const [drag, setDrag]           = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const refresh = useCallback(async () => {
    const [g, sv, fi] = await Promise.all([getWeedMap(), getSavings(), getFieldInfo()]);
    setGeojson(g); setSavings(sv); setFieldInfo(fi);
  }, []);

  // Poll video job
  useEffect(() => {
    if (!jobId) return;
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const s = await pollJob(jobId);
        if (s.status === "completed" && s.result) {
          stopPoll();
          setAnnUrl(toApiUrl(s.result.annotated_url));
          await refresh();
          setState("done");
        } else if (s.status === "failed") {
          stopPoll();
          setErrMsg(s.error || "Video processing failed");
          setState("error");
        }
      } catch { /* network blip — keep polling */ }
    }, 2000);
    return stopPoll;
  }, [jobId, stopPoll, refresh]);

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
        setAnnUrl(toApiUrl(r.annotated_url));
        await refresh();
        setState("done");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    }
  }, [refresh]);

  const reset = useCallback(async () => {
    stopPoll();
    setState("idle"); setDets([]); setAnnUrl(null);
    setJobId(null); setErrMsg("");
    try { await clearWeedMap(); } catch {}
    setGeojson(null); setSavings(null); setFieldInfo(null);
  }, [stopPoll]);

  const busy = state === "uploading" || state === "processing";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">Weed Detection & Spray Mapping</h2>
        </div>
        <div className="flex items-center gap-2">
          <SimToggle mode="weed" label="Demo Mode" />
          {state !== "idle" && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground
                hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />New scan
            </button>
          )}
        </div>
      </div>

      {/* Upload zone */}
      {state === "idle" && (
        <label
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl
            border-2 border-dashed cursor-pointer transition-all duration-200
            ${drag
              ? "border-primary/60 bg-primary/[0.05]"
              : "border-border/40 bg-muted/20 hover:border-primary/30 hover:bg-muted/30"
            }`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20
            flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Drop aerial footage here</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Image (JPG/PNG) or Video (MP4/MOV) · Drag or click to browse
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success">
              YOLOv8s · mAP 82.1%
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
              GPS projection
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-muted-foreground">
              Demo mode available
            </span>
          </div>
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      )}

      {/* Processing state */}
      {busy && (
        <div className="glass-card p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-foreground">
            {state === "uploading" ? "Uploading…" : "Running YOLOv8 inference…"}
          </p>
          {state === "processing" && jobId && (
            <p className="text-xs text-muted-foreground">
              Video processing — polling every 2s · job {jobId}
            </p>
          )}
          <div className="w-48 h-1 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full w-1/3 rounded-full animate-shimmer" />
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="glass-card p-4 flex gap-3 glow-border-danger">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Detection failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">{errMsg}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              No model file? Enable <b>Demo Mode</b> above to use sample detections.
            </p>
          </div>
        </div>
      )}

      {/* Success banner */}
      {state === "done" && (
        <div className="glass-card p-3 flex items-center gap-3 glow-border-success animate-fade-up">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <p className="text-xs font-semibold text-success">
            Detection complete · {dets.filter(d => d.spray).length} weed zones mapped ·{" "}
            {dets.filter(d => !d.spray).length} crops identified
          </p>
        </div>
      )}

      {/* Annotated result */}
      {annUrl && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] bg-muted/20">
            <span className="text-xs font-semibold text-foreground">Annotated Result</span>
            <span className="text-[11px] text-muted-foreground">
              {annUrl.includes(".mp4") ? "Video" : "Image"} · YOLOv8 inference
            </span>
          </div>
          {annUrl.includes(".mp4") ? (
            <video src={annUrl} controls className="w-full" style={{ maxHeight: 280 }} />
          ) : (
            <img src={annUrl} alt="Detection result" className="w-full object-contain"
              style={{ maxHeight: 280 }} />
          )}
        </div>
      )}

      {/* Detection list */}
      <DetectionList dets={dets} />

      {/* GPS Weed Map */}
      <WeedMap geojson={geojson} fieldInfo={fieldInfo} />

      {/* Savings panel */}
      <SavingsPanel r={savings} fi={fieldInfo} />

      {/* Info footer */}
      <div className="glass-card p-3 flex gap-2">
        <Info className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          GPS coordinates are projected from pixel bounding boxes using camera altitude (20m) and
          field of view (84°). Set{" "}
          <code className="bg-muted/60 px-1 rounded text-primary/80">INFERENCE_MODE</code> in{" "}
          <code className="bg-muted/60 px-1 rounded text-primary/80">backend/.env</code> to switch
          between <b>laptop</b> / <b>cloud</b> / <b>edge</b> deployment.
        </p>
      </div>
    </div>
  );
}
