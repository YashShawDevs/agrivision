// app/(tabs)/index.tsx  — Dashboard Screen
import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useStatus } from "../../hooks/useStatus";

const C = {
  paper:   "#F7F3ED",
  paper2:  "#F0EAE0",
  paper3:  "#E8DFD2",
  ink:     "#1E1208",
  ink2:    "#4A3728",
  ink3:    "#8C7060",
  saffron: "#D4720A",
  saffron2:"#F0901C",
  leaf:    "#3D6B35",
  leaf2:   "#5A9A50",
  danger:  "#C0392B",
  white:   "#FFFFFF",
  rule:    "rgba(44,24,16,0.1)",
};

function MetricCard({
  label, value, unit, accent, icon, large,
}: {
  label: string; value: string; unit?: string;
  accent?: string; icon?: string; large?: boolean;
}) {
  return (
    <View style={[s.metricCard, large && s.metricLarge]}>
      {icon && (
        <Ionicons name={icon as any} size={18} color={accent || C.ink3} style={s.metricIcon} />
      )}
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, large && s.metricValueLarge, accent ? { color: accent } : {}]}>
        {value}
      </Text>
      {unit && <Text style={s.metricUnit}>{unit}</Text>}
    </View>
  );
}

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 50 ? C.leaf : pct > 25 ? C.saffron : C.danger;
  return (
    <View style={s.batteryWrap}>
      <View style={s.batteryTrack}>
        <View style={[s.batteryFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[s.batteryPct, { color }]}>{Math.round(pct)}%</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { status, connected, loading } = useStatus();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const drone = status.drone;
  const weeds = status.weeds;
  const field = status.field;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEye}>FIELD INTELLIGENCE</Text>
          <Text style={s.headerTitle}>AgriVision</Text>
        </View>
        <View style={s.connBadge}>
          <View style={[s.connDot, { backgroundColor: connected ? C.leaf : C.danger }]} />
          <Text style={[s.connText, { color: connected ? C.leaf : C.danger }]}>
            {connected ? "Live" : "Demo"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.saffron} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero savings card */}
        <LinearGradient colors={[C.ink, "#3A2010"]} style={s.heroCard}>
          <Text style={s.heroLabel}>HERBICIDE COST SAVED</Text>
          <Text style={s.heroValue}>
            ₹{weeds.cost_saved_inr.toLocaleString("en-IN")}
          </Text>
          <Text style={s.heroSub}>this field cycle · {weeds.savings_percent}% reduction</Text>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{weeds.chemical_saved_liters}L</Text>
              <Text style={s.heroStatLabel}>chemical saved</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{weeds.weed_density_percent}%</Text>
              <Text style={s.heroStatLabel}>weed coverage</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{field.weed_zone_count}</Text>
              <Text style={s.heroStatLabel}>spray zones</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Drone telemetry */}
        <Text style={s.sectionLabel}>Drone Telemetry</Text>
        <View style={s.metricGrid}>
          <View style={[s.metricCard, { flex: 1 }]}>
            <Ionicons name="battery-half" size={18} color={
              (drone.battery ?? 87) > 50 ? C.leaf : (drone.battery ?? 87) > 25 ? C.saffron : C.danger
            } style={s.metricIcon} />
            <Text style={s.metricLabel}>Battery</Text>
            <BatteryBar pct={drone.battery ?? 87} />
          </View>
          <MetricCard
            label="Altitude"
            value={(drone.altitude ?? 18.5).toFixed(1)}
            unit="metres AGL"
            accent={C.ink2}
            icon="arrow-up"
          />
        </View>
        <View style={s.metricGrid}>
          <MetricCard
            label="GPS Status"
            value={drone.gpsLock ?? true ? "Locked" : "Searching"}
            accent={drone.gpsLock ?? true ? C.leaf : C.saffron}
            icon="navigate"
          />
          <MetricCard
            label="Mission"
            value={drone.executing ? "Active" : "Standby"}
            accent={drone.executing ? C.saffron : C.ink3}
            icon="radio"
          />
        </View>
        {drone.latitude && (
          <View style={s.coordCard}>
            <Ionicons name="location" size={14} color={C.ink3} />
            <Text style={s.coordText}>
              {drone.latitude.toFixed(5)}°N · {drone.longitude?.toFixed(5)}°E
            </Text>
          </View>
        )}

        {/* Detection summary */}
        <Text style={s.sectionLabel}>Detection Summary</Text>
        <View style={s.metricGrid}>
          <MetricCard label="Weeds Found" value={String(weeds.weed_count)} accent={C.danger} icon="warning" />
          <MetricCard label="Crops Safe"  value={String(weeds.crop_count)} accent={C.leaf}   icon="leaf" />
        </View>
        <View style={s.metricGrid}>
          <MetricCard label="Field Scanned" value={String(field.field_hectares)} unit="hectares" icon="map" />
          <MetricCard label="Scan Duration" value={String(field.scan_duration_sec)} unit="seconds" icon="time" />
        </View>

        {/* Spray comparison */}
        <Text style={s.sectionLabel}>Spray Comparison</Text>
        <View style={s.compareCard}>
          <View style={s.compareRow}>
            <Text style={s.compareLabel}>Blanket spray</Text>
            <Text style={s.compareValNeutral}>{weeds.blanket_spray_liters} L</Text>
          </View>
          <View style={s.compareBar}>
            <View style={[s.compareFill, { width: "100%", backgroundColor: C.danger + "40" }]} />
          </View>
          <View style={s.compareRow}>
            <Text style={s.compareLabel}>Precision spray</Text>
            <Text style={[s.compareVal, { color: C.saffron }]}>{weeds.precision_spray_liters} L</Text>
          </View>
          <View style={s.compareBar}>
            <View style={[s.compareFill, {
              width: `${(weeds.precision_spray_liters / weeds.blanket_spray_liters) * 100}%` as any,
              backgroundColor: C.saffron,
            }]} />
          </View>
          <View style={s.compareRow}>
            <Text style={s.compareLabel}>Eliminated</Text>
            <Text style={[s.compareVal, { color: C.leaf }]}>↓ {weeds.chemical_saved_liters} L</Text>
          </View>
        </View>

        {/* Mode badge */}
        <View style={s.modeBadge}>
          <Ionicons
            name={field.inference_mode === "edge" ? "hardware-chip" : "cloud"}
            size={14}
            color={C.saffron}
          />
          <Text style={s.modeText}>
            {field.inference_mode === "edge" ? "Edge Processing Mode" : "Cloud Processing Mode"}
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.paper },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.ink, backgroundColor: C.paper },
  headerEye: { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase" },
  headerTitle:{ fontSize: 24, fontWeight: "900", color: C.ink, letterSpacing: -0.5 },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.rule },
  connDot:   { width: 7, height: 7, borderRadius: 4 },
  connText:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  scroll:    { flex: 1 },
  scrollContent:{ padding: 16, gap: 10 },

  heroCard:  { borderRadius: 12, padding: 22, marginBottom: 6 },
  heroLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: "rgba(247,243,237,0.45)", textTransform: "uppercase", marginBottom: 6 },
  heroValue: { fontSize: 38, fontWeight: "900", color: C.saffron2, letterSpacing: -1, lineHeight: 42 },
  heroSub:   { fontSize: 12, color: "rgba(247,243,237,0.45)", marginTop: 4, marginBottom: 18 },
  heroRow:   { flexDirection: "row", alignItems: "center" },
  heroStat:  { flex: 1, alignItems: "center" },
  heroStatVal:  { fontSize: 18, fontWeight: "800", color: C.paper },
  heroStatLabel:{ fontSize: 9, color: "rgba(247,243,237,0.45)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  heroDivider:  { width: 1, height: 32, backgroundColor: "rgba(247,243,237,0.1)" },

  sectionLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase", marginTop: 8, marginBottom: 6 },

  metricGrid: { flexDirection: "row", gap: 10, marginBottom: 0 },
  metricCard: { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.rule, marginBottom: 10 },
  metricLarge:{ padding: 18 },
  metricIcon: { marginBottom: 6 },
  metricLabel:{ fontSize: 9, fontWeight: "600", letterSpacing: 1, color: C.ink3, textTransform: "uppercase", marginBottom: 4 },
  metricValue:{ fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  metricValueLarge:{ fontSize: 28 },
  metricUnit: { fontSize: 10, color: C.ink3, marginTop: 2 },

  batteryWrap:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  batteryTrack: { flex: 1, height: 6, backgroundColor: C.paper3, borderRadius: 3, overflow: "hidden" },
  batteryFill:  { height: "100%", borderRadius: 3 },
  batteryPct:   { fontSize: 16, fontWeight: "800" },

  coordCard: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.paper2, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.rule },
  coordText: { fontSize: 11, fontFamily: "monospace", color: C.ink3 },

  compareCard: { backgroundColor: C.white, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: C.rule, marginBottom: 10 },
  compareRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  compareLabel:{ fontSize: 12, fontWeight: "500", color: C.ink2 },
  compareVal:  { fontSize: 16, fontWeight: "800" },
  compareValNeutral:{ fontSize: 16, fontWeight: "800", color: C.ink },
  compareBar:  { height: 6, backgroundColor: C.paper3, borderRadius: 3, overflow: "hidden", marginBottom: 12 },
  compareFill: { height: "100%", borderRadius: 3 },

  modeBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(212,114,10,0.08)", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "rgba(212,114,10,0.2)" },
  modeText:  { fontSize: 12, fontWeight: "600", color: C.saffron },
});
