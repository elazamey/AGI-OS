# ============================================================================
# AGI OS — Makefile
# ============================================================================

.PHONY: help install build test dev up down logs clean

# Default target
help:
	@echo "AGI OS — Available Commands:"
	@echo "  make install    Install all dependencies"
	@echo "  make build      Build all packages"
	@echo "  make test       Run all 909 tests"
	@echo "  make dev        Start dashboard in dev mode"
	@echo "  make up         Start all services (Docker)"
	@echo "  make up-test    Start services + run tests"
	@echo "  make down       Stop all services"
	@echo "  make logs       View service logs"
	@echo "  make clean      Remove node_modules and dist"

# ---------------------------------------------------------------------------
# Local Development
# ---------------------------------------------------------------------------

install:
	pnpm install

build:
	pnpm build

test:
	pnpm test

dev:
	pnpm dashboard

# ---------------------------------------------------------------------------
# Docker Deployment
# ---------------------------------------------------------------------------

up:
	docker compose up -d --build

up-test:
	docker compose --profile test up --build

down:
	docker compose down

logs:
	docker compose logs -f

logs-ollama:
	docker compose logs -f ollama

logs-dashboard:
	docker compose logs -f dashboard

# Pull Ollama model into container
ollama-pull:
	docker compose exec ollama ollama pull llama3.2:latest

# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------

clean:
	rm -rf node_modules packages/*/node_modules packages/*/dist
	docker compose down -v

# Run tests in Docker
test-docker:
	docker compose --profile test run --rm agi-os-test
