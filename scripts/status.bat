@echo off
REM ============================================
REM  Estado de las tareas programadas CAMDP
REM  y ultimas ejecuciones del build
REM ============================================

cd /d "%~dp0\.."

echo.
echo ==== TAREAS PROGRAMADAS ====
echo.
schtasks /query /tn "CAMDP-Epics-Build-08AM" /fo LIST 2>nul || echo   [!] Tarea 08AM no encontrada
echo.
schtasks /query /tn "CAMDP-Epics-Build-10AM" /fo LIST 2>nul || echo   [!] Tarea 10AM no encontrada
echo.
schtasks /query /tn "CAMDP-Epics-Build-12PM" /fo LIST 2>nul || echo   [!] Tarea 12PM no encontrada
echo.
schtasks /query /tn "CAMDP-Epics-Build-02PM" /fo LIST 2>nul || echo   [!] Tarea 02PM no encontrada
echo.
schtasks /query /tn "CAMDP-Epics-Build-04PM" /fo LIST 2>nul || echo   [!] Tarea 04PM no encontrada

echo.
echo ==== ULTIMAS 20 LINEAS DEL LOG ====
echo.
if exist "logs\build.log" (
    powershell -Command "Get-Content 'logs\build.log' -Tail 20"
) else (
    echo   [!] No hay log todavia. Ejecuta: scripts\rebuild_site.bat
)

echo.
pause
