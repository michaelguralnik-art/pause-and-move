@echo off
title Switch Website Version
set GIT_PATH="C:\Users\Michael Guralnik\.gemini\antigravity\mingit\cmd\git.exe"

echo ----------------------------------------------------
echo Available Versions:
echo ----------------------------------------------------
%GIT_PATH% tag -l
echo ----------------------------------------------------
echo.
set /p version="Enter version to view (e.g. 1.0, 1.1) or type 'latest' to return to latest work: "

if "%version%"=="" goto latest
if /i "%version%"=="latest" goto latest

:: Checkout specified version tag
echo Switching to version v%version%...
%GIT_PATH% checkout v%version%
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Version v%version% not found. Make sure the version exists.
    pause
    exit /b
)
echo.
echo SUCCESS: Switched to version v%version%!
echo You can now preview it locally at http://localhost:8080/index.html
pause
exit /b

:latest
echo Returning to latest development version...
%GIT_PATH% checkout main
echo.
echo SUCCESS: Switched back to active development branch (main)!
pause
