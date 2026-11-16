@echo off
chcp 65001 >nul
title NYXON - EA reader
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nyxon-ea.ps1"
