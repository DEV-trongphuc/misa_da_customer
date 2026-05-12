@echo off
echo Starting MISA Dashboard Server via Node.js...
start npx --yes http-server -p 8000 -c-1
timeout /t 3 > nul
start http://localhost:8000
echo Server is running dynamically!
pause > nul
