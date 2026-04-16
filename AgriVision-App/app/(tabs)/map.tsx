import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FIELD_CENTER, FIELD_LABEL } from "../../constants/field";
import { getFieldInfo, getSavings, getWeedMap } from "../../constants/api";
import type { FieldInfo, WeedSummary } from "../../constants/api";

const C = {
  paper: "#F7F3ED",
  paper2: "#F0EAE0",
  ink: "#1E1208",
  ink2: "#4A3728",
  ink3: "#8C7060",
  saffron: "#D4720A",
  saffron2: "#F0901C",
  leaf: "#3D6B35",
  leaf2: "#89A867",
  danger: "#C0392B",
  white: "#FFFFFF",
  rule: "rgba(44,24,16,0.1)",
};

const GRID_LINES = [18, 36, 54, 72, 90];

type Zone = {
  id: string;
  lat: number;
  lon: number;
  confidence: number;
  weed_type: string;
  spray: boolean;
};

type Point = {
  x: number;
  y: number;
};

type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const DEMO_ZONES: Zone[] = Array.from({ length: 18 }, (_, i) => ({
  id: `zone-${i}`,
  lat: FIELD_CENTER.lat + (Math.random() - 0.5) * 0.001,
  lon: FIELD_CENTER.lon + (Math.random() - 0.5) * 0.001,
  confidence: 0.72 + Math.random() * 0.24,
  weed_type: "weed",
  spray: true,
}));

const DEFAULT_BOUNDS: Bounds = {
  north: FIELD_CENTER.lat + 0.001,
  south: FIELD_CENTER.lat - 0.001,
  east: FIELD_CENTER.lon + 0.0012,
  west: FIELD_CENTER.lon - 0.0012,
};

function deriveBounds(
  center: { lat: number; lon: number },
  zones: Zone[],
  fieldInfo: FieldInfo | null
): Bounds {
  if (fieldInfo?.bounds) {
    return fieldInfo.bounds;
  }

  if (!zones.length) {
    return DEFAULT_BOUNDS;
  }

  const lats = zones.map((zone) => zone.lat);
  const lons = zones.map((zone) => zone.lon);
  const padLat = 0.00035;
  const padLon = 0.00035;

  return {
    north: Math.max(...lats, center.lat) + padLat,
    south: Math.min(...lats, center.lat) - padLat,
    east: Math.max(...lons, center.lon) + padLon,
    west: Math.min(...lons, center.lon) - padLon,
  };
}

function projectPoint(
  lat: number,
  lon: number,
  bounds: Bounds,
  width: number,
  height: number
): Point {
  const lonSpan = Math.max(bounds.east - bounds.west, 0.000001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.000001);

  const x = ((lon - bounds.west) / lonSpan) * width;
  const y = ((bounds.north - lat) / latSpan) * height;

  return {
    x: Math.min(Math.max(x, 0), width),
    y: Math.min(Math.max(y, 0), height),
  };
}

function ZoneCard({ zone, index }: { zone: Zone; index: number }) {
  return (
    <View style={ms.zoneCard}>
      <View style={ms.zoneDot} />
      <View style={ms.zoneInfo}>
        <Text style={ms.zoneTitle}>Weed Zone {index + 1}</Text>
        <Text style={ms.zoneCoords}>
          {zone.lat.toFixed(5)} deg N | {zone.lon.toFixed(5)} deg E
        </Text>
      </View>
      <View style={ms.zoneConf}>
        <Text style={ms.zoneConfVal}>{Math.round(zone.confidence * 100)}%</Text>
        <Text style={ms.zoneConfLabel}>conf</Text>
      </View>
      <View style={ms.sprayBadge}>
        <Text style={ms.sprayText}>SPRAY</Text>
      </View>
    </View>
  );
}

