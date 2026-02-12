@echo off
REM ============================================
REM  Rebuild CAMDP Epics Site
REM  1. Extrae datos frescos de Jira (token)
REM  2. Genera el sitio estatico
REM  Logs en: logs/build.log
REM ============================================

cd /d "%~dp0\.."

REM Crear carpeta de logs si no existe
if not exist "logs" mkdir "logs"

set LOGFILE=logs\build.log

echo ================================================== >> "%LOGFILE%"
echo [%date% %time%] Iniciando ciclo completo... >> "%LOGFILE%"
echo ================================================== >> "%LOGFILE%"

call .venv\Scripts\activate.bat

REM Paso 1: Extraer epicas de Jira
echo [%date% %time%] Extrayendo epicas de Jira... >> "%LOGFILE%"
python src/extract_epics.py >> "%LOGFILE%" 2>&1

REM Paso 1b: Extraer todos los issues de Jira
echo [%date% %time%] Extrayendo todos los issues... >> "%LOGFILE%"
python src/extract_all_issues.py >> "%LOGFILE%" 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR en extraccion de Jira, codigo %ERRORLEVEL% >> "%LOGFILE%"
    echo [%date% %time%] Continuando con datos existentes... >> "%LOGFILE%"
)

REM Paso 2: Generar sitio estatico
echo [%date% %time%] Generando sitio... >> "%LOGFILE%"
python src/build.py >> "%LOGFILE%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] BUILD OK >> "%LOGFILE%"
) else (
    echo [%date% %time%] BUILD FALLO con codigo %ERRORLEVEL% >> "%LOGFILE%"
    goto :end
)

REM Paso 3: Push a Git para actualizar GitHub Pages
set GIT="%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

echo [%date% %time%] Haciendo push a Git... >> "%LOGFILE%"
%GIT% add docs/ data/epics.json data/all_issues.json >> "%LOGFILE%" 2>&1
%GIT% commit -m "auto: rebuild site %date% %time%" >> "%LOGFILE%" 2>&1
%GIT% push >> "%LOGFILE%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] GIT PUSH OK >> "%LOGFILE%"
) else (
    echo [%date% %time%] GIT PUSH FALLO con codigo %ERRORLEVEL% >> "%LOGFILE%"
)

:end
echo. >> "%LOGFILE%"
