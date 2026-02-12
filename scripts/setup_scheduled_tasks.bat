@echo off
REM ============================================
REM  Crea tareas programadas en Windows
REM  para regenerar el sitio CAMDP Epics
REM  Horarios: 8am, 10am, 12pm, 2pm, 4pm
REM  Ejecutar como Administrador
REM ============================================

set BAT_PATH=%~dp0rebuild_site.bat

echo Creando tareas programadas para CAMDP Epics Site...
echo.

schtasks /create /tn "CAMDP-Epics-Build-08AM" /tr "\"%BAT_PATH%\"" /sc daily /st 08:00 /f
schtasks /create /tn "CAMDP-Epics-Build-10AM" /tr "\"%BAT_PATH%\"" /sc daily /st 10:00 /f
schtasks /create /tn "CAMDP-Epics-Build-12PM" /tr "\"%BAT_PATH%\"" /sc daily /st 12:00 /f
schtasks /create /tn "CAMDP-Epics-Build-02PM" /tr "\"%BAT_PATH%\"" /sc daily /st 14:00 /f
schtasks /create /tn "CAMDP-Epics-Build-04PM" /tr "\"%BAT_PATH%\"" /sc daily /st 16:00 /f

echo.
echo ============================================
echo  5 tareas creadas exitosamente!
echo ============================================
echo.
echo Horarios configurados:
echo   08:00 AM
echo   10:00 AM
echo   12:00 PM
echo   02:00 PM
echo   04:00 PM
echo.
echo Para verificar:
echo   schtasks /query /tn "CAMDP-Epics-Build-08AM"
echo   schtasks /query /tn "CAMDP-Epics-Build-10AM"
echo   schtasks /query /tn "CAMDP-Epics-Build-12PM"
echo   schtasks /query /tn "CAMDP-Epics-Build-02PM"
echo   schtasks /query /tn "CAMDP-Epics-Build-04PM"
echo.
echo Para eliminar todas:
echo   scripts\remove_scheduled_tasks.bat
echo.
pause
