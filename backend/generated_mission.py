import time
import math
import sys
import signal
import argparse
import requests
from dronekit import connect, VehicleMode
from pymavlink import mavutil


CONNECTION_STRING = '/dev/ttyAMA0'  
BAUD_RATE         = 921600          

TAKEOFF_ALTITUDE  = 10             
GROUNDSPEED       = 2.0            
HOVER_TIME        = 10              

ARRIVAL_THRESHOLD = 1.5             
COMMAND_TIMEOUT   = 30              

BACKEND_URL       = "http://192.168.1.100:8000"  


_vehicle_ref = None  

def _handle_rth(sig, frame):
    print("[SAGE] RTH signal received — switching to RTL mode")
    if _vehicle_ref:
        _vehicle_ref.mode = VehicleMode("RTL")
    sys.exit(0)

def _handle_abort(sig, frame):
    print("[SAGE] Abort signal received — switching to LAND mode")
    if _vehicle_ref:
        _vehicle_ref.mode = VehicleMode("LAND")
    sys.exit(0)

signal.signal(signal.SIGTERM, _handle_rth)
signal.signal(signal.SIGINT,  _handle_abort)


def complete_phase(vehicle, phase_id: int, phase_name: str):
    try:
        requests.post(
            f"{BACKEND_URL}/api/phase-update",
            json={
                "phaseId":     phase_id,
                "phaseStatus": "completed",
                "phaseName":   phase_name,
                "telemetry": {
                    "battery":   vehicle.battery.level,
                    "altitude":  round(vehicle.location.global_relative_frame.alt, 2),
                    "latitude":  vehicle.location.global_frame.lat,
                    "longitude": vehicle.location.global_frame.lon,
                    "gpsLock":   vehicle.gps_0.fix_type >= 3,
                }
            },
            timeout=3   
        )
        print(f"[SAGE] Phase {phase_id} '{phase_name}' reported complete")
    except Exception as e:
        print(f"[SAGE] Phase report skipped (backend unreachable): {e}")


def connect_vehicle(connection_string, baud=921600):
    vehicle = connect(connection_string, baud=baud, wait_ready=True, timeout=60)
    return vehicle


def preflight_checks(vehicle):
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


def arm_and_takeoff(vehicle, target_altitude):
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


def goto_ned_position(vehicle, north, east, alt, groundspeed=None):
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


def hover(vehicle, duration):
    for _ in range(duration):
        if vehicle.mode.name != "GUIDED":
            sys.exit(1)
        time.sleep(1)


def return_to_launch(vehicle):
    vehicle.mode = VehicleMode("RTL")
    while vehicle.mode.name != "RTL":
        time.sleep(0.5)
    while vehicle.armed:
        time.sleep(2)


def emergency_land(vehicle):
    vehicle.mode = VehicleMode("LAND")
    while vehicle.armed:
        time.sleep(2)


def run_mission(vehicle, takeoff_alt, groundspeed, hover_time):
    arm_and_takeoff(vehicle, takeoff_alt)
    complete_phase(vehicle, 1, "Takeoff")

    goto_ned_position(vehicle, north=20, east=0, alt=takeoff_alt, groundspeed=groundspeed)
    complete_phase(vehicle, 2, "Moved 20m")

    return_to_launch(vehicle)
    complete_phase(vehicle, 3, "Return to Launch")


def parse_args():
    parser = argparse.ArgumentParser(description="Autonomous Pixhawk flight script")
    parser.add_argument('--connect', default=CONNECTION_STRING)
    parser.add_argument('--baud',    type=int,   default=BAUD_RATE)
    parser.add_argument('--alt',     type=float, default=TAKEOFF_ALTITUDE)
    parser.add_argument('--speed',   type=float, default=GROUNDSPEED)
    parser.add_argument('--hover',   type=int,   default=HOVER_TIME)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    vehicle = None
    try:
        vehicle = connect_vehicle(args.connect, baud=args.baud)

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