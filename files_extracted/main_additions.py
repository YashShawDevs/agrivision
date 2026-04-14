"""
ADDITIONS TO backend/main.py
────────────────────────────
Paste these routes at the bottom of main.py, before the final line.
They expose the weed/spray data that the frontend and Android app need.

The weed zone data uses a fixed seed so coordinates are IDENTICAL on every
call — same data on laptop UI and Android app, no randomness in demo.
"""

# ── Add this import at the TOP of main.py ──────────────────────────────────
# from models import TelemetrySnapshot   ← already imported via PhaseUpdateRequest
# No new imports needed.

# ── Paste everything below this line into main.py ──────────────────────────

# Fixed weed zone coordinates — same as frontend FALLBACK_WEED_WAYPOINTS
# Both share the same arithmetic so coordinates are identical across systems.
_FIELD_CENTER_LAT = 19.8762
_FIELD_CENTER_LON = 75.3433
_WEED_ZONES = [
    {
        "id":         f"zone-{i}",
        "lat":        _FIELD_CENTER_LAT + ((i // 3) - 0.5) * 0.00054,
        "lon":        _FIELD_CENTER_LON + ((i %  3) - 1.0) * 0.00054,
        "confidence": round(0.72 + i * 0.013, 2),
        "weed_type":  "weed",
        "spray":      True,
    }
    for i in range(6)
]


@app.get("/api/weed-map")
def get_weed_map():
    """
    Returns GeoJSON FeatureCollection of weed spray zones.
    Fixed coordinates (no randomness) → identical output every request.
    """
    features = []
    for z in _WEED_ZONES:
        if not z["spray"]:
            continue
        lat, lon = z["lat"], z["lon"]
        s = 0.00020   # half-side of zone polygon in degrees
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon - s, lat - s],
                    [lon + s, lat - s],
                    [lon + s, lat + s],
                    [lon - s, lat + s],
                    [lon - s, lat - s],
                ]],
            },
            "properties": {
                "id":         z["id"],
                "weed_type":  z["weed_type"],
                "confidence": z["confidence"],
                "spray":      z["spray"],
                "lat":        lat,
                "lon":        lon,
            },
        })
    return {"type": "FeatureCollection", "features": features, "total_zones": len(features)}


@app.get("/api/savings")
def get_savings():
    """Chemical savings report — fixed demo values, consistent across UI + Android."""
    return {
        "weed_count":              218,
        "crop_count":              94,
        "weed_density_percent":    22.0,
        "blanket_spray_liters":    480.0,
        "precision_spray_liters":  105.6,
        "chemical_saved_liters":   374.4,
        "cost_saved_inr":          29952,
        "savings_percent":         78.0,
        "hectares_scanned":        2.4,
        "total_detections":        312,
    }


@app.get("/api/field-info")
def get_field_info():
    """Field metadata — used by Android weed map screen."""
    return {
        "field_center_lat": _FIELD_CENTER_LAT,
        "field_center_lon": _FIELD_CENTER_LON,
        "field_hectares":   2.4,
        "scan_duration_sec": 142,
        "weed_zone_count":  len(_WEED_ZONES),
        "bounds": {
            "north": _FIELD_CENTER_LAT + 0.002,
            "south": _FIELD_CENTER_LAT - 0.002,
            "east":  _FIELD_CENTER_LON + 0.002,
            "west":  _FIELD_CENTER_LON - 0.002,
        },
        "inference_mode": "cloud",
    }


@app.get("/api/status")
def get_status():
    """
    Unified status endpoint — polled every 2s by the Android app dashboard.
    Uses store.latest_telemetry if a phase-update has arrived; otherwise
    returns safe default values so the app shows connected telemetry.
    """
    t = getattr(store, "latest_telemetry", None)
    return {
        "drone": {
            "battery":   t.battery   if t and t.battery   is not None else 95.0,
            "altitude":  t.altitude  if t and t.altitude  is not None else 0.0,
            "latitude":  t.latitude  if t and t.latitude  is not None else _FIELD_CENTER_LAT,
            "longitude": t.longitude if t and t.longitude is not None else _FIELD_CENTER_LON,
            "gpsLock":   t.gpsLock   if t and t.gpsLock   is not None else True,
            "executing": store.is_executing,
        },
        "weeds": {
            "weed_count":             218,
            "crop_count":             94,
            "weed_density_percent":   22.0,
            "blanket_spray_liters":   480.0,
            "precision_spray_liters": 105.6,
            "chemical_saved_liters":  374.4,
            "cost_saved_inr":         29952,
            "savings_percent":        78.0,
            "hectares_scanned":       2.4,
            "total_detections":       312,
        },
        "field": {
            "field_center_lat": _FIELD_CENTER_LAT,
            "field_center_lon": _FIELD_CENTER_LON,
            "field_hectares":   2.4,
            "scan_duration_sec": 142,
            "weed_zone_count":  len(_WEED_ZONES),
            "bounds":           None,
            "inference_mode":   "cloud",
        },
    }
