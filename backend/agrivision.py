"""
agrivision.py — YOLOv8 detector + GPS store
============================================
Three deployment modes (set INFERENCE_MODE in .env):
  laptop  — YOLOv8s runs on this machine (default)
  cloud   — POST frames to cloud endpoint (future)
  edge    — lightweight model on RPi via HTTP (future)
"""
import os, math, uuid, time
from pathlib import Path
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────────
FIELD_CENTER_LAT   = float(os.getenv("FIELD_LAT",    "19.0760"))
FIELD_CENTER_LON   = float(os.getenv("FIELD_LON",    "72.8777"))
DRONE_ALTITUDE_M   = float(os.getenv("DRONE_ALT",    "20"))
CAMERA_FOV_DEG     = float(os.getenv("CAMERA_FOV",   "84"))
FIELD_HECTARES     = float(os.getenv("FIELD_HA",     "2.4"))
BLANKET_L_PER_HA   = float(os.getenv("BLANKET_RATE", "200"))
COST_PER_L_INR     = float(os.getenv("HERBICIDE_COST","80"))
INFERENCE_MODE     = os.getenv("INFERENCE_MODE", "laptop")   # laptop|cloud|edge
MODEL_PATH         = os.getenv("YOLO_MODEL_PATH", "agrivision_best.pt")
CLOUD_DETECT_URL   = os.getenv("CLOUD_DETECT_URL", "")       # future
EDGE_DETECT_URL    = os.getenv("EDGE_DETECT_URL",  "")       # future RPi endpoint
SAMPLE_EVERY       = int(os.getenv("VIDEO_SAMPLE_EVERY", "10"))

# ── GPS helpers ────────────────────────────────────────────────────────────
def pixel_to_gps(px, py, iw, ih, clat, clon, alt=DRONE_ALTITUDE_M, fov=CAMERA_FOV_DEG):
    gw  = 2 * alt * math.tan(math.radians(fov) / 2)
    mpp = gw / iw
    lat = clat + ((ih / 2 - py) * mpp) / 111320
    lon = clon + ((px - iw / 2) * mpp) / (111320 * math.cos(math.radians(clat)))
    return round(lat, 7), round(lon, 7)

def bbox_polygon(x1, y1, x2, y2, iw, ih, clat, clon):
    pts = [(x1,y1),(x2,y1),(x2,y2),(x1,y2),(x1,y1)]
    coords = []
    for px, py in pts:
        lat, lon = pixel_to_gps(px, py, iw, ih, clat, clon)
        coords.append([lon, lat])
    return coords

# ── Detector ───────────────────────────────────────────────────────────────
class WeedDetector:
    def __init__(self):
        self._model = None
        self._mode  = INFERENCE_MODE

    def _load(self):
        if self._model is not None:
            return
        if self._mode != "laptop":
            print(f"[AgriVision] Mode={self._mode} — skipping local model load")
            return
        try:
            from ultralytics import YOLO
            print(f"[AgriVision] Loading {MODEL_PATH} ...")
            self._model = YOLO(MODEL_PATH)
            print(f"[AgriVision] Model ready ✓  classes={self._model.names}")
        except Exception as e:
            print(f"[AgriVision] Model load failed ({e}) — demo mode active")

    def process_image(self, in_path: str, out_path: str) -> dict:
        self._load()
        if self._model is None:
            return self._demo_image(in_path, out_path)
        results = self._model.predict(source=in_path, save=False, conf=0.30, verbose=False)
        r = results[0]
        import cv2; cv2.imwrite(out_path, r.plot())
        return self._parse_boxes(r, FIELD_CENTER_LAT, FIELD_CENTER_LON)

    def process_video(self, in_path: str, out_path: str) -> dict:
        self._load()
        if self._model is None:
            return self._demo_video()
        import cv2
        cap   = cv2.VideoCapture(in_path)
        fps   = cap.get(cv2.CAP_PROP_FPS) or 25
        w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        out   = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
        all_det, weed_c, crop_c, fi = [], 0, 0, 0
        print(f"[AgriVision] Video: {total} frames  sample_every={SAMPLE_EVERY}")
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            if fi % SAMPLE_EVERY == 0:
                results = self._model.predict(source=frame, conf=0.30, verbose=False)
                out.write(results[0].plot())
                # Simulate GPS drift along field
                prog = fi / max(total, 1)
                flat = FIELD_CENTER_LAT + prog * 0.001
                flon = FIELD_CENTER_LON + prog * 0.001
                parsed = self._parse_boxes(results[0], flat, flon)
                for d in parsed["detections"]: d["frame"] = fi
                all_det.extend(parsed["detections"])
                weed_c += parsed["weed_count"]; crop_c += parsed["crop_count"]
            else:
                out.write(frame)
            fi += 1
        cap.release(); out.release()
        print(f"[AgriVision] Done — weeds={weed_c} crops={crop_c}")
        return {"detections": all_det, "weed_count": weed_c, "crop_count": crop_c, "total_frames": total}

    def _parse_boxes(self, result, clat, clon) -> dict:
        dets, wc, cc = [], 0, 0
        if result.boxes is None:
            return {"detections": dets, "weed_count": wc, "crop_count": cc}
        ih, iw = result.orig_shape[:2]
        for i in range(len(result.boxes)):
            cls  = int(result.boxes.cls[i].item())
            conf = float(result.boxes.conf[i].item())
            x1,y1,x2,y2 = result.boxes.xyxy[i].tolist()
            name = self._model.names[cls]
            is_w = name.lower() == "weed"
            cx, cy = (x1+x2)/2, (y1+y2)/2
            lat, lon = pixel_to_gps(cx, cy, iw, ih, clat, clon)
            dets.append({"id": str(uuid.uuid4())[:8], "class": name,
                         "conf": round(conf,3), "bbox": [round(v,1) for v in [x1,y1,x2,y2]],
                         "lat": lat, "lon": lon,
                         "polygon": bbox_polygon(x1,y1,x2,y2,iw,ih,clat,clon),
                         "spray": is_w})
            if is_w: wc += 1
            else: cc += 1
        return {"detections": dets, "weed_count": wc, "crop_count": cc}

    def _demo_image(self, in_path, out_path):
        import shutil; shutil.copy(in_path, out_path)
        dets = [
            {"id":"d01","class":"weed","conf":0.87,"bbox":[110,70,200,160],
             "lat":FIELD_CENTER_LAT+0.00008,"lon":FIELD_CENTER_LON+0.00010,
             "polygon":bbox_polygon(110,70,200,160,640,640,FIELD_CENTER_LAT,FIELD_CENTER_LON),"spray":True},
            {"id":"d02","class":"weed","conf":0.74,"bbox":[295,195,385,285],
             "lat":FIELD_CENTER_LAT-0.00005,"lon":FIELD_CENTER_LON+0.00015,
             "polygon":bbox_polygon(295,195,385,285,640,640,FIELD_CENTER_LAT,FIELD_CENTER_LON),"spray":True},
            {"id":"d03","class":"crop","conf":0.92,"bbox":[445,95,540,185],
             "lat":FIELD_CENTER_LAT+0.00012,"lon":FIELD_CENTER_LON-0.00008,
             "polygon":bbox_polygon(445,95,540,185,640,640,FIELD_CENTER_LAT,FIELD_CENTER_LON),"spray":False},
            {"id":"d04","class":"weed","conf":0.81,"bbox":[50,320,140,400],
             "lat":FIELD_CENTER_LAT-0.00010,"lon":FIELD_CENTER_LON-0.00012,
             "polygon":bbox_polygon(50,320,140,400,640,640,FIELD_CENTER_LAT,FIELD_CENTER_LON),"spray":True},
            {"id":"d05","class":"crop","conf":0.88,"bbox":[520,280,600,360],
             "lat":FIELD_CENTER_LAT+0.00005,"lon":FIELD_CENTER_LON+0.00020,
             "polygon":bbox_polygon(520,280,600,360,640,640,FIELD_CENTER_LAT,FIELD_CENTER_LON),"spray":False},
        ]
        return {"detections": dets, "weed_count": 3, "crop_count": 2}

    def _demo_video(self):
        return {"detections": [], "weed_count": 45, "crop_count": 87, "total_frames": 300}

