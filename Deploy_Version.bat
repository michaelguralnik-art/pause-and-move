@echo off
title Deploy Website Version
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_version.ps1"
pause
