// hooks/useStatus.ts
import { useState, useEffect, useRef } from "react";
import { getStatus, SystemStatus } from "../constants/api";

const POLL_INTERVAL = 2000; // 2 seconds

// Simulated demo data when backend is unreachable
const DEMO_STATUS: SystemStatus = {
  drone: {
    battery: 87,
    altitude: 18.5,
    latitude: 19.8762,
    longitude: 75.3433,
    gpsLock: true,
    executing: false,
  },
  weeds: {
    weed_count: 218,
    crop_count: 94,
    weed_density_percent: 22.0,
    blanket_spray_liters: 480,
    precision_spray_liters: 105.6,
    chemical_saved_liters: 374.4,
    cost_saved_inr: 29952,
    savings_percent: 78.0,
    hectares_scanned: 2.4,
    total_detections: 312,
  },
  field: {
    field_center_lat: 19.8762,
    field_center_lon: 75.3433,
    field_hectares: 2.4,
    scan_duration_sec: 142,
    weed_zone_count: 18,
    bounds: { north: 19.877, south: 19.875, east: 75.344, west: 75.342 },
    inference_mode: "cloud",
  },
};

export function useStatus() {
  const [status, setStatus] = useState<SystemStatus>(DEMO_STATUS);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      setConnected(true);
    } catch {
      setConnected(false);
      // Keep showing demo data when offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { status, connected, loading };
}
