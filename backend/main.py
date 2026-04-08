from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid
from pathlib import Path
import json

from inference import process_video
from spray_simulator import generate_spray_grid, calculate_savings
from utils import cleanup_old_files

app = FastAPI(title="AgriVision API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
VIDEO_OUT = OUTPUT_DIR / "videos"
GEOJSON_OUT = OUTPUT_DIR / "geojson"
HEATMAP_OUT = OUTPUT_DIR / "heatmaps"

for d in [UPLOAD_DIR, VIDEO_OUT, GEOJSON_OUT, HEATMAP_OUT]:
    d.mkdir(parents=True, exist_ok=True)

# In-memory job storage
jobs = {}

@app.get("/")
def root():
    return {"status": "AgriVision API Running", "version": "1.0"}

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload video and start processing"""
    
    # Validate file type
    if not file.filename.endswith(('.mp4', '.avi', '.mov')):
        raise HTTPException(400, "Only video files allowed")
    
    # Generate job ID
    job_id = str(uuid.uuid4())[:8]
    
    # Save uploaded file
    video_path = UPLOAD_DIR / f"{job_id}_{file.filename}"
    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    jobs[job_id] = {"status": "uploaded", "video_path": str(video_path)}
    
    return {"job_id": job_id, "status": "uploaded"}

@app.post("/process/{job_id}")
def process(job_id: str):
    """Run inference and generate outputs"""
    
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    
    try:
        jobs[job_id]["status"] = "processing"
        
        video_path = jobs[job_id]["video_path"]
        
        # Step 1: Run YOLOv8 inference
        annotated_video, spray_zones = process_video(
            video_path, 
            output_dir=str(VIDEO_OUT),
            job_id=job_id
        )
        
        # Step 2: Save GeoJSON
        geojson_path = GEOJSON_OUT / f"{job_id}_zones.geojson"
        with open(geojson_path, 'w') as f:
            json.dump(spray_zones, f, indent=2)
        
        # Step 3: Generate spray grid heatmap
        heatmap_path = generate_spray_grid(
            spray_zones, 
            output_path=str(HEATMAP_OUT / f"{job_id}_heatmap.png")
        )
        
        # Step 4: Calculate savings
        metrics = calculate_savings(spray_zones)
        
        jobs[job_id].update({
            "status": "completed",
            "annotated_video": annotated_video,
            "geojson": str(geojson_path),
            "heatmap": heatmap_path,
            "metrics": metrics
        })
        
        return {"job_id": job_id, "status": "completed"}
    
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        raise HTTPException(500, f"Processing failed: {str(e)}")

@app.get("/results/{job_id}")
def get_results(job_id: str):
    """Get processing results"""
    
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    
    job = jobs[job_id]
    
    if job["status"] != "completed":
        return {"job_id": job_id, "status": job["status"]}
    
    return {
        "job_id": job_id,
        "status": "completed",
        "metrics": job["metrics"],
        "files": {
            "video": f"/download/video/{job_id}",
            "geojson": f"/download/geojson/{job_id}",
            "heatmap": f"/download/heatmap/{job_id}"
        }
    }

@app.get("/download/video/{job_id}")
def download_video(job_id: str):
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(404, "Video not found")
    return FileResponse(jobs[job_id]["annotated_video"])

@app.get("/download/geojson/{job_id}")
def download_geojson(job_id: str):
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(404, "GeoJSON not found")
    return FileResponse(jobs[job_id]["geojson"])

@app.get("/download/heatmap/{job_id}")
def download_heatmap(job_id: str):
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(404, "Heatmap not found")
    return FileResponse(jobs[job_id]["heatmap"])

@app.get("/demo")
def get_demo_results():
    """Return pre-computed demo results"""
    demo_metrics = {
        "hectares_scanned": 0.8,
        "weed_density_percent": 22,
        "chemical_saved_liters": 124,
        "cost_saved_rupees": 9920,
        "savings_percent": 78
    }
    
    return {
        "status": "demo",
        "metrics": demo_metrics,
        "files": {
            "video": "/static/demo_annotated.mp4",
            "geojson": "/static/demo_zones.geojson",
            "heatmap": "/static/demo_heatmap.png"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)