# start.ps1 — launch backend + frontend in separate windows
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting backend on :8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT\backend'; .\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting frontend ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Both services starting in separate windows:" -ForegroundColor Green
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Frontend -> http://localhost:8080 (or 8081 if 8080 is in use)" -ForegroundColor Yellow
Write-Host "  API docs -> http://localhost:8000/docs" -ForegroundColor Yellow
