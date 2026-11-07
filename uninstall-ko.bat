@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "AGY_EXE=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
if not exist "%AGY_EXE%" set "AGY_EXE=%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe"
if not exist "%AGY_EXE%" set "AGY_EXE=C:\Program Files\Antigravity\Antigravity.exe"

if exist "%AGY_EXE%" (
  set "ELECTRON_RUN_AS_NODE=1"
  "%AGY_EXE%" "%~dp0tools\patch.js" uninstall %*
) else (
  where node >nul 2>nul
  if %ERRORLEVEL% equ 0 (
    node "%~dp0tools\patch.js" uninstall %*
  ) else (
    echo [ERROR] Antigravity.exe or Node.js not found.
    pause
    exit /b 1
  )
)
echo.
pause
