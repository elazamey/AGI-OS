@echo off
REM AGI-OS Deployment Script for Windows

echo Starting AGI-OS Deployment...

REM Check if Docker is running
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Build and start services
echo Building Docker images...
docker-compose build

echo Starting services...
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to be ready...
timeout /t 10 /nobreak > nul

REM Check health
echo Checking service health...
curl -f http://localhost:3000/api/health > nul 2>&1
if %errorlevel% equ 0 (
    echo API Server is healthy
) else (
    echo API Server is not responding yet
)

echo.
echo AGI-OS is running!
echo.
echo Services:
echo    - API Server: http://localhost:3000
echo    - Ollama: http://localhost:11434
echo    - PostgreSQL: localhost:5432
echo    - Redis: localhost:6379
echo    - Prometheus: http://localhost:9090
echo    - Grafana: http://localhost:3001
echo.
echo Grafana Login: admin / admin
echo.
echo To stop: docker-compose down
echo To remove all data: docker-compose down -v
