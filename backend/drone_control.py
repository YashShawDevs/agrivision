"""
drone_control.py
────────────────
SSH deploy + execute on Raspberry Pi.
When sim.mission_sim is True (toggled via /api/sim-mode/mission),
the entire SSH/Pi path is bypassed — returns True after a short delay
so the frontend simulation runs normally without any real drone.
"""
import os, time
import paramiko
from dotenv import load_dotenv
from mission_store import store
from sim_store import sim

load_dotenv()

PI_HOST          = os.getenv("PI_HOST",        "10.29.186.253")
PI_USER          = os.getenv("PI_USER",        "aerovision")
PI_PASSWORD      = os.getenv("PI_PASSWORD",    "12345678")
PI_KEY_PATH      = os.getenv("PI_KEY_PATH",    None)
PI_REMOTE_SCRIPT = os.getenv("PI_SCRIPT_PATH", "/home/aerovision/drone/sage_mission.py")
PI_VENV_PATH     = os.getenv("PI_VENV_PATH",   "/home/aerovision/drone/venv")


def _connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        if PI_KEY_PATH:
            client.connect(PI_HOST, username=PI_USER, key_filename=PI_KEY_PATH, timeout=10)
        else:
            client.connect(PI_HOST, username=PI_USER, password=PI_PASSWORD, timeout=10)
        print(f"[SSH] Connected to {PI_HOST}")
        return client
    except Exception as e:
        print(f"[SSH] Connection failed: {e}")
        return None


def _upload_script(client, script_str):
    try:
        if not script_str or not script_str.strip():
            print("[ERROR] Script empty")
            return False
        sftp = client.open_sftp()
        with sftp.file(PI_REMOTE_SCRIPT, "w") as f:
            f.write(script_str)
        sftp.close()
        print("[SFTP] Upload successful")
        return True
    except Exception as e:
        print(f"[SFTP] Upload failed: {e}")
        return False


def deploy_and_run(script_str):
    # ── SIMULATION MODE ──────────────────────────────────────────────────────
    if sim.mission_sim:
        print("[SIM] Simulation mode ON — skipping SSH, simulating mission...")
        # Sleep so the frontend phase timers can run their natural duration.
        # The frontend advances phases on its own 1s timer; we just need
        # to stay alive long enough. 60s covers most AI-generated missions.
        time.sleep(60)
        print("[SIM] Simulated mission complete")
        return True

    # ── REAL RPi PATH ─────────────────────────────────────────────────────────
    client = _connect()
    if not client:
        return False

    store.ssh_client = client

    if not _upload_script(client, script_str):
        client.close()
        store.ssh_client = None
        return False

    command = (
        f"bash -c 'source {PI_VENV_PATH}/bin/activate && "
        f"python -u {PI_REMOTE_SCRIPT}'"
    )

    try:
        stdin, stdout, stderr = client.exec_command(command)

        print("\n─── Pi Output ───────────────────────────────")
        for line in iter(stdout.readline, ""):
            print("[Pi]", line, end="")
        print("─────────────────────────────────────────────\n")

        errors = stderr.read().decode()
        if errors:
            print("[Pi Errors]")
            print(errors)

        exit_code = stdout.channel.recv_exit_status()
        return exit_code == 0

    except Exception as e:
        print(f"[SSH] Execution error: {e}")
        return False

    finally:
        client.close()
        store.ssh_client = None
        print("[SSH] Closed")


def abort():
    if sim.mission_sim:
        print("[SIM] Abort in sim mode — no-op")
        return True
    client = _connect()
    if not client:
        return False
    try:
        client.exec_command(f"pkill -f {PI_REMOTE_SCRIPT}")
        client.close()
        return True
    except:
        return False


def return_to_home():
    if sim.mission_sim:
        print("[SIM] RTH in sim mode — no-op")
        return True
    client = _connect()
    if not client:
        return False
    try:
        client.exec_command(f"pkill -SIGTERM -f {PI_REMOTE_SCRIPT}")
        client.close()
        return True
    except:
        return False
