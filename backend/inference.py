import cv2
import numpy as np
from ultralytics import YOLO
from pathlib import Path
import json
from gps_mapper import pixel_to_gps, create_geojson_feature

# Download model on first run
MODEL_PATH = "models/yolov8n-seg.pt"

def load_model():
    """Load YOLOv8 segmentation model"""
    Path("models").mkdir(exist_ok=True)
    
    try:
        model = YOLO(MODEL_PATH)
    except:
        print("Downloading YOLOv8n-seg model...")
        model = YOLO('yolov8n-seg.pt')
        model.save(MODEL_PATH)
    
    return model

def process_video(video_path, output_dir, job_id, fps_sample=5):
    """
    Process video with YOLOv8 and generate annotated output
    
    Args:
        video_path: Input video file
        output_dir: Where to save annotated video
        job_id: Unique job identifier
        fps_sample: Process every Nth frame (5 = process at 1/5 speed)
    
    Returns:
        (output_video_path, geojson_features)
    """
    
    model = load_model()
    cap = cv2.VideoCapture(video_path)
    
    # Video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Output video
    output_path = f"{output_dir}/{job_id}_annotated.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Synthetic GPS starting point (center of field)
    base_lat, base_lon = 19.0760, 72.8777  # Example: Mumbai region
    altitude = 20  # meters
    
    spray_zones = []
    frame_idx = 0
    
    print(f"Processing video: {total_frames} frames at {fps} FPS")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Process every Nth frame for speed
        if frame_idx % fps_sample == 0:
            
            # Run inference
            results = model(frame, conf=0.5, verbose=False)
            
            # Draw results on frame
            annotated_frame = results[0].plot()
            
            # Extract detections
            if results[0].masks is not None:
                masks = results[0].masks.data.cpu().numpy()
                boxes = results[0].boxes.data.cpu().numpy()
                
                for i, (mask, box) in enumerate(zip(masks, boxes)):
                    x1, y1, x2, y2, conf, cls = box
                    
                    # Only process high-confidence weeds
                    if conf < 0.6:
                        continue
                    
                    # Convert mask to polygon
                    mask_resized = cv2.resize(mask, (width, height))
                    contours, _ = cv2.findContours(
                        (mask_resized > 0.5).astype(np.uint8),
                        cv2.RETR_EXTERNAL,
                        cv2.CHAIN_APPROX_SIMPLE
                    )
                    
                    if len(contours) == 0:
                        continue
                    
                    # Get largest contour
                    contour = max(contours, key=cv2.contourArea)
                    
                    # Simulate GPS position (move slightly per frame)
                    frame_offset_lat = (frame_idx / total_frames) * 0.001
                    frame_offset_lon = (frame_idx / total_frames) * 0.001
                    frame_center = (base_lat + frame_offset_lat, base_lon + frame_offset_lon)
                    
                    # Convert polygon to GPS coordinates
                    gps_polygon = []
                    for point in contour:
                        px, py = point[0]
                        lat, lon = pixel_to_gps(
                            px, py, width, height,
                            frame_center, altitude
                        )
                        gps_polygon.append([lon, lat])
                    
                    # Create GeoJSON feature
                    if len(gps_polygon) > 2:
                        feature = create_geojson_feature(
                            gps_polygon,
                            weed_type=f"Weed_Class_{int(cls)}",
                            confidence=float(conf)
                        )
                        spray_zones.append(feature)
            
            out.write(annotated_frame)
        else:
            # Write original frame if not processing
            out.write(frame)
        
        frame_idx += 1
        
        if frame_idx % 30 == 0:
            print(f"Processed {frame_idx}/{total_frames} frames")
    
    cap.release()
    out.release()
    
    print(f"✓ Annotated video saved: {output_path}")
    print(f"✓ Detected {len(spray_zones)} weed zones")
    
    # Build GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": spray_zones
    }
    
    return output_path, geojson