@echo off
setlocal enableextensions

for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Valve\Steam" /v SteamPath 2^>nul ^| find "SteamPath"') do set "STEAM_DIR=%%B"

echo Restarting Steam...
taskkill /IM steam.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

if defined STEAM_DIR (
  start "" "%STEAM_DIR%\Steam.exe" -clearbeta
) else (
  start "" steam.exe -clearbeta
)

exit

