"""
sim_store.py — runtime simulation mode flags
Toggled via /api/sim-mode endpoint, read by drone_control + agrivision.
"""

class SimStore:
    mission_sim: bool = False   # SAGE mission execution simulation
    weed_demo:   bool = False   # AgriVision demo detection

sim = SimStore()
