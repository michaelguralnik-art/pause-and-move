@echo off
title Pause & Move Local Preview Server
echo Starting local preview server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_preview.ps1"
pause
