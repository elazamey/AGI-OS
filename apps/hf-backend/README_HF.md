---
title: AGI-OS Backend
emoji: 🧠
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
---

# AGI-OS Backend

AGI Operating System - Backend API Service

## Features

- 🤖 Multi-provider LLM routing (NVIDIA NIM, OpenAI, Ollama)
- 🧠 Persistent memory with vector search
- 🔒 Governance and security gates
- 📊 Real-time monitoring
- 🚀 Zero-cost deployment

## API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Chat completion
- `POST /api/missions` - Create mission
- `GET /api/missions/:id` - Get mission status
- `GET /api/memory` - Query memory

## Environment Variables

- `NVIDIA_API_KEY` - NVIDIA NIM API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key

## Local Development

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 7860
```
