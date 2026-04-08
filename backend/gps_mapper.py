import math

def pixel_to_gps(px, py, img_width, img_height, center_gps, altitude, fov=84):
    """
    Convert pixel coordinates to GPS lat/lon
    
    Simplified projection assuming:
    - Nadir (straight down) camera view
    - Flat earth approximation for small areas
    - DJI Mavic 3 camera specs (84° FOV)
    """
    center_lat, center_lon = center_gps
    
    # Ground Sample Distance (GSD) in meters per pixel
    fov_rad = math.radians(fov)
    ground_width = 2 * altitude * math.tan(fov_rad / 2)
    meters_per_pixel = ground_width / img_width
    
    # Pixel offset from center
    dx_pixels = px - img_width / 2
    dy_pixels = (img_height / 2) - py  # Y inverted (screen vs geo coords)
    
    # Convert to meters
    dx_meters = dx_pixels * meters_per_pixel
    dy_meters = dy_pixels * meters_per_pixel
    
    # Convert meters to degrees
    # 1 degree latitude ≈ 111,320 meters
    # 1 degree longitude ≈ 111,320 * cos(latitude) meters
    lat_offset = dy_meters / 111320
    lon_offset = dx_meters / (111320 * math.cos(math.radians(center_lat)))
    
    return (center_lat + lat_offset, center_lon + lon_offset)

def create_geojson_feature(gps_polygon, weed_type, confidence):
    """Create a GeoJSON feature for a weed detection"""
    
    # Close polygon if needed
    if gps_polygon[0] != gps_polygon[-1]:
        gps_polygon.append(gps_polygon[0])
    
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [gps_polygon]
        },
        "properties": {
            "weed_type": weed_type,
            "confidence": round(confidence, 2),
            "spray_needed": True,
            "color": "#FF4444"  # Red for weed zones
        }
    }