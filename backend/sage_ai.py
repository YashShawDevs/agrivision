"""
sage_ai.py
──────────
LangChain + Gemini logic with Groq fallback.

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
from langchain_groq import ChatGroq

load_dotenv()

# ── Model setup ───────────────────────────────────────────────────────────────

_gemini_key = os.getenv("GOOGLE_API_KEY")
_groq_key   = os.getenv("GROQ_API_KEY")

if not _gemini_key and not _groq_key:
    raise EnvironmentError("Neither GOOGLE_API_KEY nor GROQ_API_KEY is set in .env")

_gemini_model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key=_gemini_key,
    request_timeout=60,
    max_retries=0,          # no retries — we handle fallback ourselves
) if _gemini_key else None

_groq_model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=_groq_key,
    timeout=60,
    max_retries=1,
) if _groq_key else None


def _invoke_with_fallback(chain_gemini, chain_groq, inputs: dict) -> str:
    """Try Gemini first; on any error fall back to Groq."""
    if chain_gemini is not None:
        try:
            result = chain_gemini.invoke(inputs)
            print("[SAGE] Used Gemini")
            return result
        except Exception as e:
            print(f"[SAGE] Gemini failed ({type(e).__name__}: {str(e)[:120]}), falling back to Groq...")

    if chain_groq is not None:
        result = chain_groq.invoke(inputs)
        print("[SAGE] Used Groq (fallback)")
        return result

    raise RuntimeError("All LLM providers failed — no fallback available")


# ── Load reference DroneKit template ──────────────────────────────────────────

_CODEE_PATH = os.path.join(os.path.dirname(__file__), "codee.txt")

def _load_context() -> str:
    try:
        with open(_CODEE_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "# No reference code available"

# ── Prompt 1: Code generation ─────────────────────────────────────────────────

_CODE_SYSTEM = (
    "You are a drone flight code agent. "
    "Use the DroneKit reference code below as your base template:\n\n{context}\n\n"
    "Modify it to accomplish the user's mission exactly. "
    "Return ONLY valid Python code. No markdown, no code fences, no explanation."
)

_code_prompt = ChatPromptTemplate.from_messages([
    ("system", _CODE_SYSTEM),
    ("human",  "{user_input}")
])

_sage_gemini = (_code_prompt | _gemini_model | StrOutputParser()) if _gemini_model else None
_sage_groq   = (_code_prompt | _groq_model   | StrOutputParser()) if _groq_model   else None

# ── Prompt 2: Mission plan ────────────────────────────────────────────────────

_PLAN_SYSTEM = (
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
    "warnings should be empty [] if no risks are identified."
)

_plan_prompt = ChatPromptTemplate.from_messages([
    ("system", _PLAN_SYSTEM),
    ("human",  "{user_input}")
])

_sage2_gemini = (_plan_prompt | _gemini_model | StrOutputParser()) if _gemini_model else None
_sage2_groq   = (_plan_prompt | _groq_model   | StrOutputParser()) if _groq_model   else None


# ── Public API ────────────────────────────────────────────────────────────────

def generate_script(user_input: str) -> str:
    """
    Generate a DroneKit Python flight script for the given mission.
    Returns the raw Python code as a string.
    """
    context = _load_context()
    print(f"[SAGE] Generating flight script for: '{user_input}'")
    script = _invoke_with_fallback(
        _sage_gemini, _sage_groq,
        {"context": context, "user_input": user_input}
    )
    print("[SAGE] Flight script generated")

    _out_path = os.path.join(os.path.dirname(__file__), "generated_mission.py")
    with open(_out_path, "w", encoding="utf-8") as f:
        f.write(script)
    print(f"[SAGE] Debug: script saved to {_out_path}")

    return script


def generate_plan(user_input: str) -> dict:
    """
    Generate a structured mission plan (summary, phases, confidence).
    Returns a dict matching GenerateMissionResponse fields.
    Raises ValueError if the LLM returns unparseable output.
    """
    print(f"[SAGE] Generating mission plan for: '{user_input}'")
    raw = _invoke_with_fallback(
        _sage2_gemini, _sage2_groq,
        {"user_input": user_input}
    )
    print("[SAGE] Raw plan response received")

    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        plan = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[SAGE] JSON parse error: {e}\nRaw output:\n{raw}")
        raise ValueError(f"LLM returned invalid JSON: {e}")

    required = ["missionSummary", "missionPhases", "confidenceScore",
                "confidenceFactors", "estimatedDuration", "warnings"]
    for key in required:
        if key not in plan:
            raise ValueError(f"Missing key in plan response: '{key}'")

    print(f"[SAGE] Plan parsed: {len(plan['missionPhases'])} phases, "
          f"confidence={plan['confidenceScore']}")
    return plan
