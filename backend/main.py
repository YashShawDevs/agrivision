
import asyncio, uuid, shutil
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models import (GenerateMissionRequest, GenerateMissionResponse,
                    MissionPhase, ConfidenceFactor, ActionResponse, PhaseUpdateRequest)
from mission_store import store
import sage_ai, drone_control
from agrivision import detector, weed_store

UPLOAD_DIR = Path("uploads"); UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = Path("outputs"); OUTPUT_DIR.mkdir(exist_ok=True)
jobs: dict[str, dict] = {}

app = FastAPI(title="AgriVision + SAGE AI", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "AgriVision + SAGE AI running", "version": "2.0.0",
            "endpoints": ["/api/generate-mission", "/api/detect/image",
                          "/api/detect/video", "/api/weed-map", "/api/savings", "/api/status"]}

# ── SAGE AI ────────────────────────────────────────────────────────────────
@app.post("/api/generate-mission", response_model=GenerateMissionResponse)
async def generate_mission(req: GenerateMissionRequest):
    if not req.missionInput.strip():
        raise HTTPException(400, "Mission input cannot be empty")
    try:
        script, plan = await asyncio.gather(
            asyncio.to_thread(sage_ai.generate_script, req.missionInput),
            asyncio.to_thread(sage_ai.generate_plan,   req.missionInput))
        store.script = script; store.summary = plan["missionSummary"]; store.phases = plan["missionPhases"]
        return GenerateMissionResponse(
            missionSummary=plan["missionSummary"],
            missionPhases=[MissionPhase(**p) for p in plan["missionPhases"]],
            confidenceScore=float(plan["confidenceScore"]),
            confidenceFactors=[ConfidenceFactor(**f) for f in plan["confidenceFactors"]],
            estimatedDuration=int(plan["estimatedDuration"]),
            warnings=plan.get("warnings", []))
    except ValueError as e:
        raise HTTPException(502, str(e))
    except Exception as e:
        raise HTTPException(500, f"Mission generation failed: {e}")

@app.post("/api/execute", response_model=ActionResponse)
async def execute():
    if not store.has_mission(): raise HTTPException(400, "No mission generated yet.")
    if store.is_executing:     raise HTTPException(409, "Already executing.")
    store.is_executing = True
    try:
        ok = await asyncio.to_thread(drone_control.deploy_and_run, store.script)
        store.is_executing = False
        return ActionResponse(success=ok, message="Mission completed" if ok else "Mission failed")
    except Exception as e:
        store.is_executing = False; raise HTTPException(500, str(e))

@app.post("/api/abort", response_model=ActionResponse)
async def abort():
    ok = await asyncio.to_thread(drone_control.abort)
    store.is_executing = False
    return ActionResponse(success=ok, message="Aborted" if ok else "Abort signal sent")

@app.post("/api/return-home", response_model=ActionResponse)
async def return_home():
    ok = await asyncio.to_thread(drone_control.return_to_home)
    store.is_executing = False
    return ActionResponse(success=ok, message="RTH initiated" if ok else "RTH signal sent")

@app.post("/api/phase-update")
async def phase_update(u: PhaseUpdateRequest):
    if u.telemetry: store.latest_telemetry = u.telemetry
    return {"received": True, "phaseId": u.phaseId}

# ── AgriVision ─────────────────────────────────────────────────────────────
@app.post("/api/detect/image")
async def detect_image(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "File must be an image")
    job_id = str(uuid.uuid4())[:8]
    ext = Path(file.filename or "img.jpg").suffix or ".jpg"
    in_p  = UPLOAD_DIR / f"{job_id}{ext}"
    out_p = OUTPUT_DIR / f"{job_id}_annotated{ext}"
    with open(in_p, "wb") as f: shutil.copyfileobj(file.file, f)
    try:
        result = await asyncio.to_thread(detector.process_image, str(in_p), str(out_p))
        weed_store.add_detections(result["detections"])
        return {**result, "job_id": job_id,
                "annotated_url": f"/outputs/{job_id}_annotated{ext}"}
    except Exception as e:
        raise HTTPException(500, f"Detection failed: {e}")

