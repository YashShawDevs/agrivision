"""
main.py — SAGE AI + AgriVision unified backend
===============================================
SAGE AI routes:
  POST /api/generate-mission
  POST /api/execute
  POST /api/abort
  POST /api/return-home
  POST /api/phase-update

AgriVision routes:
  POST /api/detect/image
  POST /api/detect/video
  GET  /api/detect/status/{job_id}
  GET  /api/weed-map
  POST /api/weed-map/clear
  GET  /api/savings
  GET  /api/field-info
  GET  /api/status           ← Android polling

Simulation mode:
  GET  /api/sim-mode
  POST /api/sim-mode/mission?enabled=true|false
  POST /api/sim-mode/weed?enabled=true|false
"""

import asyncio, uuid, shutil
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models import (
    GenerateMissionRequest, GenerateMissionResponse,
    MissionPhase, ConfidenceFactor, ActionResponse, PhaseUpdateRequest,
)
from mission_store import store
from sim_store import sim
import sage_ai
import drone_control
from agrivision import detector, weed_store

UPLOAD_DIR = Path("uploads"); UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = Path("outputs"); OUTPUT_DIR.mkdir(exist_ok=True)
jobs: dict[str, dict] = {}

app = FastAPI(title="SAGE AI + AgriVision", version="2.0.0")

# CORS — allow all origins so mobile on same WiFi works without config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "SAGE AI + AgriVision running",
        "version": "2.0.0",
        "sim_mode": {"mission": sim.mission_sim, "weed_demo": sim.weed_demo},
    }


# ── Simulation mode toggles ───────────────────────────────────────────────────
@app.get("/api/sim-mode")
def get_sim_mode():
    return {"mission_sim": sim.mission_sim, "weed_demo": sim.weed_demo}

@app.post("/api/sim-mode/mission")
def set_mission_sim(enabled: bool):
    sim.set_mission_sim(enabled)
    print(f"[SIM] Mission simulation: {'ON' if enabled else 'OFF'}")
    return {"mission_sim": sim.mission_sim, "weed_demo": sim.weed_demo}

@app.post("/api/sim-mode/weed")
def set_weed_demo(enabled: bool):
    sim.set_weed_demo(enabled)
    print(f"[SIM] Weed demo mode: {'ON' if enabled else 'OFF'}")
    return {"mission_sim": sim.mission_sim, "weed_demo": sim.weed_demo}


# ── SAGE AI ───────────────────────────────────────────────────────────────────
@app.post("/api/generate-mission", response_model=GenerateMissionResponse)
async def api_generate_mission(request: GenerateMissionRequest):
    if not request.missionInput.strip():
        raise HTTPException(400, "Mission input cannot be empty")
    try:
        print(f"\n[API] /generate-mission — '{request.missionInput}'")
        script_task = asyncio.to_thread(sage_ai.generate_script, request.missionInput)
        plan_task   = asyncio.to_thread(sage_ai.generate_plan,   request.missionInput)
        script, plan = await asyncio.gather(script_task, plan_task)
        store.script  = script
        store.summary = plan["missionSummary"]
        store.phases  = plan["missionPhases"]
        print(f"[API] Mission stored. Phases: {len(store.phases)}")
        return GenerateMissionResponse(
            missionSummary    = plan["missionSummary"],
            missionPhases     = [MissionPhase(**p) for p in plan["missionPhases"]],
            confidenceScore   = float(plan["confidenceScore"]),
            confidenceFactors = [ConfidenceFactor(**f) for f in plan["confidenceFactors"]],
            estimatedDuration = int(plan["estimatedDuration"]),
            warnings          = plan.get("warnings", []),
        )
    except ValueError as e:
        raise HTTPException(502, str(e))
    except Exception as e:
        print(f"[API] generate-mission error: {e}")
        raise HTTPException(500, f"Mission generation failed: {e}")


@app.post("/api/execute", response_model=ActionResponse)
async def api_execute():
    if not store.has_mission():
        raise HTTPException(400, "No mission generated yet. Call /api/generate-mission first.")
    if store.is_executing:
        raise HTTPException(409, "A mission is already executing.")

    print(f"\n[API] /execute — sim_mode={sim.mission_sim}")
    store.is_executing = True
    try:
        success = await asyncio.to_thread(drone_control.deploy_and_run, store.script)
        store.is_executing = False
        if success:
            return ActionResponse(success=True, message="Mission completed successfully")
        else:
            return ActionResponse(success=False, message="Mission script failed on drone")
    except Exception as e:
        store.is_executing = False
        raise HTTPException(500, f"Execution error: {e}")


@app.post("/api/abort", response_model=ActionResponse)
async def api_abort():
    print("\n[API] /abort")
    try:
        success = await asyncio.to_thread(drone_control.abort)
        store.is_executing = False
        if success:
            return ActionResponse(success=True, message="Mission aborted")
        else:
            return ActionResponse(success=False, message="Abort signal sent")
    except Exception as e:
        raise HTTPException(500, f"Abort failed: {e}")


@app.post("/api/return-home", response_model=ActionResponse)
async def api_return_home():
    print("\n[API] /return-home")
    try:
        success = await asyncio.to_thread(drone_control.return_to_home)
        store.is_executing = False
        if success:
            return ActionResponse(success=True, message="Return to home initiated")
        else:
            return ActionResponse(success=False, message="RTH signal sent")
    except Exception as e:
        raise HTTPException(500, f"RTH failed: {e}")


@app.post("/api/phase-update")
async def api_phase_update(update: PhaseUpdateRequest):
    print(f"[DRONE] Phase {update.phaseId} '{update.phaseName}' → {update.phaseStatus}", end="")
    if update.telemetry:
        t = update.telemetry
        print(f" | bat={t.battery}% alt={t.altitude}m gps={t.gpsLock}")
        store.latest_telemetry = update.telemetry
    else:
        print()
    return {"received": True, "phaseId": update.phaseId}


# ── AgriVision ────────────────────────────────────────────────────────────────
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
        jobs[job_id] = {
            "status": "completed", "progress": 100,
            "result": {**{k:v for k,v in result.items() if k != "detections"},
                       "annotated_url": f"/outputs/{Path(out_p).name}"},
        }
    except Exception as e:
        jobs[job_id] = {"status": "failed", "progress": 0, "error": str(e)}


@app.get("/api/detect/status/{job_id}")
def detect_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return {"job_id": job_id, **jobs[job_id]}


@app.get("/api/weed-map")
def weed_map():
    return weed_store.get_geojson()


@app.post("/api/weed-map/clear")
def clear_map():
    weed_store.clear()
    return {"cleared": True}


@app.get("/api/savings")
def savings():
    return weed_store.get_savings_report()


@app.get("/api/field-info")
def field_info():
    return weed_store.get_field_info()


@app.get("/api/status")
def status():
    """Unified telemetry + weed summary — polled by Android app."""
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
