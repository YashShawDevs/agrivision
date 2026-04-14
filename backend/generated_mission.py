"""
================================================================================
 Autonomous Drone Flight Script
 Hardware : Pixhawk (any variant) running ArduPilot / ArduCopter
 Libraries : DroneKit, pymavlink
 Mode     : GUIDED (GPS position-corrected, wind-resistant)
 Connection: /dev/ttyAMA0  @  921600 baud
================================================================================
IMPORTANT: Only edit run_mission() and the CONFIGURATION values in Section 1.
Copy all other functions EXACTLY from the original — do not rewrite them.

 BEFORE RUNNING:
   pip install dronekit pymavlink requests

 ── FOR AI ASSISTANTS MODIFYING THIS SCRIPT ─────────────────────────────────
 This script connects to a Pixhawk flight controller, performs pre-flight
 safety checks, then executes a fully autonomous flight mission.

 The mission is defined entirely inside run_mission() near the bottom.
 That is the ONLY function you normally need to edit to change flight behaviour.

 PHASE REPORTING — IMPORTANT:
   Every phase in run_mission() MUST call complete_phase() when it finishes.
   This reports progress back to the SAGE AI ground station.
   The function signature is:
       complete_phase(vehicle, phase_id, phase_name)
   Example:
       arm_and_takeoff(vehicle, takeoff_alt)
       complete_phase(vehicle, 1, "Takeoff")

       hover(vehicle, hover_time)
       complete_phase(vehicle, 2, "Hover")

       return_to_launch(vehicle)
       complete_phase(vehicle, 3, "Return to Launch")

   Phase IDs must start at 1 and increment by 1 for each phase.
   Always call complete_phase() AFTER the action finishes, not before.
   Never skip a phase — the ground station tracks every one.

 SIGNAL HANDLING — DO NOT REMOVE:
   SIGTERM → triggers RTL mode  (sent by ground station for Return to Home)
   SIGINT  → triggers LAND mode (sent by ground station for Abort)
   These are already set up in Section 2. Do not modify them.

 DIRECTION TRANSLATION (plain English → NED):
   "forward"  = North  (north= positive)
   "backward" = South  (north= negative)
   "right"    = East   (east=  positive)
   "left"     = West   (east=  negative)
   This assumes the drone is armed facing North. If the drone is armed
   facing a different direction, adjust accordingly before flying.

 Quick-reference — what to change for common human requests:
   "hover for X seconds"          → change HOVER_TIME in CONFIG, or pass a
                                     different number into hover(vehicle, X)
   "fly higher / lower"           → change TAKEOFF_ALTITUDE in CONFIG
   "fly faster / slower"          → change GROUNDSPEED in CONFIG
   "go North/South/East/West Xm"  → edit goto_ned_position() calls in
                                     run_mission() — see NED GUIDE below
   "add a waypoint"               → add a new goto_ned_position() + hover()
                                     block inside run_mission()
   "remove a waypoint"            → delete the corresponding goto_ned_position()
                                     + hover() block from run_mission()
   "change waypoint order"        → reorder the goto_ned_position() blocks
                                     inside run_mission()

 ── NED COORDINATE SYSTEM GUIDE ─────────────────────────────────────────────
 All positions are relative to the HOME point (where the drone arms/takes off).
 The function signature is: goto_ned_position(vehicle, north, east, alt)

   north= positive number  →  fly NORTH  (e.g. north=20  means 20m North)
   north= negative number  →  fly SOUTH  (e.g. north=-20 means 20m South)
   east=  positive number  →  fly EAST   (e.g. east=15   means 15m East)
   east=  negative number  →  fly WEST   (e.g. east=-15  means 15m West)
   alt=   always positive  →  altitude above ground in metres

 IMPORTANT: coordinates are ABSOLUTE from HOME, not relative to last position.
 Example — to fly a straight line 30m North then stop:
     goto_ned_position(vehicle, north=30, east=0, alt=10)
 Example — to then fly 20m East from that point:
     goto_ned_position(vehicle, north=30, east=20, alt=10)  ← north stays 30
================================================================================
"""

import time
import math
import sys
import signal
import argparse
import requests
from dronekit import connect, VehicleMode
from pymavlink import mavutil


# ============================================================
# SECTION 1 — CONFIGURATION
# ── This is the first place to look when changing flight parameters.
# ── These values are used as defaults throughout the whole script.
# ── They can also be overridden at runtime via command-line arguments.
# ============================================================

CONNECTION_STRING = '/dev/ttyAMA0'  # Serial port where Pixhawk is connected
BAUD_RATE         = 921600          # Must match the baud set on Pixhawk's serial port

# ── FLIGHT PARAMETERS — change these to adjust flight behaviour ──────────────
TAKEOFF_ALTITUDE  = 20              # How high to climb on takeoff (metres above ground)
GROUNDSPEED       = 2.0             # How fast to fly between waypoints (metres per second)
HOVER_TIME        = 15              # How many seconds to hover after takeoff before first waypoint