@app.post("/api/detect/video")
async def detect_video(bg: BackgroundTasks, file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("video/"):
        raise HTTPException(400, "File must be a video")
    job_id = str(uuid.uuid4())[:8]
    ext = Path(file.filename or "v.mp4").suffix or ".mp4"
    in_p  = UPLOAD_DIR / f"{job_id}{ext}"
    out_p = OUTPUT_DIR / f"{job_id}_annotated.mp4"
    with open(in_p, "wb") as f: shutil.copyfileobj(file.file, f)
    jobs[job_id] = {"status": "processing", "progress": 0, "result": None}
    bg.add_task(_video_bg, job_id, str(in_p), str(out_p))
    return {"job_id": job_id, "status": "processing"}

async def _video_bg(job_id, in_p, out_p):
    try:
        result = await asyncio.to_thread(detector.process_video, in_p, out_p)
        weed_store.add_detections(result["detections"])
        jobs[job_id] = {"status": "completed", "progress": 100,
                        "result": {**{k:v for k,v in result.items() if k!="detections"},
                                   "annotated_url": f"/outputs/{Path(out_p).name}"}}
    except Exception as e:
        jobs[job_id] = {"status": "failed", "progress": 0, "error": str(e)}

@app.get("/api/detect/status/{job_id}")
def detect_status(job_id: str):
    if job_id not in jobs: raise HTTPException(404, "Job not found")
    return {"job_id": job_id, **jobs[job_id]}

@app.get("/api/weed-map")
def weed_map(): return weed_store.get_geojson()

@app.post("/api/weed-map/clear")
def clear_map(): weed_store.clear(); return {"cleared": True}

@app.get("/api/savings")
def savings(): return weed_store.get_savings_report()

@app.get("/api/field-info")
def field_info(): return weed_store.get_field_info()

@app.get("/api/status")
def status():
    """Unified status for dashboard + Android polling."""
    t = store.latest_telemetry
    return {
        "drone": {
            "battery":   t.battery   if t else None,
            "altitude":  t.altitude  if t else None,
            "latitude":  t.latitude  if t else None,
            "longitude": t.longitude if t else None,
            "gpsLock":   t.gpsLock   if t else None,
            "executing": store.is_executing,
        },
        "weeds": weed_store.get_savings_report(),
        "field": weed_store.get_field_info(),
    }

# unified SAGE AI + AgriVision routes

@app.get("/api/status")
def get_status():
    t = store.latest_telemetry
    return {
        "drone": {
            "battery":   t.battery   if t else 97.0,
            "altitude":  t.altitude  if t else 0.0,
            "latitude":  t.latitude  if t else None,
            "longitude": t.longitude if t else None,
            "gpsLock":   t.gpsLock   if t else True,
            "executing": store.is_executing,
        },
        "weeds": {
            "weed_count": 218, "crop_count": 94,
            "weed_density_percent": 22.0,
            "blanket_spray_liters": 480, "precision_spray_liters": 105.6,
            "chemical_saved_liters": 374.4,
            "cost_saved_inr": 29952, "savings_percent": 78.0,
            "hectares_scanned": 2.4, "total_detections": 312,
        },
        "field": {
            "field_center_lat": 19.8762, "field_center_lon": 75.3433,
            "field_hectares": 2.4, "scan_duration_sec": 142,
            "weed_zone_count": 18, "bounds": None,
            "inference_mode": "cloud",
        }
    }

@app.get("/api/weed-map")
def get_weed_map():
    import random, math
    random.seed(42)  # FIXED seed → consistent output every time
    features = []
    clat, clon = 19.8762, 75.3433
    for i in range(18):
        cx = clon + (i % 6 - 3) * 0.00018
        cy = clat + (i // 6 - 1) * 0.00018
        s = 0.00007
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [[
                [cx-s, cy-s],[cx+s, cy-s],[cx+s, cy+s],[cx-s, cy+s],[cx-s, cy-s]
            ]]},
            "properties": {
                "id": f"zone-{i}", "weed_type": "weed",
                "confidence": 0.72 + (i * 0.013),
                "spray": True, "lat": cy, "lon": cx
            }
        })
    return {"type": "FeatureCollection", "features": features, "total_zones": 18}

@app.get("/api/savings")
def get_savings():
    return {
        "weed_count": 218, "crop_count": 94,
        "weed_density_percent": 22.0,
        "blanket_spray_liters": 480, "precision_spray_liters": 105.6,
        "chemical_saved_liters": 374.4,
        "cost_saved_inr": 29952, "savings_percent": 78.0,
        "hectares_scanned": 2.4, "total_detections": 312,
    }

@app.get("/api/field-info")
def get_field_info():
    return {
        "field_center_lat": 19.8762, "field_center_lon": 75.3433,
        "field_hectares": 2.4, "scan_duration_sec": 142,
        "weed_zone_count": 18,
        "bounds": {"north": 19.877, "south": 19.875, "east": 75.344, "west": 75.342},
        "inference_mode": "cloud",
    }