#!/bin/bash
# AGI-OS Deployment Script

set -e

echo "🚀 Starting AGI-OS Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🔄 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking service health..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "✅ API Server is healthy"
else
  echo "⚠️ API Server is not responding yet"
fi

echo ""
echo "🎉 AGI-OS is running!"
echo ""
echo "📋 Services:"
echo "   - API Server: http://localhost:3000"
echo "   - Ollama: http://localhost:11434"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001"
echo ""
echo "📊 Grafana Login: admin / ${GRAFANA_PASSWORD:-admin}"
echo ""
echo "🛑 To stop: docker-compose down"
echo "🗑️ To remove all data: docker-compose down -v"
