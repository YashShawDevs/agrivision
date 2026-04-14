import { useState } from "react";
import { Header }           from "@/components/Header";
import { MissionInput }     from "@/components/MissionInput";
import { MissionSummary }   from "@/components/MissionSummary";
import { MissionConfidence } from "@/components/MissionConfidence";
import { AIThinkingOverlay } from "@/components/AIThinkingOverlay";
import { ActionButtons }    from "@/components/ActionButtons";
import { CameraFeed }       from "@/components/CameraFeed";
import { LiveMap }          from "@/components/LiveMap";
import { FlightDataPanel }  from "@/components/FlightDataPanel";
import { MissionProgress }  from "@/components/MissionProgress";
import { EmergencyControls } from "@/components/EmergencyControls";
import { PreflightModal }   from "@/components/PreflightModal";
import { StatusBar }        from "@/components/StatusBar";
import { AgriVisionTab }    from "@/components/AgriVisionTab";
import { useMissionState }  from "@/hooks/useMissionState";
import { CheckCircle2, AlertTriangle, Cpu, Leaf } from "lucide-react";

type Tab = "mission"|"agrivision";

const Index = () => {
  const m = useMissionState();
  const [tab, setTab] = useState<Tab>("mission");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header connected={m.flightData.connectionStatus === "connected"}/>

      {/* Tab bar */}
      <div className="border-b border-border bg-white px-4 lg:px-6">
        <div className="max-w-[1800px] mx-auto flex gap-1 pt-1">
          <button onClick={() => setTab("mission")}
            className={tab==="mission" ? "tab-btn-active" : "tab-btn"}>
            <Cpu className="w-3.5 h-3.5"/>SAGE Mission Control
          </button>
          <button onClick={() => setTab("agrivision")}
            className={tab==="agrivision" ? "tab-btn-active" : "tab-btn"}>
            <Leaf className="w-3.5 h-3.5 text-green-600"/>AgriVision
            <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium">
              Weed Detection
            </span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 lg:p-5 overflow-auto">
        {/* ── SAGE Mission tab ── */}
        {tab === "mission" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1800px] mx-auto">
            {/* Left */}
            <div className="lg:col-span-4 space-y-3">
              <MissionInput value={m.missionInput} onChange={m.setMissionInput}
                onGenerate={m.generateMission} appState={m.appState}/>
              {m.appState === "generating" && <AIThinkingOverlay/>}
              <MissionSummary summary={m.summary}/>
              <MissionConfidence
                visible={["generated","preflight","executing","completed"].includes(m.appState)}
                confidenceScore={m.confidence?.score}
                confidenceFactors={m.confidence?.factors}/>
              <ActionButtons appState={m.appState} onApprove={m.startPreflight}
                onCancel={m.resetMission} onReset={m.resetMission}/>
            </div>

            {/* Centre */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {m.appState === "completed" && (
                <div className="card-base p-3 flex items-center gap-2.5 bg-green-50 border-green-200 animate-fade-up">
                  <CheckCircle2 className="w-4 h-4 text-green-600"/>
                  <span className="text-sm font-semibold text-green-700">Mission completed successfully!</span>
                </div>
              )}
              {m.appState === "aborted" && (
                <div className="card-base p-3 flex items-center gap-2.5 bg-red-50 border-red-200 animate-fade-up">
                  <AlertTriangle className="w-4 h-4 text-red-600"/>
                  <span className="text-sm font-semibold text-red-700">Mission aborted — drone returning to base.</span>
                </div>
              )}
              <div style={{ flex:"1 1 280px" }}><CameraFeed/></div>
              <div style={{ flex:"1 1 260px" }}><LiveMap appState={m.appState}/></div>
            </div>

            {/* Right */}
            <div className="lg:col-span-3 space-y-3">
              <FlightDataPanel data={m.flightData}/>
              <MissionProgress phases={m.phases} appState={m.appState}/>
              <EmergencyControls appState={m.appState} onAbort={m.abortMission} onReturnHome={m.returnToHome}/>
            </div>
          </div>
        )}

        {/* ── AgriVision tab ── */}
        {tab === "agrivision" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1800px] mx-auto">
            {/* Left — upload + map + savings */}
            <div className="lg:col-span-7 space-y-3">
              <AgriVisionTab/>
            </div>
            {/* Right — camera + telemetry + mission link */}
            <div className="lg:col-span-5 space-y-3">
              <div style={{ height:260 }}><CameraFeed/></div>
              <FlightDataPanel data={m.flightData}/>
              <div className="card-base p-4 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Spray Mission
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After reviewing detected weed zones, use SAGE AI to plan a precision spray mission over only the flagged GPS polygons.
                </p>
                <button onClick={() => setTab("mission")}
                  className="w-full btn-primary py-2 flex items-center justify-center gap-2 text-sm">
                  <Cpu className="w-3.5 h-3.5"/>Plan Spray Mission in SAGE
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <StatusBar/>

      <PreflightModal open={m.appState === "preflight"} step={m.preflightStep}
        onStepChange={m.setPreflightStep} onComplete={m.startExecution}/>
    </div>
  );
};

export default Index;