# ── NAVIGATION TUNING — usually no need to change these ──────────────────────
ARRIVAL_THRESHOLD = 1.5             # metres — how close = "arrived at waypoint"
COMMAND_TIMEOUT   = 30              # seconds — max wait for any single action

# ── SAGE AI BACKEND — update to your laptop's IP address ─────────────────────
BACKEND_URL       = "http://192.168.1.100:8000"   # ← change to your laptop's IP


# ============================================================
# SECTION 2 — SIGNAL HANDLERS (abort and RTH from ground station)
# ── SIGTERM is sent by the ground station for Return to Home
# ── SIGINT  is sent by the ground station for Emergency Abort/Land
# ── DO NOT REMOVE OR MODIFY THESE — they are required for safe operation.
# ── The vehicle object is injected at runtime in the entry point below.
# ============================================================

_vehicle_ref = None  # set in __main__ once vehicle is connected

def _handle_rth(sig, frame):
    """SIGTERM → Return to Home. Sent by /api/return-home endpoint."""
    print("[SAGE] RTH signal received — switching to RTL mode")
    if _vehicle_ref:
        _vehicle_ref.mode = VehicleMode("RTL")
    sys.exit(0)

def _handle_abort(sig, frame):
    """SIGINT → Emergency land in place. Sent by /api/abort endpoint."""
    print("[SAGE] Abort signal received — switching to LAND mode")
    if _vehicle_ref:
        _vehicle_ref.mode = VehicleMode("LAND")
    sys.exit(0)

signal.signal(signal.SIGTERM, _handle_rth)
signal.signal(signal.SIGINT,  _handle_abort)


# ============================================================
# SECTION 3 — PHASE REPORTING
# ── Reports phase completion back to the SAGE AI ground station.
# ── Call complete_phase() at the end of every phase in run_mission().
# ── If the backend is unreachable the drone keeps flying — never crashes.
# ── DO NOT MODIFY THIS FUNCTION.
# ============================================================

def complete_phase(vehicle, phase_id: int, phase_name: str):
    """
    Report a completed mission phase to the SAGE AI backend.
    Non-blocking and failure-safe — drone continues even if backend is down.

    Args:
        vehicle    : DroneKit vehicle object (used to attach live telemetry)
        phase_id   : phase sequence number starting at 1
        phase_name : human-readable phase name matching the mission plan
    """
    try:
        requests.post(
            f"{BACKEND_URL}/api/phase-update",
            json={
                "phaseId":     phase_id,
                "phaseStatus": "completed",
                "phaseName":   phase_name,
                # Attach live telemetry snapshot with each phase update
                "telemetry": {
                    "battery":   vehicle.battery.level,
                    "altitude":  round(vehicle.location.global_relative_frame.alt, 2),
                    "latitude":  vehicle.location.global_frame.lat,
                    "longitude": vehicle.location.global_frame.lon,
                    "gpsLock":   vehicle.gps_0.fix_type >= 3,
                }
            },
            timeout=3   # never wait more than 3 seconds — flight comes first
        )
        print(f"[SAGE] Phase {phase_id} '{phase_name}' reported complete")
    except Exception as e:
        # Backend unreachable — log and continue flying
        print(f"[SAGE] Phase report skipped (backend unreachable): {e}")


# ============================================================
# SECTION 4 — VEHICLE CONNECTION
# ── Handles opening the serial link to the Pixhawk.
# ── If connection fails the script exits immediately.
# ── No need to modify this function.
# ============================================================

def connect_vehicle(connection_string, baud=921600):
    """Open a MAVLink connection to the Pixhawk and return the vehicle object."""
    try:
        vehicle = connect(connection_string, baud=baud, wait_ready=True, timeout=60)
        return vehicle
    except Exception as e:
        sys.exit(1)


# ============================================================
# SECTION 5 — PRE-FLIGHT SAFETY CHECKS
# ── Runs automatically before every flight.
# ── Blocks and waits until GPS lock is acquired, battery is sufficient,
# ── and the EKF (ArduPilot's internal navigation filter) is healthy.
# ── The script will NOT take off until all checks pass.
# ── No need to modify this function.
# ============================================================

def preflight_checks(vehicle):
    """
    Block until GPS lock, battery, and EKF are all healthy.
    Aborts with sys.exit(1) if any check times out or fails.
    """
    start = time.time()
    while vehicle.gps_0.fix_type < 3:
        if time.time() - start > 60:
            sys.exit(1)
        time.sleep(2)

    if vehicle.battery.level is not None and vehicle.battery.level < 20:
        sys.exit(1)

    start = time.time()
    while not vehicle.is_armable:
        if time.time() - start > 60:
            sys.exit(1)
        time.sleep(2)


