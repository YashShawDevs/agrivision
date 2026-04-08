import os
import time
from pathlib import Path

def cleanup_old_files(directory, max_age_hours=24):
    """Remove files older than max_age_hours"""
    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    
    for filepath in Path(directory).rglob('*'):
        if filepath.is_file():
            if filepath.stat().st_mtime < cutoff:
                filepath.unlink()
                print(f"Deleted old file: {filepath}")