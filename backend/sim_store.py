"""
sim_store.py — runtime simulation mode flags
Toggled via /api/sim-mode endpoint, read by drone_control + agrivision.
Persisted to sim_state.json so state survives backend reloads.
"""
import json, os

_STATE_FILE = os.path.join(os.path.dirname(__file__), "sim_state.json")

def _load() -> dict:
    try:
        with open(_STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"mission_sim": False, "weed_demo": False}

def _save(state: dict):
    try:
        with open(_STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass

class SimStore:
    def __init__(self):
        s = _load()
        self.mission_sim: bool = s.get("mission_sim", False)
        self.weed_demo:   bool = s.get("weed_demo", False)

    def set_mission_sim(self, val: bool):
        self.mission_sim = val
        _save({"mission_sim": self.mission_sim, "weed_demo": self.weed_demo})

    def set_weed_demo(self, val: bool):
        self.weed_demo = val
        _save({"mission_sim": self.mission_sim, "weed_demo": self.weed_demo})

sim = SimStore()
