# start.ps1 — launch backend + frontend in separate windows
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Kill any existing backend on port 8000 ──────────────────────────────────
Write-Host "Checking for existing processes on :8000 ..." -ForegroundColor Gray
$pids = (netstat -ano | Select-String ":8000.*LISTENING") -replace '.*\s+(\d+)$','$1' | Sort-Object -Unique
foreach ($p in $pids) {
    if ($p -match '^\d+$') {
        Write-Host "  Killing PID $p" -ForegroundColor Gray
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host "Starting backend on :8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT\backend'; .\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── Frontend ─────────────────────────────────────────────────────────────────
Write-Host "Starting frontend ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Both services starting in separate windows:" -ForegroundColor Green
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Frontend -> http://localhost:8080 (or 8081 if 8080 is in use)" -ForegroundColor Yellow
Write-Host "  API docs -> http://localhost:8000/docs" -ForegroundColor Yellow
