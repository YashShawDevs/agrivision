import { Header } from "@/components/Header";
import { MissionInput } from "@/components/MissionInput";
import { MissionSummary } from "@/components/MissionSummary";
import { MissionConfidence } from "@/components/MissionConfidence";
import { AIThinkingOverlay } from "@/components/AIThinkingOverlay";
import { ActionButtons } from "@/components/ActionButtons";

import { CameraFeed } from "@/components/CameraFeed";
import { LiveMap } from "@/components/LiveMap";
import { FlightDataPanel } from "@/components/FlightDataPanel";
import { MissionProgress } from "@/components/MissionProgress";
import { EmergencyControls } from "@/components/EmergencyControls";
import { PreflightModal } from "@/components/PreflightModal";
import { StatusBar } from "@/components/StatusBar";
import { useMissionState } from "@/hooks/useMissionState";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const Index = () => {
  const mission = useMissionState();

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

      <main className="flex-1 p-4 lg:p-6 overflow-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 max-w-[1800px] mx-auto h-full">
          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-4 space-y-4">
            <MissionInput
              value={mission.missionInput}
              onChange={mission.setMissionInput}
              onGenerate={mission.generateMission}
              appState={mission.appState}
              onSimToggle={mission.setSimMode}
            />
            {mission.appState === "generating" && <AIThinkingOverlay />}
            <MissionSummary summary={mission.summary} />
            <MissionConfidence
              visible={["generated", "preflight", "executing", "completed"].includes(
                mission.appState
              )}
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

          {/* CENTER */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {mission.appState === "completed" && (
              <div className="glass-card p-3 flex items-center gap-3 glow-border-success animate-fade-up">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <span className="text-sm text-success font-semibold">
                  Mission completed successfully!
                </span>
              </div>
            )}
            {mission.appState === "aborted" && (
              <div className="glass-card p-3 flex items-center gap-3 glow-border-danger animate-fade-up">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="text-sm text-destructive font-semibold">
                  Mission aborted — drone returning to base.
                </span>
              </div>
            )}
            <div className="flex-1">
              <CameraFeed />
            </div>
            {/* LiveMap now receives weed waypoints + spray mode flag */}
            <div className="flex-1">
              <LiveMap
                appState={mission.appState}
                weedWaypoints={mission.weedWaypoints}
                isSprayMode={mission.isSprayMode}
              />
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="lg:col-span-3 space-y-4">
            <FlightDataPanel data={mission.flightData} />
            {/* MissionProgress now receives isSprayMode for spray-specific styling */}
            <MissionProgress
              phases={mission.phases}
              appState={mission.appState}
              isSprayMode={mission.isSprayMode}
            />
            <EmergencyControls
              appState={mission.appState}
              onAbort={mission.abortMission}
              onReturnHome={mission.returnToHome}
            />
          </div>
        </div>
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
