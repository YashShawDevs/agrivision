from pydantic import BaseModel
from typing import Optional


# ── Requests ──────────────────────────────────────────────────────────────────

class GenerateMissionRequest(BaseModel):
    missionInput: str


class TelemetrySnapshot(BaseModel):
    battery:   Optional[float] = None
    altitude:  Optional[float] = None
    latitude:  Optional[float] = None
    longitude: Optional[float] = None
    gpsLock:   Optional[bool]  = None


class PhaseUpdateRequest(BaseModel):
    phaseId:     int
    phaseStatus: str                         # "completed"
    phaseName:   str
    telemetry:   Optional[TelemetrySnapshot] = None


# ── Shared pieces ─────────────────────────────────────────────────────────────

class MissionPhase(BaseModel):
    id: int
    name: str
    duration: int  # seconds


class ConfidenceFactor(BaseModel):
    label: str
    value: float


# ── Responses ─────────────────────────────────────────────────────────────────

class GenerateMissionResponse(BaseModel):
    missionSummary: str
    missionPhases: list[MissionPhase]
    confidenceScore: float
    confidenceFactors: list[ConfidenceFactor]
    estimatedDuration: int
    warnings: list[str]


class ActionResponse(BaseModel):
    success: bool
    message: str