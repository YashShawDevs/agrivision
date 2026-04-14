"""
sage_ai.py
──────────
LangChain + Gemini logic refactored from sage_deploy.py.

Two public functions:
  - generate_script(user_input)  → returns Python flight code string
  - generate_plan(user_input)    → returns structured dict for API response
"""

import os
import json
import re
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain.globals import set_debug

# set_debug(False)
load_dotenv()

# ── Model setup ───────────────────────────────────────────────────────────────

_api_key = os.getenv("GOOGLE_API_KEY")
if not _api_key:
    raise EnvironmentError("GOOGLE_API_KEY not set in .env")

_model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key=_api_key
)

# ── Load reference DroneKit template ──────────────────────────────────────────

_CODEE_PATH = os.path.join(os.path.dirname(__file__), "codee.txt")

def _load_context() -> str:
    try:
        with open(_CODEE_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "# No reference code available"

# ── Prompt 1: Code generation (sage) ─────────────────────────────────────────

_code_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a drone flight code agent. "
     "Use the DroneKit reference code below as your base template:\n\n{context}\n\n"
     "Modify it to accomplish the user's mission exactly. "
     "Return ONLY valid Python code. No markdown, no code fences, no explanation."),
    ("human", "{user_input}")
])

_sage = _code_prompt | _model | StrOutputParser()

# ── Prompt 2: Mission plan (sage2) ────────────────────────────────────────────

_plan_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a drone mission planner. "
     "Given a drone mission description, return ONLY a valid JSON object — "
     "no markdown, no code fences, no explanation whatsoever.\n\n"
     "The JSON must follow this exact structure:\n"
     "{{\n"
     "  \"missionSummary\": \"string describing the full flight plan\",\n"
     "  \"missionPhases\": [\n"
     "    {{\"id\": 1, \"name\": \"Phase name\", \"duration\": 10}},\n"
     "    ...\n"
     "  ],\n"
     "  \"confidenceScore\": 85.0,\n"
     "  \"confidenceFactors\": [\n"
     "    {{\"label\": \"Battery Sufficient\", \"value\": 95.0}},\n"
     "    {{\"label\": \"GPS Lock Strong\",    \"value\": 90.0}},\n"
     "    {{\"label\": \"Flight Plan Valid\",  \"value\": 88.0}},\n"
     "    {{\"label\": \"Weather Conditions\", \"value\": 75.0}}\n"
     "  ],\n"
     "  \"estimatedDuration\": 120,\n"
     "  \"warnings\": [\"optional warning strings\"]\n"
     "}}\n\n"
     "Duration values are in seconds. Be realistic with timing. "
     "confidenceScore is the average of all factor values. "
     "warnings should be empty [] if no risks are identified."),
    ("human", "{user_input}")
])

_sage2 = _plan_prompt | _model | StrOutputParser()


# ── Public API ────────────────────────────────────────────────────────────────

def generate_script(user_input: str) -> str:
    """
    Generate a DroneKit Python flight script for the given mission.
    Returns the raw Python code as a string.
    """
    context = _load_context()
    print(f"[SAGE] Generating flight script for: '{user_input}'")
    script = _sage.invoke({"context": context, "user_input": user_input})
    print("[SAGE] Flight script generated")

    # ── DEBUG: save to file so you can inspect it ──────────────
    with open("generated_mission.py", "w", encoding="utf-8") as f:
        f.write(script)
    print("[SAGE] Debug: script saved to generated_mission.py")
    # ──────────────────────────────────────────────────────────

    return script


def generate_plan(user_input: str) -> dict:
    """
    Generate a structured mission plan (summary, phases, confidence).
    Returns a dict matching GenerateMissionResponse fields.
    Raises ValueError if Gemini returns unparseable output.
    """
    print(f"[SAGE] Generating mission plan for: '{user_input}'")
    raw = _sage2.invoke({"user_input": user_input})
    print("[SAGE] Raw plan response received")

    # Strip any accidental markdown fences Gemini might add
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        plan = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[SAGE] JSON parse error: {e}\nRaw output:\n{raw}")
        raise ValueError(f"Gemini returned invalid JSON: {e}")

    # Validate required keys are present
    required = ["missionSummary", "missionPhases", "confidenceScore",
                "confidenceFactors", "estimatedDuration", "warnings"]
    for key in required:
        if key not in plan:
            raise ValueError(f"Missing key in Gemini plan response: '{key}'")

    print(f"[SAGE] Plan parsed: {len(plan['missionPhases'])} phases, "
          f"confidence={plan['confidenceScore']}")
    return plan