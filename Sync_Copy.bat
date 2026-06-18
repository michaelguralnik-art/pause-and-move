@echo off
title Sync Website Copy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_copy.ps1"
pause
