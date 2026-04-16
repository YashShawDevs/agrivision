import { useState } from "react";
import { Header }            from "@/components/Header";
import { MissionInput }      from "@/components/MissionInput";
import { MissionSummary }    from "@/components/MissionSummary";
import { MissionConfidence } from "@/components/MissionConfidence";
import { AIThinkingOverlay } from "@/components/AIThinkingOverlay";
import { ActionButtons }     from "@/components/ActionButtons";
import { CameraFeed }        from "@/components/CameraFeed";
import { LiveMap }           from "@/components/LiveMap";
import { FlightDataPanel }   from "@/components/FlightDataPanel";
import { MissionProgress }   from "@/components/MissionProgress";
import { EmergencyControls } from "@/components/EmergencyControls";
import { PreflightModal }    from "@/components/PreflightModal";
import { StatusBar }         from "@/components/StatusBar";
import { AgriVisionTab }     from "@/components/AgriVisionTab";
import { useMissionState }   from "@/hooks/useMissionState";
import { CheckCircle2, AlertTriangle, Cpu, Leaf } from "lucide-react";

type Tab = "mission" | "agrivision";

const Index = () => {
  const mission = useMissionState();
  const [tab, setTab] = useState<Tab>("mission");

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] rounded-full bg-secondary/[0.04] blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-accent/[0.02] blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)`,
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      <Header connected={mission.flightData.connectionStatus === "connected"} />

      {/* Tab bar */}
      <div className="relative z-10 border-b border-white/[0.06] bg-card/40 backdrop-blur-sm px-4 lg:px-6">
        <div className="max-w-[1800px] mx-auto flex gap-1 pt-1">
          <button
            onClick={() => setTab("mission")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg
              transition-all duration-150 border-b-2
              ${tab === "mission"
                ? "border-primary text-primary bg-primary/[0.06]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            SAGE Mission Control
          </button>
          <button
            onClick={() => setTab("agrivision")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg
              transition-all duration-150 border-b-2
              ${tab === "agrivision"
                ? "border-success text-success bg-success/[0.06]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            AgriVision
            <span className="px-1.5 py-0.5 bg-success/15 text-success text-[10px] rounded-full font-medium border border-success/20">
              Weed Detection
            </span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 lg:p-6 overflow-auto relative z-10">

        {/* ── SAGE Mission Control tab ── */}
        {tab === "mission" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 max-w-[1800px] mx-auto">
            {/* Left */}
            <div className="lg:col-span-4 space-y-4">
              <MissionInput
                value={mission.missionInput}
                onChange={mission.setMissionInput}
                onGenerate={mission.generateMission}
                appState={mission.appState}
              />
              {mission.appState === "generating" && <AIThinkingOverlay />}
              <MissionSummary summary={mission.summary} />
              <MissionConfidence
                visible={["generated","preflight","executing","completed"].includes(mission.appState)}
                confidenceScore={mission.confidence?.score}
                confidenceFactors={mission.confidence?.factors}
              />
              <ActionButtons
                appState={mission.appState}
                onApprove={mission.startPreflight}
                onCancel={mission.resetMission}
                onReset={mission.resetMission}
              />
            </div>

            {/* Centre */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {mission.appState === "completed" && (
                <div className="glass-card p-3 flex items-center gap-3 glow-border-success animate-fade-up">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm text-success font-semibold">Mission completed successfully!</span>
                </div>
              )}
              {mission.appState === "aborted" && (
                <div className="glass-card p-3 flex items-center gap-3 glow-border-danger animate-fade-up">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span className="text-sm text-destructive font-semibold">Mission aborted — drone returning to base.</span>
                </div>
              )}
              <div className="flex-1"><CameraFeed /></div>
              <div className="flex-1"><LiveMap appState={mission.appState} /></div>
            </div>

            {/* Right */}
            <div className="lg:col-span-3 space-y-4">
              <FlightDataPanel data={mission.flightData} />
              <MissionProgress phases={mission.phases} appState={mission.appState} />
              <EmergencyControls
                appState={mission.appState}
                onAbort={mission.abortMission}
                onReturnHome={mission.returnToHome}
              />
            </div>
          </div>
        )}

        {/* ── AgriVision tab ── */}
        {tab === "agrivision" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 max-w-[1800px] mx-auto">
            {/* Left: upload + map + savings */}
            <div className="lg:col-span-7 space-y-4">
              <AgriVisionTab />
            </div>
            {/* Right: camera + telemetry + link back to mission */}
            <div className="lg:col-span-5 space-y-4">
              <div style={{ height: 260 }}><CameraFeed /></div>
              <FlightDataPanel data={mission.flightData} />
              <div className="glass-card p-4 space-y-3">
                <h3 className="section-label text-success">Spray Mission</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After reviewing detected weed zones, use SAGE AI to plan a precision
                  spray mission targeting only the flagged GPS polygons.
                </p>
                <button
                  onClick={() => setTab("mission")}
                  className="w-full btn-glow-success py-2.5 rounded-lg flex items-center
                    justify-center gap-2 text-sm font-semibold"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Plan Spray Mission in SAGE
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <StatusBar />

      <PreflightModal
        open={mission.appState === "preflight"}
        step={mission.preflightStep}
        onStepChange={mission.setPreflightStep}
        onComplete={mission.startExecution}
      />
    </div>
  );
};

export default Index;