# ============================================================
# SECTION 6 — ARM AND TAKEOFF
# ── Switches the drone to GUIDED mode, arms the motors, and climbs
# ── to the specified altitude. Blocks until the altitude is reached.
# ──
# ── TO CHANGE TAKEOFF HEIGHT: pass a different number when calling
# ──   arm_and_takeoff(vehicle, 20)  ← climbs to 20 metres
# ──   or change TAKEOFF_ALTITUDE in Section 1.
# ============================================================

def arm_and_takeoff(vehicle, target_altitude):
    """
    Switch to GUIDED mode, arm motors, climb to target_altitude (metres AGL).
    Calls emergency_land() and exits if takeoff does not complete in time.
    """
    vehicle.mode = VehicleMode("GUIDED")
    while vehicle.mode.name != "GUIDED":
        time.sleep(0.5)

    vehicle.armed = True
    start = time.time()
    while not vehicle.armed:
        if time.time() - start > 15:
            sys.exit(1)
        time.sleep(1)

    vehicle.simple_takeoff(target_altitude)

    start = time.time()
    while True:
        alt = vehicle.location.global_relative_frame.alt
        if alt >= target_altitude * 0.95:
            break
        if time.time() - start > COMMAND_TIMEOUT:
            emergency_land(vehicle)
            sys.exit(1)
        time.sleep(1)


# ============================================================
# SECTION 7 — FLY TO POSITION (the core movement command)
# ── This is the function called for every waypoint in the mission.
# ──
# ── HOW TO USE:
# ──   goto_ned_position(vehicle, north=X, east=Y, alt=Z)
# ──   goto_ned_position(vehicle, north=X, east=Y, alt=Z, groundspeed=S)
# ──
# ── Coordinates are ABSOLUTE from the HOME/arming point — see NED GUIDE
# ── at the top of this file for full direction reference.
# ============================================================

def goto_ned_position(vehicle, north, east, alt, groundspeed=None):
    """
    Fly to an absolute NED position from HOME and block until arrival.

    Args:
        vehicle     : DroneKit vehicle object
        north       : metres North of home (negative = South)
        east        : metres East of home  (negative = West)
        alt         : altitude in metres AGL (always positive)
        groundspeed : speed in m/s — omit to use the global GROUNDSPEED value
    """
    if groundspeed is None:
        groundspeed = GROUNDSPEED

    vehicle.groundspeed = groundspeed

    type_mask = (
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_VX_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_VY_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_VZ_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_AX_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_AY_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_AZ_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_YAW_IGNORE |
        mavutil.mavlink.POSITION_TARGET_TYPEMASK_YAW_RATE_IGNORE
    )

    msg = vehicle.message_factory.set_position_target_local_ned_encode(
        0, 0, 0,
        mavutil.mavlink.MAV_FRAME_LOCAL_NED,
        type_mask,
        north, east, -alt,
        0, 0, 0,
        0, 0, 0,
        0, 0
    )

    vehicle.send_mavlink(msg)
    _wait_for_arrival(vehicle, north, east, alt, msg)


def _wait_for_arrival(vehicle, target_north, target_east, target_alt, msg):
    """
    Internal helper — loops until the drone is within ARRIVAL_THRESHOLD metres
    of the target. Re-sends msg every 0.5s to prevent ArduPilot aging it out.
    Do NOT call this function directly — use goto_ned_position() instead.
    """
    start      = time.time()
    none_start = None

    while True:
        vehicle.send_mavlink(msg)

        if vehicle.mode.name != "GUIDED":
            sys.exit(1)

        loc = vehicle.location.local_frame

        if loc.north is None or loc.east is None:
            if none_start is None:
                none_start = time.time()
            elif time.time() - none_start > 10:
                emergency_land(vehicle)
                sys.exit(1)
            time.sleep(0.5)
            continue

        none_start = None

        dist_horiz = math.sqrt((loc.north - target_north) ** 2 +
                               (loc.east  - target_east)  ** 2)
        dist_vert  = abs(vehicle.location.global_relative_frame.alt - target_alt)
        dist_3d    = math.sqrt(dist_horiz ** 2 + dist_vert ** 2)

        if dist_3d <= ARRIVAL_THRESHOLD:
            break

        if time.time() - start > COMMAND_TIMEOUT:
            break

        time.sleep(0.5)


# ============================================================
# SECTION 8 — HOVER
# ── In GUIDED mode ArduPilot holds GPS position automatically.
# ── This function simply waits — no extra command needed.
# ============================================================

def hover(vehicle, duration):
    """
    Hold current GPS position for 'duration' seconds.
    Exits immediately if the flight mode changes unexpectedly.
    """
    for _ in range(duration):
        if vehicle.mode.name != "GUIDED":
            sys.exit(1)
        time.sleep(1)


