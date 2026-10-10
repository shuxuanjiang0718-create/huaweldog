@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then open this launcher again.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  call npm install --no-audit --no-fund
  if errorlevel 1 exit /b 1
  call npm run build
  if errorlevel 1 exit /b 1
)
node scripts\serve.mjs --open
pause
