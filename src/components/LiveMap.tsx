import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import droneMarkerImg from "@/assets/drone-marker.png";
import type { AppState } from "@/hooks/useMissionState";
import { FIELD_CENTER, buildFallbackWeedWaypoints } from "@/lib/field";

const MAP_ZOOM = 17;
const HOME: [number, number] = FIELD_CENTER;

// ── Fallback waypoints (same seed as useMissionState) ─────────────────────────
// Matches FALLBACK_WEED_WAYPOINTS exactly — no random values.
const FALLBACK_WEED_WAYPOINTS = buildFallbackWeedWaypoints();

// Full route: HOME → each weed zone → HOME
function buildRoute(waypoints: [number, number][]): [number, number][] {
  return [HOME, ...waypoints, HOME];
}

interface LiveMapProps {
  appState?: AppState;
  /** From useMissionState — same coordinates used for phases */
  weedWaypoints?: [number, number][];
  /** When true: show weed markers + spray icons */
  isSprayMode?: boolean;
}

export function LiveMap({
  appState = "idle",
  weedWaypoints = FALLBACK_WEED_WAYPOINTS,
  isSprayMode = false,
}: LiveMapProps) {
  const [coords, setCoords] = useState<[number, number]>(HOME);
  const [activeSprayIdx, setActiveSprayIdx] = useState<number | null>(null);

  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<L.Map | null>(null);
  const markerRef       = useRef<L.Marker | null>(null);
  const homeMarkerRef   = useRef<L.Marker | null>(null);
  const trailRef        = useRef<L.Polyline | null>(null);
  const plannedPathRef  = useRef<L.Polyline | null>(null);
  const weedMarkersRef  = useRef<L.CircleMarker[]>([]);
  const sprayMarkersRef = useRef<L.CircleMarker[]>([]);
  const animFrameRef    = useRef<number | null>(null);
  const waypointIndexRef = useRef(0);
  const progressRef      = useRef(0);

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: HOME,
      zoom: MAP_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    const droneIcon = L.icon({
      iconUrl: droneMarkerImg,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker(HOME, { icon: droneIcon }).addTo(map);
    markerRef.current = marker;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // ── Execution animation ───────────────────────────────────────────────────
  useEffect(() => {
    const map    = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (appState === "executing") {
      const route = buildRoute(weedWaypoints); // HOME → zones → HOME

      // Home marker
      const homeIcon = L.divIcon({
        html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:hsl(210,100%,55%);border:2px solid hsl(210,100%,75%);border-radius:50%;box-shadow:0 0 12px rgba(55,150,255,0.5);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
      });
      homeMarkerRef.current = L.marker(HOME, {
        icon: homeIcon,
        interactive: false,
      }).addTo(map);

      // Planned route (dashed)
      plannedPathRef.current = L.polyline(route, {
        color: "hsl(210, 100%, 60%)",
        weight: 1.5,
        opacity: 0.3,
        dashArray: "6, 8",
      }).addTo(map);

      // Trail (solid, drawn as drone moves)
      trailRef.current = L.polyline([], {
        color: "hsl(210, 100%, 55%)",
        weight: 3,
        opacity: 0.8,
      }).addTo(map);

      // Weed zone markers — red circles (spray OFF initially)
      if (isSprayMode) {
        weedMarkersRef.current = weedWaypoints.map((wp, i) => {
          const c = L.circleMarker(wp, {
            radius: 10,
            color: "#ff4444",
            fillColor: "#ff4444",
            fillOpacity: 0.25,
            weight: 2,
          })
            .bindTooltip(`Zone ${i + 1} — Weed area`, { permanent: false })
            .addTo(map);
          return c;
        });
      }

      // Centre map on route
      try { map.fitBounds(L.latLngBounds(route), { padding: [32, 32], maxZoom: 18 }); } catch {}

      waypointIndexRef.current = 0;
      progressRef.current      = 0;
      const trailCoords: [number, number][] = [route[0]];

      // Speed: 0.006 per frame → ~167 frames per segment at 60fps ≈ 2.8s/segment
      const SPEED = 0.006;

      const animate = () => {
        const idx = waypointIndexRef.current;
        if (idx >= route.length - 1) return;

        progressRef.current += SPEED;

        if (progressRef.current >= 1) {
          progressRef.current = 0;
          waypointIndexRef.current += 1;
          const newIdx = waypointIndexRef.current;

          // Check if we just arrived at a weed zone (index 1 to weedWaypoints.length)
          if (isSprayMode && newIdx >= 1 && newIdx <= weedWaypoints.length) {
            const zoneIdx = newIdx - 1;
            setActiveSprayIdx(zoneIdx);

            // Turn this zone marker green (sprayed)
            const weedMarker = weedMarkersRef.current[zoneIdx];
            if (weedMarker) {
              weedMarker.setStyle({ color: "#44ff88", fillColor: "#44ff88", fillOpacity: 0.4 });
              weedMarker.setTooltipContent(`Zone ${zoneIdx + 1} — ✅ Sprayed`);
            }

            // Spray circle burst effect — expands then fades
            const burst = L.circleMarker(weedWaypoints[zoneIdx], {
              radius: 6, color: "#44ff88", fillColor: "#44ff88",
              fillOpacity: 0.8, weight: 2,
            }).addTo(map);
            sprayMarkersRef.current.push(burst);
            setTimeout(() => { burst.setStyle({ radius: 18, fillOpacity: 0.1, weight: 1 }); }, 50);
            setTimeout(() => { burst.remove(); }, 800);
          } else {
            setActiveSprayIdx(null);
          }

          if (waypointIndexRef.current >= route.length - 1) {
            marker.setLatLng(route[route.length - 1]);
            return;
          }
        }

        const from = route[waypointIndexRef.current];
        const to   = route[waypointIndexRef.current + 1];
        const t    = progressRef.current;

        const lat = from[0] + (to[0] - from[0]) * t;
        const lng = from[1] + (to[1] - from[1]) * t;

        marker.setLatLng([lat, lng]);
        setCoords([lat, lng]);
        trailCoords.push([lat, lng]);
        trailRef.current?.setLatLngs(trailCoords);

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }

    // ── Reset on idle ─────────────────────────────────────────────────────
    if (appState === "idle") {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      homeMarkerRef.current?.remove();  homeMarkerRef.current = null;
      trailRef.current?.remove();       trailRef.current = null;
      plannedPathRef.current?.remove(); plannedPathRef.current = null;
      weedMarkersRef.current.forEach((m) => m.remove());
      weedMarkersRef.current = [];
      sprayMarkersRef.current.forEach((m) => m.remove());
      sprayMarkersRef.current = [];
      marker.setLatLng(HOME);
      map.setView(HOME, MAP_ZOOM);
      waypointIndexRef.current = 0;
      progressRef.current      = 0;
      setActiveSprayIdx(null);
    } else if (appState === "completed" || appState === "aborted") {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setActiveSprayIdx(null);
    }
  }, [appState, weedWaypoints, isSprayMode]);

  // ── Spray status label ─────────────────────────────────────────────────────
  const sprayLabel =
    activeSprayIdx !== null
      ? `💧 Spraying Zone ${activeSprayIdx + 1}`
      : appState === "executing"
      ? "🚁 In Flight"
      : null;

  return (
    // IMPORTANT: position:relative + overflow:visible so the coordinate HUD
    // renders above the Leaflet map stacking context instead of being clipped.
    <div className="glass-card-glow relative group h-full" style={{ overflow: "visible" }}>
      {/* Map tile — overflow hidden only on the map div itself */}
      <div
        ref={mapRef}
        className="w-full h-full min-h-[200px] rounded-lg overflow-hidden"
        style={{ background: "hsl(var(--muted) / 0.3)" }}
      />

      {/* ── Flight status HUD — sits ABOVE the map via z-index + absolute on parent ── */}
      {appState === "executing" && (
        <div
          className="absolute bottom-3 left-3 glass-card px-3 py-1.5 flex items-center gap-3 text-xs font-mono"
          style={{ zIndex: 9999 }}   // explicit inline ensures it beats Leaflet's z-index
        >
          {sprayLabel && (
            <span
              className="text-success font-semibold mr-1 animate-pulse"
              style={{ color: activeSprayIdx !== null ? "hsl(var(--success))" : "hsl(var(--warning))" }}
            >
              {sprayLabel}
            </span>
          )}
          <span className="text-muted-foreground">LAT</span>
          <span className="text-foreground font-semibold">{coords[0].toFixed(6)}</span>
          <span className="text-muted-foreground">LNG</span>
          <span className="text-foreground font-semibold">{coords[1].toFixed(6)}</span>
        </div>
      )}

      <button
        className="absolute top-3 right-3 w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
        style={{ zIndex: 9999 }}
      >
        <Maximize2 className="w-4 h-4 text-foreground" />
      </button>
    </div>
  );
}
