@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SERVIDOR_GUIA.ps1"
if errorlevel 1 (
  echo.
  echo No fue posible iniciar la guia.
  pause
)
endlocal
