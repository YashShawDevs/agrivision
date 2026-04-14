// app/(tabs)/control.tsx — Drone Control Screen
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { abortMission, returnHome, executeMission } from "../../constants/api";
import { useStatus } from "../../hooks/useStatus";

const C = {
  paper: "#F7F3ED", paper2: "#F0EAE0", paper3: "#E8DFD2",
  ink: "#1E1208", ink2: "#4A3728", ink3: "#8C7060",
  saffron: "#D4720A", saffron2: "#F0901C",
  leaf: "#3D6B35", danger: "#C0392B", white: "#FFFFFF",
  rule: "rgba(44,24,16,0.1)",
};

type ProcessingMode = "cloud" | "edge";

function DPad({ onPress }: { onPress: (dir: string) => void }) {
  return (
    <View style={ctrl.dpad}>
      <TouchableOpacity style={[ctrl.dpadBtn, ctrl.dpadTop]} onPress={() => onPress("forward")}>
        <Ionicons name="arrow-up" size={24} color={C.ink} />
        <Text style={ctrl.dpadLabel}>FWD</Text>
      </TouchableOpacity>
      <View style={ctrl.dpadMiddleRow}>
        <TouchableOpacity style={[ctrl.dpadBtn, ctrl.dpadSide]} onPress={() => onPress("left")}>
          <Ionicons name="arrow-back" size={24} color={C.ink} />
          <Text style={ctrl.dpadLabel}>LEFT</Text>
        </TouchableOpacity>
        <View style={ctrl.dpadCenter}>
          <Ionicons name="radio-button-on" size={20} color={C.ink3} />
        </View>
        <TouchableOpacity style={[ctrl.dpadBtn, ctrl.dpadSide]} onPress={() => onPress("right")}>
          <Ionicons name="arrow-forward" size={24} color={C.ink} />
          <Text style={ctrl.dpadLabel}>RIGHT</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[ctrl.dpadBtn, ctrl.dpadBottom]} onPress={() => onPress("backward")}>
        <Ionicons name="arrow-down" size={24} color={C.ink} />
        <Text style={ctrl.dpadLabel}>BACK</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ControlScreen() {
  const { status, connected } = useStatus();
  const [mode, setMode] = useState<ProcessingMode>("cloud");
  const [lastCmd, setLastCmd] = useState<string>("—");
  const [cmdLog, setCmdLog] = useState<string[]>([
    "[SYS] Control interface ready",
    "[SYS] RPi connection: standby",
  ]);

  const addLog = (msg: string) => {
    const t = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setCmdLog((prev) => [`[${t}] ${msg}`, ...prev.slice(0, 9)]);
  };

  const handleDPad = async (dir: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLastCmd(dir.toUpperCase());
    addLog(`Move: ${dir}`);
    // This would call your drone movement API
    // For demo: just log it
    // await api(`/api/move`, { method: "POST", body: JSON.stringify({ direction: dir, distance: 1 }) })
  };

  const handleAbort = () => {
    Alert.alert(
      "Abort Mission?",
      "This will immediately stop all motors. The drone will attempt emergency landing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CONFIRM ABORT",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await abortMission();
              addLog("ABORT sent — drone landing");
            } catch {
              addLog("ABORT signal sent (demo)");
            }
          },
        },
      ]
    );
  };

  const handleRTH = () => {
    Alert.alert(
      "Return to Home?",
      "The drone will abandon the current mission and return to the launch point.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm RTH",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await returnHome();
              addLog("RTH initiated");
            } catch {
              addLog("RTH signal sent (demo)");
            }
          },
        },
      ]
    );
  };

  const drone = status.drone;

  return (
    <SafeAreaView style={ctrl.safe}>
      <View style={ctrl.header}>
        <View>
          <Text style={ctrl.headerEye}>DRONE CONTROL</Text>
          <Text style={ctrl.headerTitle}>Command</Text>
        </View>
        <View style={[ctrl.connBadge, { borderColor: connected ? C.leaf + "40" : C.danger + "40" }]}>
          <View style={[ctrl.connDot, { backgroundColor: connected ? C.leaf : C.danger }]} />
          <Text style={[ctrl.connText, { color: connected ? C.leaf : C.danger }]}>
            {connected ? "RPi Connected" : "Demo Mode"}
          </Text>
        </View>
      </View>

      <ScrollView style={ctrl.scroll} showsVerticalScrollIndicator={false}>

        {/* Telemetry strip */}
        <View style={ctrl.telemStrip}>
          <View style={ctrl.telemCell}>
            <Text style={ctrl.telemVal}>{Math.round(drone.battery ?? 87)}%</Text>
            <Text style={ctrl.telemLabel}>Battery</Text>
          </View>
          <View style={ctrl.telemDivider} />
          <View style={ctrl.telemCell}>
            <Text style={ctrl.telemVal}>{(drone.altitude ?? 0).toFixed(1)}m</Text>
            <Text style={ctrl.telemLabel}>Altitude</Text>
          </View>
          <View style={ctrl.telemDivider} />
          <View style={ctrl.telemCell}>
            <Text style={[ctrl.telemVal, { color: drone.gpsLock ?? true ? C.leaf : C.saffron }]}>
              {drone.gpsLock ?? true ? "LOCK" : "SRCH"}
            </Text>
            <Text style={ctrl.telemLabel}>GPS</Text>
          </View>
          <View style={ctrl.telemDivider} />
          <View style={ctrl.telemCell}>
            <Text style={[ctrl.telemVal, { color: drone.executing ? C.saffron : C.ink3 }]}>
              {drone.executing ? "EXEC" : "IDLE"}
            </Text>
            <Text style={ctrl.telemLabel}>Status</Text>
          </View>
        </View>

        {/* Processing mode toggle */}
        <View style={ctrl.modeCard}>
          <Text style={ctrl.modeTitle}>Processing Mode</Text>
          <View style={ctrl.modeRow}>
            <TouchableOpacity
              style={[ctrl.modeBtn, mode === "cloud" && ctrl.modeBtnActive]}
              onPress={() => setMode("cloud")}
            >
              <Ionicons name="cloud" size={18} color={mode === "cloud" ? C.white : C.ink3} />
              <View>
                <Text style={[ctrl.modeBtnLabel, mode === "cloud" && { color: C.white }]}>Cloud</Text>
                <Text style={[ctrl.modeBtnSub, mode === "cloud" && { color: "rgba(247,243,237,0.6)" }]}>
                  High accuracy · YOLOv8s
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ctrl.modeBtn, mode === "edge" && ctrl.modeBtnEdge]}
              onPress={() => setMode("edge")}
            >
              <Ionicons name="hardware-chip" size={18} color={mode === "edge" ? C.white : C.ink3} />
              <View>
                <Text style={[ctrl.modeBtnLabel, mode === "edge" && { color: C.white }]}>Edge</Text>
                <Text style={[ctrl.modeBtnSub, mode === "edge" && { color: "rgba(247,243,237,0.6)" }]}>
                  Realtime · RPi onboard
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={ctrl.modeCurrent}>
            {mode === "cloud"
              ? "Video recorded → uploaded → processed on laptop → spray map sent to drone"
              : "Camera feed → onboard model → spray signal fires in ~500ms"}
          </Text>
        </View>

        {/* D-Pad */}
        <View style={ctrl.section}>
          <Text style={ctrl.sectionLabel}>Manual Control</Text>
          <DPad onPress={handleDPad} />
          <Text style={ctrl.lastCmd}>Last command: <Text style={{ color: C.saffron }}>{lastCmd}</Text></Text>
        </View>

        {/* Emergency controls */}
        <View style={ctrl.section}>
          <Text style={ctrl.sectionLabel}>Emergency Controls</Text>
          <TouchableOpacity style={ctrl.abortBtn} onPress={handleAbort}>
            <LinearGradient colors={[C.danger, "#9B1A0F"]} style={ctrl.abortGrad}>
              <Ionicons name="warning" size={22} color={C.white} />
              <Text style={ctrl.abortText}>ABORT MISSION</Text>
              <Text style={ctrl.abortSub}>Emergency land in place</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={ctrl.rthBtn} onPress={handleRTH}>
            <Ionicons name="home" size={18} color={C.saffron} />
            <Text style={ctrl.rthText}>Return to Home</Text>
          </TouchableOpacity>
        </View>

        {/* Command log */}
        <View style={ctrl.section}>
          <Text style={ctrl.sectionLabel}>Command Log</Text>
          <View style={ctrl.logBox}>
            {cmdLog.map((line, i) => (
              <Text key={i} style={[ctrl.logLine, i === 0 && { color: C.saffron }]}>{line}</Text>
            ))}
          </View>
        </View>

        {/* Spray proof of concept */}
        <View style={ctrl.sprayCard}>
          <View style={ctrl.sprayHeader}>
            <Ionicons name="water" size={18} color={C.leaf} />
            <Text style={ctrl.sprayTitle}>Spray System</Text>
            <Text style={ctrl.sprayBadge}>Proof of Concept</Text>
          </View>
          <Text style={ctrl.sprayDesc}>
            2-servo gimbal spray unit. Trigger fires the nozzle for 500ms at each weed GPS coordinate.
          </Text>
          <TouchableOpacity style={ctrl.sprayBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            addLog("Manual spray triggered (demo)");
          }}>
            <Ionicons name="water" size={16} color={C.white} />
            <Text style={ctrl.sprayBtnText}>Test Spray Trigger</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ctrl = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.ink, backgroundColor: C.paper },
  headerEye:  { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase" },
  headerTitle:{ fontSize: 24, fontWeight: "900", color: C.ink, letterSpacing: -0.5 },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  connDot:   { width: 7, height: 7, borderRadius: 4 },
  connText:  { fontSize: 11, fontWeight: "700" },
  scroll:    { flex: 1 },

  telemStrip: { flexDirection: "row", backgroundColor: C.ink, paddingVertical: 14 },
  telemCell:  { flex: 1, alignItems: "center" },
  telemVal:   { fontSize: 18, fontWeight: "900", color: C.paper, letterSpacing: -0.5 },
  telemLabel: { fontSize: 8, fontWeight: "600", color: "rgba(247,243,237,0.4)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  telemDivider:{ width: 1, backgroundColor: "rgba(247,243,237,0.1)" },

  modeCard: { margin: 16, backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.rule },
  modeTitle:{ fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: C.ink3, textTransform: "uppercase", marginBottom: 12 },
  modeRow:  { flexDirection: "row", gap: 10, marginBottom: 12 },
  modeBtn:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.paper2, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.rule },
  modeBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  modeBtnEdge:   { backgroundColor: C.leaf, borderColor: C.leaf },
  modeBtnLabel:  { fontSize: 13, fontWeight: "700", color: C.ink },
  modeBtnSub:    { fontSize: 9, color: C.ink3, marginTop: 1 },
  modeCurrent:   { fontSize: 11, color: C.ink3, lineHeight: 16 },

  section:      { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase", marginBottom: 12 },

  dpad:         { alignItems: "center", gap: 8 },
  dpadBtn:      { backgroundColor: C.white, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.rule, gap: 2 },
  dpadTop:      { width: 80, height: 80 },
  dpadBottom:   { width: 80, height: 80 },
  dpadSide:     { width: 80, height: 80 },
  dpadMiddleRow:{ flexDirection: "row", alignItems: "center", gap: 8 },
  dpadCenter:   { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dpadLabel:    { fontSize: 8, fontWeight: "700", color: C.ink3, letterSpacing: 0.5 },
  lastCmd:      { textAlign: "center", fontSize: 11, color: C.ink3, marginTop: 12 },

  abortBtn: { borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  abortGrad:{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  abortText:{ flex: 1, fontSize: 16, fontWeight: "900", color: C.white, letterSpacing: 0.5 },
  abortSub: { fontSize: 10, color: "rgba(255,255,255,0.6)" },
  rthBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(212,114,10,0.3)" },
  rthText:  { fontSize: 15, fontWeight: "700", color: C.saffron },

  logBox:   { backgroundColor: C.ink, borderRadius: 10, padding: 14 },
  logLine:  { fontSize: 10, fontFamily: "monospace", color: "rgba(247,243,237,0.45)", lineHeight: 18 },

  sprayCard:  { marginHorizontal: 16, backgroundColor: "#EBF5EA", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.leaf + "30" },
  sprayHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sprayTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: C.leaf },
  sprayBadge: { fontSize: 9, fontWeight: "700", color: C.leaf, backgroundColor: C.leaf + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sprayDesc:  { fontSize: 12, color: "#2D5028", lineHeight: 18, marginBottom: 12 },
  sprayBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.leaf, borderRadius: 8, paddingVertical: 12 },
  sprayBtnText:{ fontSize: 13, fontWeight: "700", color: C.white },
});
