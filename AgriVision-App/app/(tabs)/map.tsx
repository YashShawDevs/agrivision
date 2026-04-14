// app/(tabs)/map.tsx — Weed Map Screen
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getWeedMap, getSavings } from "../../constants/api";

const C = {
  paper: "#F7F3ED", paper2: "#F0EAE0", paper3: "#E8DFD2",
  ink: "#1E1208", ink2: "#4A3728", ink3: "#8C7060",
  saffron: "#D4720A", saffron2: "#F0901C",
  leaf: "#3D6B35", leaf2: "#5A9A50",
  danger: "#C0392B", white: "#FFFFFF",
  rule: "rgba(44,24,16,0.1)",
};

// Fake GPS zones for demo when backend offline
const DEMO_ZONES = Array.from({ length: 18 }, (_, i) => ({
  id: `zone-${i}`,
  lat: 19.0760 + (Math.random() - 0.5) * 0.001,
  lon: 72.8777 + (Math.random() - 0.5) * 0.001,
  confidence: 0.72 + Math.random() * 0.24,
  weed_type: "weed",
  spray: true,
}));

function ZoneCard({ zone, index }: { zone: any; index: number }) {
  return (
    <View style={ms.zoneCard}>
      <View style={ms.zoneDot} />
      <View style={ms.zoneInfo}>
        <Text style={ms.zoneTitle}>Weed Zone {index + 1}</Text>
        <Text style={ms.zoneCoords}>
          {zone.lat.toFixed(5)}°N · {zone.lon.toFixed(5)}°E
        </Text>
      </View>
      <View style={ms.zoneConf}>
        <Text style={ms.zoneConfVal}>{Math.round(zone.confidence * 100)}%</Text>
        <Text style={ms.zoneConfLabel}>conf</Text>
      </View>
      <View style={ms.sprayBadge}>
        <Text style={ms.sprayText}>💧 SPRAY</Text>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const [zones, setZones] = useState<any[]>(DEMO_ZONES);
  const [savings, setSavings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [mapData, savingsData] = await Promise.all([getWeedMap(), getSavings()]);
        const mapped = mapData.features
          .filter((f: any) => f.properties.spray)
          .map((f: any) => ({
            id: f.properties.id,
            lat: f.properties.lat,
            lon: f.properties.lon,
            confidence: f.properties.confidence,
            weed_type: f.properties.weed_type,
            spray: true,
          }));
        setZones(mapped.length > 0 ? mapped : DEMO_ZONES);
        setSavings(savingsData);
        setConnected(true);
      } catch {
        setZones(DEMO_ZONES);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

      {/* Map placeholder — shows OpenStreetMap URL instructions */}
      <View style={ms.mapBox}>
        <View style={ms.mapInner}>
          <Ionicons name="map" size={40} color={C.ink3} style={{ opacity: 0.3 }} />
          <Text style={ms.mapTitle}>Field View</Text>
          <Text style={ms.mapSub}>Mumbai, Maharashtra</Text>
          <Text style={ms.mapCoords}>19.0760°N · 72.8777°E</Text>

          {/* Simulated weed dots on a grid */}
          <View style={ms.dotGrid}>
            {zones.slice(0, 12).map((z, i) => (
              <View
                key={z.id}
                style={[
                  ms.fieldDot,
                  {
                    left: `${10 + (i % 4) * 22}%` as any,
                    top:  `${10 + Math.floor(i / 4) * 28}%` as any,
                    backgroundColor: C.danger,
                    opacity: z.confidence,
                  },
                ]}
              />
            ))}
            {/* Drone position */}
            <View style={ms.droneDot}>
              <Ionicons name="navigate" size={16} color={C.white} />
            </View>
          </View>

          <View style={ms.mapLegend}>
            <View style={ms.legendItem}>
              <View style={[ms.legendDot, { backgroundColor: C.danger }]} />
              <Text style={ms.legendText}>Spray ON</Text>
            </View>
            <View style={ms.legendItem}>
              <View style={[ms.legendDot, { backgroundColor: C.leaf }]} />
              <Text style={ms.legendText}>Spray OFF</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Zone list */}
      <ScrollView style={ms.list} showsVerticalScrollIndicator={false}>
        <Text style={ms.listTitle}>
          {zones.length} Weed Zones Detected
          {!connected && <Text style={ms.demoTag}> (demo data)</Text>}
        </Text>
        {zones.map((z, i) => <ZoneCard key={z.id} zone={z} index={i} />)}

        {savings && (
          <View style={ms.savingsCard}>
            <Text style={ms.savingsTitle}>Spray Savings</Text>
            <Text style={ms.savingsBig}>₹{savings.cost_saved_inr.toLocaleString("en-IN")}</Text>
            <Text style={ms.savingsSub}>{savings.savings_percent}% herbicide reduction · {savings.chemical_saved_liters}L saved</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.ink, backgroundColor: C.paper },
  headerEye:   { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: C.ink, letterSpacing: -0.5 },
  countBadge:  { backgroundColor: C.danger + "18", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.danger + "30" },
  countText:   { fontSize: 12, fontWeight: "700", color: C.danger },

  mapBox:   { height: 240, backgroundColor: C.paper2, borderBottomWidth: 1, borderBottomColor: C.rule, position: "relative" },
  mapInner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  mapTitle: { fontSize: 18, fontWeight: "800", color: C.ink, marginTop: 8 },
  mapSub:   { fontSize: 12, color: C.ink3, marginTop: 2 },
  mapCoords:{ fontSize: 10, fontFamily: "monospace", color: C.ink3, marginTop: 4, marginBottom: 8 },

  dotGrid:  { position: "absolute", inset: 0, width: "100%", height: "100%" },
  fieldDot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  droneDot: { position: "absolute", bottom: "20%", right: "25%", width: 28, height: 28, borderRadius: 14, backgroundColor: C.saffron, alignItems: "center", justifyContent: "center" },

  mapLegend: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem:{ flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText:{ fontSize: 10, color: C.ink3, fontWeight: "500" },

  list:      { flex: 1, padding: 16 },
  listTitle: { fontSize: 11, fontWeight: "700", color: C.ink2, letterSpacing: 0.5, marginBottom: 12 },
  demoTag:   { color: C.saffron, fontStyle: "italic" },

  zoneCard:  { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.rule, borderLeftWidth: 3, borderLeftColor: C.danger },
  zoneDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginRight: 10 },
  zoneInfo:  { flex: 1 },
  zoneTitle: { fontSize: 13, fontWeight: "700", color: C.ink },
  zoneCoords:{ fontSize: 10, fontFamily: "monospace", color: C.ink3, marginTop: 2 },
  zoneConf:  { alignItems: "center", marginRight: 10 },
  zoneConfVal:  { fontSize: 15, fontWeight: "800", color: C.ink2 },
  zoneConfLabel:{ fontSize: 8, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  sprayBadge:{ backgroundColor: "#FDE8E8", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  sprayText: { fontSize: 9, fontWeight: "700", color: C.danger },

  savingsCard: { backgroundColor: C.ink, borderRadius: 12, padding: 20, marginTop: 12 },
  savingsTitle:{ fontSize: 10, fontWeight: "700", letterSpacing: 2, color: "rgba(247,243,237,0.4)", textTransform: "uppercase", marginBottom: 6 },
  savingsBig:  { fontSize: 32, fontWeight: "900", color: C.saffron2 },
  savingsSub:  { fontSize: 12, color: "rgba(247,243,237,0.45)", marginTop: 4 },
});
