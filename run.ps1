# TRAt Windows Startup Script
$ErrorActionPreference = "Stop"

Write-Host "=== Setting up TRAt Development Environment ===" -ForegroundColor Cyan

# 1. Check for Python virtual environment
if (-not (Test-Path "backend\.venv")) {
    Write-Host "[+] Creating python virtual environment in backend\.venv..." -ForegroundColor Yellow
    python -m venv backend\.venv
}

# 2. Upgrade pip and install requirements
Write-Host "[+] Verifying and installing dependencies..." -ForegroundColor Yellow
& backend\.venv\Scripts\python.exe -m pip install --upgrade pip
& backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 3. Start FastAPI server
Write-Host "[+] Starting FastAPI server at http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "[+] Swagger docs will be available at http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "[!] Press Ctrl+C to terminate the server." -ForegroundColor Red

# Change directory and run uvicorn
Push-Location backend
try {
    & .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
}
