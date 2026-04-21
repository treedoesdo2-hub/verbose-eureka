@echo off
setlocal
cd /d "%~dp0app"
echo.
echo === merc-autobattler ===
echo Launching dev build (first run will build; window will open when ready)
echo.
call npm run dev
if errorlevel 1 (
  echo.
  echo !!! dev launch failed with errorlevel %errorlevel%
  echo press any key to close this window
  pause >nul
)
endlocal
