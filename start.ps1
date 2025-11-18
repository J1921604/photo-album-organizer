# Photo Album Organizer Startup Script
# Run: .\start.ps1

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Starting Photo Album Organizer..." -ForegroundColor Cyan

npm run dev
