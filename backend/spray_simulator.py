import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Polygon, Point
import json

def generate_spray_grid(geojson_data, grid_size=100, output_path="heatmap.png"):
    """
    Generate spray actuation grid heatmap
    
    Args:
        geojson_data: GeoJSON FeatureCollection with weed polygons
        grid_size: Grid resolution (100x100 cells)
        output_path: Where to save heatmap image
    
    Returns:
        Path to saved heatmap
    """
    
    features = geojson_data.get("features", [])
    
    if len(features) == 0:
        # No weeds detected - create empty grid
        grid = np.zeros((grid_size, grid_size))
    else:
        # Get bounding box of all detections
        all_coords = []
        for feature in features:
            coords = feature["geometry"]["coordinates"][0]
            all_coords.extend(coords)
        
        lons = [c[0] for c in all_coords]
        lats = [c[1] for c in all_coords]
        
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
        
        # Add 10% padding
        lon_range = max_lon - min_lon
        lat_range = max_lat - min_lat
        min_lon -= lon_range * 0.1
        max_lon += lon_range * 0.1
        min_lat -= lat_range * 0.1
        max_lat += lat_range * 0.1
        
        # Create grid
        grid = np.zeros((grid_size, grid_size))
        
        # Map polygons to grid cells
        for feature in features:
            coords = feature["geometry"]["coordinates"][0]
            poly = Polygon(coords)
            
            for i in range(grid_size):
                for j in range(grid_size):
                    # Grid cell center in GPS coords
                    cell_lon = min_lon + (j + 0.5) * (max_lon - min_lon) / grid_size
                    cell_lat = min_lat + (i + 0.5) * (max_lat - min_lat) / grid_size
                    
                    point = Point(cell_lon, cell_lat)
                    
                    if poly.contains(point):
                        grid[i, j] = 1  # Spray ON
    
    # Generate heatmap visualization
    plt.figure(figsize=(10, 10))
    plt.imshow(grid, cmap='RdYlGn_r', interpolation='nearest', origin='lower')
    plt.colorbar(label='Spray Actuation (0=OFF, 1=ON)', shrink=0.8)
    plt.title('Precision Spray Actuation Grid', fontsize=16, fontweight='bold')
    plt.xlabel('Grid X (West → East)', fontsize=12)
    plt.ylabel('Grid Y (South → North)', fontsize=12)
    
    # Add statistics
    total_cells = grid_size * grid_size
    spray_cells = np.sum(grid)
    coverage_pct = (spray_cells / total_cells) * 100
    
    plt.text(
        0.02, 0.98, 
        f'Coverage: {coverage_pct:.1f}%\nSpray Cells: {int(spray_cells)}/{total_cells}',
        transform=plt.gca().transAxes,
        fontsize=11,
        verticalalignment='top',
        bbox=dict(boxstyle='round', facecolor='white', alpha=0.8)
    )
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"✓ Spray grid saved: {output_path}")
    print(f"  Coverage: {coverage_pct:.1f}% | Spray cells: {int(spray_cells)}/{total_cells}")
    
    return output_path

def calculate_savings(geojson_data, field_hectares=1.0):
    """
    Calculate chemical and cost savings
    
    Constants based on Indian agriculture:
    - Blanket spray: 200 L/hectare
    - Herbicide cost: ₹80/L
    """
    
    BLANKET_SPRAY_RATE = 200  # L/ha
    COST_PER_LITER = 80       # ₹/L
    
    features = geojson_data.get("features", [])
    
    # Calculate total weed area
    total_weed_area = 0
    for feature in features:
        coords = feature["geometry"]["coordinates"][0]
        poly = Polygon(coords)
        # Area in square degrees, approximate conversion
        area_sq_deg = poly.area
        # Rough conversion: 1 sq degree ≈ 12,400 km² at equator
        # For small areas, use simpler approximation
        area_hectares = area_sq_deg * 12400 * 100  # Very rough
        total_weed_area += area_hectares
    
    # More realistic: assume detected weeds cover X% of field
    # Use number of detections as proxy
    weed_density = min(len(features) * 2, 40) / 100  # Cap at 40%
    
    # Chemical usage
    blanket_chemical = field_hectares * BLANKET_SPRAY_RATE
    precision_chemical = weed_density * blanket_chemical
    
    savings_liters = blanket_chemical - precision_chemical
    savings_rupees = savings_liters * COST_PER_LITER
    savings_percent = (savings_liters / blanket_chemical) * 100
    
    return {
        "hectares_scanned": round(field_hectares, 2),
        "weed_density_percent": round(weed_density * 100, 1),
        "detections_count": len(features),
        "chemical_saved_liters": round(savings_liters, 1),
        "cost_saved_rupees": round(savings_rupees, 0),
        "savings_percent": round(savings_percent, 1),
        "blanket_spray_liters": blanket_chemical,
        "precision_spray_liters": round(precision_chemical, 1)
    }