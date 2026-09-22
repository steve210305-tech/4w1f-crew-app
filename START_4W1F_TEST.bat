@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   4W1F V3 - LOKALER TROCKEN-TEST
echo ==========================================
echo.
echo Die App startet lokal auf http://localhost:8787/
echo Dieses Fenster offen lassen, solange du testest.
echo Zum Beenden: Strg+C oder Fenster schliessen.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-4W1F-Test.ps1"
endlocal