# ── Weed Store ─────────────────────────────────────────────────────────────
class WeedStore:
    def __init__(self):
        self._detections: list[dict] = []
        self._start_time: Optional[float] = None

    def add_detections(self, dets: list[dict]):
        if not self._start_time and dets:
            self._start_time = time.time()
        self._detections.extend(dets)

    def clear(self):
        self._detections.clear()
        self._start_time = None

    def get_geojson(self) -> dict:
        features = []
        for d in self._detections:
            if not d.get("spray"): continue
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [d["polygon"]]},
                "properties": {
                    "id": d["id"], "weed_type": d.get("class","weed"),
                    "confidence": d.get("conf",0), "spray": True,
                    "lat": d.get("lat"), "lon": d.get("lon"),
                    "frame": d.get("frame"),
                }
            })
        return {"type": "FeatureCollection", "features": features,
                "total_zones": len(features)}

    def get_savings_report(self) -> dict:
        total = len(self._detections)
        weeds = sum(1 for d in self._detections if d.get("spray"))
        crops = total - weeds
        density = min(weeds / max(total,1), 0.40) if total > 0 else 0.22
        blanket  = FIELD_HECTARES * BLANKET_L_PER_HA
        precise  = density * blanket
        saved_l  = blanket - precise
        saved_inr = saved_l * COST_PER_L_INR
        pct = round((saved_l / blanket) * 100, 1) if blanket > 0 else 0
        return {
            "hectares_scanned":       FIELD_HECTARES,
            "total_detections":       total,
            "weed_count":             weeds,
            "crop_count":             crops,
            "weed_density_percent":   round(density * 100, 1),
            "blanket_spray_liters":   round(blanket, 1),
            "precision_spray_liters": round(precise, 1),
            "chemical_saved_liters":  round(saved_l, 1),
            "cost_saved_inr":         round(saved_inr),
            "savings_percent":        pct,
        }

    def get_field_info(self) -> dict:
        elapsed = round(time.time() - self._start_time, 1) if self._start_time else 0
        weed_zones = [d for d in self._detections if d.get("spray")]
        lats = [d["lat"] for d in weed_zones if d.get("lat")]
        lons = [d["lon"] for d in weed_zones if d.get("lon")]
        bounds = None
        if lats and lons:
            bounds = {"north": max(lats), "south": min(lats),
                      "east":  max(lons), "west":  min(lons)}
        return {
            "field_center_lat":   FIELD_CENTER_LAT,
            "field_center_lon":   FIELD_CENTER_LON,
            "field_hectares":     FIELD_HECTARES,
            "scan_duration_sec":  elapsed,
            "weed_zone_count":    len(weed_zones),
            "bounds":             bounds,
            "inference_mode":     INFERENCE_MODE,
        }

detector   = WeedDetector()
weed_store = WeedStore()
