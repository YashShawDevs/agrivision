#!/usr/bin/env bash
# start.sh — launch both backend and frontend
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ─────────────────────────────────────────────────────────────────
echo "🚀  Starting backend on :8000 ..."
cd "$ROOT/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️   Created .env from .env.example — add your GOOGLE_API_KEY before generating missions"
fi

if ! python -c "import fastapi" 2>/dev/null; then
  echo "📦  Installing Python dependencies..."
  pip install -r requirements.txt -q
fi

uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "🖥️   Starting frontend on :8080 ..."
cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "📦  Installing npm dependencies..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅  Running:"
echo "   Backend  → http://localhost:8000"
echo "   Frontend → http://localhost:8080"
echo "   API docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."

# On exit, kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
