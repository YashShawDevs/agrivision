from dataclasses import dataclass, field
from typing import Optional
import paramiko
from models import TelemetrySnapshot

@dataclass
class MissionStore:
    script:           Optional[str]               = None
    summary:          Optional[str]               = None
    phases:           Optional[list]              = None
    is_executing:     bool                        = False
    ssh_client:       Optional[paramiko.SSHClient] = None
    latest_telemetry: Optional[TelemetrySnapshot] = None

    def clear(self):
        self.script = self.summary = self.phases = self.ssh_client = self.latest_telemetry = None
        self.is_executing = False

    def has_mission(self) -> bool:
        return self.script is not None

store = MissionStore()
