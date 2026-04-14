import os
import paramiko
from dotenv import load_dotenv
from mission_store import store

load_dotenv()

PI_HOST          = os.getenv("PI_HOST", "10.29.186.253")
PI_USER          = os.getenv("PI_USER", "aerovision")
PI_PASSWORD      = os.getenv("PI_PASSWORD", "12345678")
PI_KEY_PATH      = os.getenv("PI_KEY_PATH", None)

PI_REMOTE_SCRIPT = os.getenv(
    "PI_SCRIPT_PATH",
    "/home/aerovision/drone/sage_mission.py"
)

PI_VENV_PATH     = os.getenv(
    "PI_VENV_PATH",
    "/home/aerovision/drone/venv"
)

# drone_control.py — add at top
import time

SIMULATION_MODE = os.getenv("SIMULATION_MODE", "false").lower() == "true"

def deploy_and_run(script_str):
    if SIMULATION_MODE:
        print("[SIM] Simulating mission execution...")
        time.sleep(3)   # brief pause so UI shows "executing" state
        return True     # always succeeds in sim mode

def _connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        if PI_KEY_PATH:
            client.connect(
                PI_HOST,
                username=PI_USER,
                key_filename=PI_KEY_PATH,
                timeout=10
            )
        else:
            client.connect(
                PI_HOST,
                username=PI_USER,
                password=PI_PASSWORD,
                timeout=10
            )
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
    client = _connect()
    if not client:
        return False

    try:
        client.exec_command(f"pkill -SIGTERM -f {PI_REMOTE_SCRIPT}")
        client.close()
        return True
    except:
        return False