function StaticWeedMap({
  center,
  zones,
  fieldInfo,
  loading,
}: {
  center: { lat: number; lon: number };
  zones: Zone[];
  fieldInfo: FieldInfo | null;
  loading: boolean;
}) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const bounds = useMemo(
    () => deriveBounds(center, zones, fieldInfo),
    [center, fieldInfo, zones]
  );

  const markers = useMemo(() => {
    if (!mapSize.width || !mapSize.height) return [];

    return zones.map((zone) => {
      const point = projectPoint(
        zone.lat,
        zone.lon,
        bounds,
        mapSize.width,
        mapSize.height
      );

      return {
        ...zone,
        left: point.x,
        top: point.y,
      };
    });
  }, [bounds, mapSize.height, mapSize.width, zones]);

  const dronePoint = useMemo(
    () =>
      projectPoint(
        center.lat,
        center.lon,
        bounds,
        mapSize.width || 1,
        mapSize.height || 1
      ),
    [bounds, center.lat, center.lon, mapSize.height, mapSize.width]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== mapSize.width || height !== mapSize.height) {
      setMapSize({ width, height });
    }
  };

  return (
    <View style={ms.mapBox}>
      <View style={ms.mapHeader}>
        <View>
          <Text style={ms.mapTitle}>Field View</Text>
          <Text style={ms.mapSub}>{FIELD_LABEL}</Text>
        </View>
        <Text style={ms.mapCoords}>
          {center.lat.toFixed(4)} deg N | {center.lon.toFixed(4)} deg E
        </Text>
      </View>

      <View style={ms.mapCanvas} onLayout={handleLayout}>
        <View style={ms.fieldBackdrop} />
        <View style={ms.fieldBandA} />
        <View style={ms.fieldBandB} />
        <View style={ms.fieldFrame} />

        {GRID_LINES.map((offset) => (
          <View key={`h-${offset}`} style={[ms.gridLineH, { top: `${offset}%` }]} />
        ))}
        {GRID_LINES.map((offset) => (
          <View key={`v-${offset}`} style={[ms.gridLineV, { left: `${offset}%` }]} />
        ))}

        <View style={ms.northBadge}>
          <Text style={ms.northText}>N</Text>
        </View>

        {markers.map((zone, index) => (
          <View
            key={zone.id}
            style={[
              ms.zoneMarker,
              {
                left: zone.left - 9,
                top: zone.top - 9,
                opacity: Math.max(0.5, zone.confidence),
              },
            ]}
          >
            <Text style={ms.zoneMarkerText}>{index + 1}</Text>
          </View>
        ))}

        <View
          style={[
            ms.droneMarker,
            {
              left: dronePoint.x - 14,
              top: dronePoint.y - 14,
            },
          ]}
        >
          <Ionicons name="navigate" size={16} color={C.white} />
        </View>

        {loading && (
          <View style={ms.mapLoading}>
            <ActivityIndicator color={C.saffron} size="small" />
            <Text style={ms.mapLoadingText}>Loading live map...</Text>
          </View>
        )}
      </View>

      <View style={ms.mapLegend}>
        <View style={ms.legendItem}>
          <View style={[ms.legendDot, { backgroundColor: C.danger }]} />
          <Text style={ms.legendText}>Spray zone</Text>
        </View>
        <View style={ms.legendItem}>
          <View style={[ms.legendDot, { backgroundColor: C.saffron }]} />
          <Text style={ms.legendText}>Drone</Text>
        </View>
        <View style={ms.legendItem}>
          <Ionicons name="scan-outline" size={12} color={C.ink3} />
          <Text style={ms.legendText}>Field projection</Text>
        </View>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const [zones, setZones] = useState<Zone[]>(DEMO_ZONES);
  const [savings, setSavings] = useState<WeedSummary | null>(null);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [mapData, savingsData, fieldData] = await Promise.all([
          getWeedMap(),
          getSavings(),
          getFieldInfo(),
        ]);

        const mapped: Zone[] = mapData.features
          .filter((feature: any) => feature.properties.spray)
          .map((feature: any) => ({
            id: feature.properties.id,
            lat: feature.properties.lat,
            lon: feature.properties.lon,
            confidence: feature.properties.confidence,
            weed_type: feature.properties.weed_type,
            spray: true,
          }));

        setZones(mapped.length > 0 ? mapped : DEMO_ZONES);
        setSavings(savingsData);
        setFieldInfo(fieldData);
        setConnected(true);
      } catch {
        setZones(DEMO_ZONES);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const center = fieldInfo
    ? { lat: fieldInfo.field_center_lat, lon: fieldInfo.field_center_lon }
    : FIELD_CENTER;

  return (
    <SafeAreaView style={ms.safe}>
      <View style={ms.header}>
        <View>
          <Text style={ms.headerEye}>GPS SPRAY ZONES</Text>
          <Text style={ms.headerTitle}>Weed Map</Text>
        </View>
        <View style={ms.countBadge}>
          <Text style={ms.countText}>{zones.length} zones</Text>
        </View>
      </View>

      <StaticWeedMap
        center={center}
        zones={zones}
        fieldInfo={fieldInfo}
        loading={loading}
      />

      <ScrollView style={ms.list} showsVerticalScrollIndicator={false}>
        <Text style={ms.listTitle}>
          {zones.length} Weed Zones Detected
          {!connected && <Text style={ms.demoTag}> (demo data)</Text>}
        </Text>

        {zones.map((zone, index) => (
          <ZoneCard key={zone.id} zone={zone} index={index} />
        ))}

        {savings && (
          <View style={ms.savingsCard}>
            <Text style={ms.savingsTitle}>Spray Savings</Text>
            <Text style={ms.savingsBig}>
              Rs {savings.cost_saved_inr.toLocaleString("en-IN")}
            </Text>
            <Text style={ms.savingsSub}>
              {savings.savings_percent}% herbicide reduction |{" "}
              {savings.chemical_saved_liters}L saved
            </Text>
          </View>
        )}

        <View style={ms.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.ink,
    backgroundColor: C.paper,
  },
  headerEye: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.saffron,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: `${C.danger}18`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${C.danger}30`,
  },
  countText: { fontSize: 12, fontWeight: "700", color: C.danger },
  mapBox: {
    height: 300,
    backgroundColor: C.paper2,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  mapTitle: { fontSize: 18, fontWeight: "800", color: C.ink },
  mapSub: { fontSize: 12, color: C.ink3, marginTop: 2 },
  mapCoords: { fontSize: 10, fontFamily: "monospace", color: C.ink3 },
  mapCanvas: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#d7d2c8",
    borderWidth: 1,
    borderColor: C.rule,
  },
  fieldBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#d8ceb8",
  },
  fieldBandA: {
    position: "absolute",
    left: -18,
    right: -18,
    top: 34,
    height: 64,
    backgroundColor: "rgba(123, 161, 98, 0.20)",
    transform: [{ rotate: "-5deg" }],
  },
  fieldBandB: {
    position: "absolute",
    left: -14,
    right: -14,
    bottom: 28,
    height: 70,
    backgroundColor: "rgba(90, 154, 80, 0.14)",
    transform: [{ rotate: "4deg" }],
  },
  fieldFrame: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    bottom: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(61,107,53,0.35)",
    backgroundColor: "rgba(90,154,80,0.06)",
  },
  gridLineH: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(61,107,53,0.16)",
  },
  gridLineV: {
    position: "absolute",
    top: 12,
    bottom: 12,
    width: 1,
    backgroundColor: "rgba(61,107,53,0.14)",
  },
  northBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(30,18,8,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  northText: {
    color: C.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  zoneMarker: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.danger,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  zoneMarkerText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.white,
  },
  droneMarker: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.saffron,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    elevation: 4,
  },
  mapLoading: {
    position: "absolute",
    right: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(247,243,237,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.rule,
  },
  mapLoadingText: {
    fontSize: 11,
    color: C.ink2,
    fontWeight: "600",
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: C.ink3, fontWeight: "500" },
  list: { flex: 1, padding: 16 },
  listTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.ink2,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  demoTag: { color: C.saffron, fontStyle: "italic" },
  zoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.rule,
    borderLeftWidth: 3,
    borderLeftColor: C.danger,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
    marginRight: 10,
  },
  zoneInfo: { flex: 1 },
  zoneTitle: { fontSize: 13, fontWeight: "700", color: C.ink },
  zoneCoords: {
    fontSize: 10,
    fontFamily: "monospace",
    color: C.ink3,
    marginTop: 2,
  },
  zoneConf: { alignItems: "center", marginRight: 10 },
  zoneConfVal: { fontSize: 15, fontWeight: "800", color: C.ink2 },
  zoneConfLabel: {
    fontSize: 8,
    color: C.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sprayBadge: {
    backgroundColor: "#FDE8E8",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sprayText: { fontSize: 9, fontWeight: "700", color: C.danger },
  savingsCard: {
    backgroundColor: C.ink,
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
  },
  savingsTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(247,243,237,0.4)",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  savingsBig: { fontSize: 32, fontWeight: "900", color: C.saffron2 },
  savingsSub: { fontSize: 12, color: "rgba(247,243,237,0.45)", marginTop: 4 },
  bottomSpacer: { height: 24 },
});