# ============================================================
# SECTION 9 — RETURN TO LAUNCH (RTL)
# ── Switches ArduPilot to RTL mode. The firmware handles everything:
# ── climbs to RTL altitude, flies back to home GPS point, then lands.
# ── Blocks until the vehicle is on the ground and disarmed.
# ============================================================

def return_to_launch(vehicle):
    """Command RTL mode and block until the vehicle lands and disarms at home."""
    vehicle.mode = VehicleMode("RTL")
    while vehicle.mode.name != "RTL":
        time.sleep(0.5)
    while vehicle.armed:
        time.sleep(2)


# ============================================================
# SECTION 10 — EMERGENCY LAND
# ── Activated automatically on any unhandled error.
# ── Drops the drone straight down from its current position.
# ── DO NOT REMOVE THIS FUNCTION.
# ============================================================

def emergency_land(vehicle):
    """Immediately switch to LAND mode and descend in place."""
    vehicle.mode = VehicleMode("LAND")
    while vehicle.armed:
        time.sleep(2)


# ============================================================
# SECTION 11 — MISSION  ◄─── EDIT THIS SECTION TO CHANGE THE FLIGHT PLAN
# ──
# ── RULES FOR AI ASSISTANTS:
# ──   1. Every phase MUST end with complete_phase(vehicle, id, name)
# ──   2. Phase IDs start at 1 and increment by 1
# ──   3. Call complete_phase() AFTER the action finishes, not before
# ──   4. The final complete_phase() call must always be after RTL
# ──   5. Do not remove signal handlers or complete_phase() from the script
# ──
# ── EXAMPLE with phase reporting:
# ──
# ──   arm_and_takeoff(vehicle, takeoff_alt)
# ──   complete_phase(vehicle, 1, "Takeoff")
# ──
# ──   hover(vehicle, hover_time)
# ──   complete_phase(vehicle, 2, "Hover")
# ──
# ──   goto_ned_position(vehicle, north=20, east=0, alt=takeoff_alt)
# ──   complete_phase(vehicle, 3, "Fly North 20m")
# ──
# ──   return_to_launch(vehicle)
# ──   complete_phase(vehicle, 4, "Return to Launch")
# ============================================================

def run_mission(vehicle, takeoff_alt, groundspeed, hover_time):
    """
    Main flight plan. Edit the body of this function to change the mission.

    Current plan: take off → hover at 20m for 15 seconds → RTL

    Args:
        vehicle     : DroneKit vehicle object (passed in from main)
        takeoff_alt : altitude to climb to on takeoff (metres)
        groundspeed : speed to fly between waypoints (m/s)
        hover_time  : seconds to hover after takeoff before first waypoint
    """

    # ── Phase 1: Arm and climb to takeoff altitude (20m) ─────────────────────
    arm_and_takeoff(vehicle, takeoff_alt)
    complete_phase(vehicle, 1, "Takeoff to 20m")

    # ── Phase 2: Hover at takeoff position for 15 seconds ─────────────────────
    hover(vehicle, hover_time)
    complete_phase(vehicle, 2, "Hover for 15s at 20m")

    # ── Phase 3: Return to Home ───────────────────────────────────────────────
    return_to_launch(vehicle)
    complete_phase(vehicle, 3, "Return to Launch")


# ============================================================
# SECTION 12 — COMMAND-LINE ARGUMENT PARSER
# ── Allows overriding CONFIG values at runtime without editing the file.
# ── Example: python drone_flight.py --alt 15 --speed 3 --hover 20
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(description="Autonomous Pixhawk flight script")
    parser.add_argument('--connect', default=CONNECTION_STRING)
    parser.add_argument('--baud',    type=int,   default=BAUD_RATE)
    parser.add_argument('--alt',     type=float, default=TAKEOFF_ALTITUDE)
    parser.add_argument('--speed',   type=float, default=GROUNDSPEED)
    parser.add_argument('--hover',   type=int,   default=HOVER_TIME)
    return parser.parse_args()


# ============================================================
# SECTION 13 — ENTRY POINT
# ── Ties everything together: parse args → connect → preflight → mission.
# ── All exceptions trigger emergency_land() so the drone never stays
# ── airborne if the script crashes.
# ============================================================

if __name__ == "__main__":
    args = parse_args()

    vehicle = None
    try:
        vehicle = connect_vehicle(args.connect, baud=args.baud)

        # Inject vehicle into signal handlers so they can command it
        global _vehicle_ref
        _vehicle_ref = vehicle

        preflight_checks(vehicle)
        run_mission(vehicle, args.alt, args.speed, args.hover)

    except KeyboardInterrupt:
        if vehicle:
            emergency_land(vehicle)

    except Exception as e:
        if vehicle:
            emergency_land(vehicle)

    finally:
        if vehicle:
            vehicle.close()