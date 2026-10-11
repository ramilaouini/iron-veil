@echo off
title IRON VEIL: BLOOD CIRCUIT
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
echo Starting IRON VEIL: BLOOD CIRCUIT...
npx electron .
