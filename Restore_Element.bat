@echo off
title Restore Specific Element From Version
set GIT_PATH="C:\Users\Michael Guralnik\.gemini\antigravity\mingit\cmd\git.exe"

echo ----------------------------------------------------
echo Available Versions:
echo ----------------------------------------------------
%GIT_PATH% tag -l
echo ----------------------------------------------------
echo.

set /p version="Enter version to restore from (e.g. 1.0, 1.1): "
if "%version%"=="" (
    echo Version cannot be empty.
    pause
    exit /b
)

set /p filename="Enter file path to restore (e.g. content.json, index.html): "
if "%filename%"=="" (
    echo File path cannot be empty.
    pause
    exit /b
)

echo.
echo Restoring %filename% from version v%version%...
%GIT_PATH% checkout v%version% -- %filename%
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to restore %filename% from version v%version%.
    echo Check that both the version and the file path exist.
    pause
    exit /b
)
echo.
echo SUCCESS: Restored %filename% from version v%version%!
echo The file has been updated in your working directory.
pause
