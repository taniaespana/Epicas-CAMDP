@echo off
REM ============================================
REM  Elimina todas las tareas programadas
REM  de CAMDP Epics Site
REM  Ejecutar como Administrador
REM ============================================

echo Eliminando tareas programadas de CAMDP Epics Site...
echo.

schtasks /delete /tn "CAMDP-Epics-Build-08AM" /f 2>nul
schtasks /delete /tn "CAMDP-Epics-Build-10AM" /f 2>nul
schtasks /delete /tn "CAMDP-Epics-Build-12PM" /f 2>nul
schtasks /delete /tn "CAMDP-Epics-Build-02PM" /f 2>nul
schtasks /delete /tn "CAMDP-Epics-Build-04PM" /f 2>nul
REM Limpieza de tareas antiguas (3 horarios)
schtasks /delete /tn "CAMDP-Epics-Build-8AM" /f 2>nul
schtasks /delete /tn "CAMDP-Epics-Build-5PM" /f 2>nul

echo.
echo Todas las tareas eliminadas.
pause
