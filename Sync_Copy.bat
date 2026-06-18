@echo off
title Sync Website Copy
echo ----------------------------------------------------
echo Pause & Move Copy Sync Selector
echo ----------------------------------------------------
echo [1] Sync from remote Google Sheet (will fetch remote columns)
echo [2] Sync from local translations_template.csv (SOURCE OF TRUTH)
echo ----------------------------------------------------
echo.
set /p choice="Select source [1 or 2, default 2]: "

if "%choice%"=="1" (
    echo Syncing from remote Google Sheet...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_copy.ps1"
) else (
    echo Syncing from local translations_template.csv...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_copy.ps1" -CsvPath "%~dp0translations_template.csv"
)
echo.
pause
