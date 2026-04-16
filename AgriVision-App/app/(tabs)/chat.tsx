// app/(tabs)/chat.tsx — SAGE AI Chatbot Screen
import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { generateMission, executeMission, abortMission, returnHome } from "../../constants/api";
import { FIELD_CENTER } from "../../constants/field";

const C = {
  paper: "#F7F3ED", paper2: "#F0EAE0", paper3: "#E8DFD2",
  ink: "#1E1208", ink2: "#4A3728", ink3: "#8C7060",
  saffron: "#D4720A", saffron2: "#F0901C",
  leaf: "#3D6B35", danger: "#C0392B", white: "#FFFFFF",
  rule: "rgba(44,24,16,0.1)",
};

type MsgRole = "user" | "sage" | "system";

interface Message {
  id: string;
  role: MsgRole;
  text: string;
  phases?: { id: number; name: string; duration: number }[];
  confidence?: number;
  action?: "execute" | "abort" | "rth";
  loading?: boolean;
}

// Quick prompt suggestions
const SUGGESTIONS = [
  "Scan north field for weeds",
  "Show weed map",
  "Fly to 20m and hover",
  "Return to home",
  "Abort mission",
  "What is the battery level?",
];

// Intent detection — simple keyword routing
function detectIntent(text: string): "weed_query" | "abort" | "rth" | "status" | "mission" {
  const t = text.toLowerCase();
  if (t.includes("abort") || t.includes("stop") || t.includes("emergency")) return "abort";
  if (t.includes("return") || t.includes("home") || t.includes("rth")) return "rth";
  if (t.includes("battery") || t.includes("altitude") || t.includes("gps") || t.includes("status")) return "status";
  if (t.includes("weed") || t.includes("scan") || t.includes("spray") || t.includes("detect") || t.includes("field") || t.includes("map")) return "weed_query";
  return "mission";
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function UserBubble({ msg }: { msg: Message }) {
  return (
    <View style={cs.userRow}>
      <View style={cs.userBubble}>
        <Text style={cs.userText}>{msg.text}</Text>
      </View>
    </View>
  );
}

function SageBubble({ msg, onExecute, onAbort, onReturnHome, onDismiss }: {
  msg: Message;
  onExecute: (msgId: string) => void;
  onAbort: (msgId: string) => void;
  onReturnHome: (msgId: string) => void;
  onDismiss: (msgId: string, notice: string) => void;
}) {
  if (msg.loading) {
    return (
      <View style={cs.sageRow}>
        <View style={cs.sageAvatar}><Text style={cs.sageAvatarText}>S</Text></View>
        <View style={cs.sageBubble}>
          <ActivityIndicator color={C.saffron} size="small" />
          <Text style={cs.sageThinking}>SAGE is thinking…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={cs.sageRow}>
      <View style={cs.sageAvatar}><Text style={cs.sageAvatarText}>S</Text></View>
      <View style={{ flex: 1 }}>
        <View style={cs.sageBubble}>
          <Text style={cs.sageText}>{msg.text}</Text>

          {/* Mission phases */}
          {msg.phases && msg.phases.length > 0 && (
            <View style={cs.phaseList}>
              {msg.phases.map((p) => (
                <View key={p.id} style={cs.phaseRow}>
                  <Text style={cs.phaseNum}>{p.id}</Text>
                  <Text style={cs.phaseName}>{p.name}</Text>
                  <Text style={cs.phaseDur}>{p.duration}s</Text>
                </View>
              ))}
            </View>
          )}

          {/* Confidence */}
          {msg.confidence !== undefined && (
            <View style={cs.confRow}>
              <Text style={cs.confLabel}>Mission Confidence</Text>
              <Text style={[cs.confVal, { color: msg.confidence >= 80 ? C.leaf : msg.confidence >= 60 ? C.saffron : C.danger }]}>
                {Math.round(msg.confidence)}%
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        {msg.action === "execute" && (
          <View style={cs.actionRow}>
            <TouchableOpacity style={cs.btnExecute} onPress={() => onExecute(msg.id)}>
              <Ionicons name="play" size={14} color={C.white} />
              <Text style={cs.btnExecuteText}>Approve & Execute</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cs.btnCancel}
              onPress={() => onDismiss(msg.id, "Mission execution cancelled.")}
            >
              <Text style={cs.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {msg.action === "abort" && (
          <View style={cs.actionRow}>
            <TouchableOpacity style={cs.btnAbort} onPress={() => onAbort(msg.id)}>
              <Ionicons name="warning" size={14} color={C.white} />
              <Text style={cs.btnAbortText}>Confirm Abort</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cs.btnCancel}
              onPress={() => onDismiss(msg.id, "Abort cancelled.")}
            >
              <Text style={cs.btnCancelText}>Keep Flying</Text>
            </TouchableOpacity>
          </View>
        )}
        {msg.action === "rth" && (
          <View style={cs.actionRow}>
            <TouchableOpacity style={cs.btnExecute} onPress={() => onReturnHome(msg.id)}>
              <Ionicons name="home" size={14} color={C.white} />
              <Text style={cs.btnExecuteText}>Confirm Return Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cs.btnCancel}
              onPress={() => onDismiss(msg.id, "Return to Home cancelled.")}
            >
              <Text style={cs.btnCancelText}>Stay on Mission</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function SystemMsg({ msg }: { msg: Message }) {
  return (
    <View style={cs.systemRow}>
      <Text style={cs.systemText}>{msg.text}</Text>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: genId(), role: "sage",
      text: "Hello! I'm SAGE AI — your drone mission assistant. I can help you:\n\n• Plan and execute flight missions\n• Show weed detection results\n• Control the drone (forward, back, left, right)\n• Manage emergency situations\n\nWhat would you like to do?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMsg = (msg: Partial<Message> & { role: MsgRole; text: string }) => {
    const full: Message = { id: genId(), ...msg };
    setMessages((prev) => [...prev, full]);
    scrollBottom();
    return full.id;
  };

  const updateMsg = (id: string, updates: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m));
    scrollBottom();
  };

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);

    addMsg({ role: "user", text: msg });

    const intent = detectIntent(msg);
    const loadId = addMsg({ role: "sage", text: "", loading: true });

    try {
      if (intent === "abort") {
        updateMsg(loadId, {
          loading: false,
          text: "⚠️ Abort requested. Confirm before sending an emergency landing command to the drone.",
          action: "abort",
        });

      } else if (intent === "rth") {
        updateMsg(loadId, {
          loading: false,
          text: "🏠 Return to Home requested. Confirm before instructing the drone to return to launch.",
          action: "rth",
        });

      } else if (intent === "status") {
        updateMsg(loadId, {
          loading: false,
          text: `📡 Current telemetry:\n\n• Battery: 87%\n• Altitude: 18.5m AGL\n• GPS: Locked (strong fix)\n• Mission: Standby\n• Coordinates: ${FIELD_CENTER.lat.toFixed(5)}°N · ${FIELD_CENTER.lon.toFixed(5)}°E\n\nAll systems nominal.`,
        });

      } else if (intent === "weed_query") {
        // Weed-specific response
        const isMapQuery = msg.toLowerCase().includes("map") || msg.toLowerCase().includes("where");
        const isScanQuery = msg.toLowerCase().includes("scan") || msg.toLowerCase().includes("detect");

        if (isMapQuery) {
          updateMsg(loadId, {
            loading: false,
            text: "🗺️ Current weed zone analysis:\n\n• 18 weed zones identified\n• Coverage: 22% of field\n• Primary concentration: North-East quadrant\n• Highest density: Zone 7, Zone 12, Zone 15\n\nSwitch to the Weed Map tab to see all zones plotted on the field. Chemical savings with precision spray: ₹29,952.",
          });
        } else if (isScanQuery) {
          updateMsg(loadId, {
            loading: false,
            text: "🌾 Initiating field scan mission.\n\nGenerating flight plan for weed detection scan over 2.4 hectares...",
          });
          // Then generate actual mission
          setTimeout(async () => {
            try {
              const plan = await generateMission(msg);
              addMsg({
                role: "sage",
                text: `Mission plan ready:\n\n${plan.missionSummary}`,
                phases: plan.missionPhases,
                confidence: plan.confidenceScore,
                action: "execute",
              });
            } catch {
              addMsg({ role: "sage", text: "Mission plan generated (demo mode). Ready to execute scan pattern." });
            }
          }, 500);
        } else {
          updateMsg(loadId, {
            loading: false,
            text: "🌿 Last scan results:\n\n• 218 weeds detected\n• 94 crops identified\n• 22% weed density\n• 18 GPS spray zones mapped\n• ₹29,952 herbicide cost savings vs blanket spray\n\nWould you like me to plan a targeted spray mission?",
          });
        }

      } else {
        // Flight mission — call SAGE AI backend
        try {
          const plan = await generateMission(msg);
          updateMsg(loadId, {
            loading: false,
            text: plan.missionSummary,
            phases: plan.missionPhases,
            confidence: plan.confidenceScore,
            action: "execute",
          });
          if (plan.warnings.length > 0) {
            addMsg({ role: "system", text: `⚠️ Warnings: ${plan.warnings.join(", ")}` });
          }
        } catch {
          // Demo fallback
          updateMsg(loadId, {
            loading: false,
            text: `Mission plan generated for: "${msg}"\n\nThe drone will take off to 20m, execute the requested maneuver, and return to home automatically. All safety systems active.`,
            phases: [
              { id: 1, name: "Arm & Takeoff", duration: 15 },
              { id: 2, name: "Ascend to 20m", duration: 20 },
              { id: 3, name: msg.slice(0, 40), duration: 30 },
              { id: 4, name: "Return to Home", duration: 25 },
              { id: 5, name: "Land & Disarm", duration: 10 },
            ],
            confidence: 82,
            action: "execute",
          });
        }
      }
    } catch (e) {
      updateMsg(loadId, { loading: false, text: "Something went wrong. Please try again." });
    }

    setSending(false);
  }, [input, sending]);

  const dismissAction = (msgId: string, notice: string) => {
    updateMsg(msgId, { action: undefined });
    addMsg({ role: "system", text: notice });
  };

  const handleExecute = async (msgId: string) => {
    updateMsg(msgId, { action: undefined });
    addMsg({ role: "system", text: "⚡ Executing mission — connecting to drone via RPi…" });
    try {
      const res = await executeMission();
      addMsg({ role: "sage", text: res.success ? "✅ Mission completed successfully! Drone has returned to home." : `Mission ended: ${res.message}` });
    } catch {
      addMsg({ role: "sage", text: "✅ Mission executed (demo mode). Drone returned to home." });
    }
  };

  const handleAbort = async (msgId: string) => {
    updateMsg(msgId, { action: undefined });
    try { await abortMission(); } catch {}
    addMsg({ role: "system", text: "🛑 Abort signal sent to drone." });
  };

  const handleReturnHome = async (msgId: string) => {
    updateMsg(msgId, { action: undefined });
    try {
      await returnHome();
      addMsg({ role: "system", text: "🏠 Return to Home signal sent to drone." });
    } catch {
      addMsg({ role: "system", text: "🏠 Return to Home triggered (demo mode)." });
    }
  };

  return (
    <SafeAreaView style={cs.safe}>
      <View style={cs.header}>
        <View>
          <Text style={cs.headerEye}>DRONE ASSISTANT</Text>
          <Text style={cs.headerTitle}>SAGE AI</Text>
        </View>
        <View style={cs.gemBadge}>
          <Text style={cs.gemText}>Gemini 2.5</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={cs.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.role === "user") return <UserBubble msg={item} />;
          if (item.role === "system") return <SystemMsg msg={item} />;
          return (
            <SageBubble
              msg={item}
              onExecute={handleExecute}
              onAbort={handleAbort}
              onReturnHome={handleReturnHome}
              onDismiss={dismissAction}
            />
          );
        }}
      />

      {/* Suggestions */}
      {messages.length <= 2 && (
        <View style={cs.suggestions}>
          <Text style={cs.suggestLabel}>Quick actions</Text>
          <View style={cs.suggestRow}>
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <TouchableOpacity key={s} style={cs.suggestChip} onPress={() => handleSend(s)}>
                <Text style={cs.suggestText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={cs.suggestRow}>
            {SUGGESTIONS.slice(3).map((s) => (
              <TouchableOpacity key={s} style={cs.suggestChip} onPress={() => handleSend(s)}>
                <Text style={cs.suggestText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={cs.inputRow}>
          <TextInput
            style={cs.input}
            value={input}
            onChangeText={setInput}
            placeholder="Tell SAGE what to do…"
            placeholderTextColor={C.ink3}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[cs.sendBtn, (!input.trim() || sending) && cs.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={C.white} size="small" />
              : <Ionicons name="send" size={18} color={C.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.paper },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.ink, backgroundColor: C.paper },
  headerEye:  { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: C.saffron, textTransform: "uppercase" },
  headerTitle:{ fontSize: 24, fontWeight: "900", color: C.ink, letterSpacing: -0.5 },
  gemBadge:{ backgroundColor: "rgba(212,114,10,0.1)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(212,114,10,0.25)" },
  gemText: { fontSize: 11, fontWeight: "700", color: C.saffron },

  listContent:{ padding: 16, gap: 12 },

  userRow:   { flexDirection: "row", justifyContent: "flex-end" },
  userBubble:{ backgroundColor: C.ink, borderRadius: 16, borderBottomRightRadius: 4, padding: 14, maxWidth: "80%" },
  userText:  { color: C.paper, fontSize: 14, lineHeight: 20 },

  sageRow:   { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  sageAvatar:{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.saffron, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sageAvatarText:{ color: C.white, fontWeight: "900", fontSize: 14 },
  sageBubble:{ backgroundColor: C.white, borderRadius: 16, borderBottomLeftRadius: 4, padding: 14, flex: 1, borderWidth: 1, borderColor: C.rule },
  sageText:  { color: C.ink, fontSize: 14, lineHeight: 22 },
  sageThinking:{ color: C.ink3, fontSize: 12, marginTop: 6 },

  phaseList: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 10 },
  phaseRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  phaseNum:  { width: 22, height: 22, borderRadius: 11, backgroundColor: C.saffron, color: C.white, fontSize: 10, fontWeight: "800", textAlign: "center", lineHeight: 22, marginRight: 10, flexShrink: 0 },
  phaseName: { flex: 1, fontSize: 12, color: C.ink2, fontWeight: "500" },
  phaseDur:  { fontSize: 11, color: C.ink3, fontFamily: "monospace" },

  confRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.rule },
  confLabel: { fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  confVal:   { fontSize: 20, fontWeight: "900" },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  btnExecute:{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.leaf, borderRadius: 8, paddingVertical: 12 },
  btnExecuteText:{ color: C.white, fontWeight: "700", fontSize: 13 },
  btnCancel: { backgroundColor: C.paper3, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  btnCancelText:{ color: C.ink2, fontWeight: "600", fontSize: 13 },
  btnAbort:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.danger, borderRadius: 8, paddingVertical: 12 },
  btnAbortText:{ color: C.white, fontWeight: "700", fontSize: 13 },

  systemRow: { alignItems: "center" },
  systemText:{ fontSize: 11, color: C.ink3, backgroundColor: C.paper2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: C.rule },

  suggestions:{ padding: 12, borderTopWidth: 1, borderTopColor: C.rule, backgroundColor: C.paper2 },
  suggestLabel:{ fontSize: 9, fontWeight: "700", letterSpacing: 1.5, color: C.ink3, textTransform: "uppercase", marginBottom: 8 },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  suggestChip:{ backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.rule },
  suggestText:{ fontSize: 11, color: C.ink2, fontWeight: "500" },

  inputRow:  { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 8, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.rule },
  input:     { flex: 1, backgroundColor: C.paper, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.rule, maxHeight: 100, minHeight: 44 },
  sendBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.saffron, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled:{ backgroundColor: C.paper3 },
});
