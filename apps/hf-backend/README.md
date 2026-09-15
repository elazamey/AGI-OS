---
title: AGI-OS Backend
emoji: 🧠
colorFrom: cyan
colorTo: purple
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
short_description: Cognitive Agent OS — OpenAI-compatible API + governed chat UI
---

# AGI-OS Space backend

One ASGI process on :7860 serving **both** surfaces, because they used to be two
files that each forgot the other:

| Path | Purpose |
|---|---|
| `/` | Gradio chat UI (`ui.py`, mounted at `/`) |
| `/health`, `/ready`, `/metrics` | liveness / readiness / Prometheus counters |
| `/v1/models`, `/v1/chat/completions` | OpenAI-compatible endpoint (non-stream, SSE stream, tools, `response_format`) |
| `/api/v1/missions/execute`, `/api/v1/missions[/{id}][/rollback]` | governed mission lifecycle + ledger events |
| `/api/v1/approvals`, `/api/v1/approvals/{id}/{approve\|reject}` | human-in-the-loop |
| `/api/v1/skills`, `/api/v1/skills/synthesize` | skill registry; synthesized skills pass the policy gate before registration |
| `/api/v1/memory/{store,query}`, `/api/v1/self-model`, `/api/integrations/status` | memory + introspection |

## Why `app.py` no longer calls `demo.launch()`

The deployed Space ran `app.py`, which served only the Gradio page. `/health`,
`/v1/models` and `/v1/chat/completions` lived in `main.py` and were never started —
so the Space reported "Running", the UI's status chips read *Disconnected*, and
`curl …/health` returned `{"detail":"Not Found"}`. `app.py` now boots
`main.app_for_server` (FastAPI with Gradio mounted), and the Dockerfile's
`uvicorn main:app` describes the same app.

## Configuration

| env | default | effect |
|---|---|---|
| `PORT` | `7860` | bind port (HF Spaces expects 7860) |
| `AGI_OS_API_KEYS` | *(unset = open)* | comma-separated bearer keys; when set, governed routes are deny-by-default (401 without a valid key) |
| `AGI_OS_MAX_BODY_BYTES` | `1048576` | larger bodies answer `413` instead of being buffered |
| `AGI_OS_MOUNT_UI` | `1` | `0` serves the API only (used when gradio must not load) |
| `AGI_OS_LOG_LEVEL` | `info` | uvicorn log level |

With no keys configured the Space is intentionally open, and introspection routes
return a shallow payload (no mission ids, no cost fields) — `tests/production`
asserts exactly that invariant.

## Governance

`governance.py` mirrors `@agi-os/governance` (Python can't import the workspace
packages). Requests are normalised (zero-width/bidi stripping, NFKC folding,
whitespace collapsing) before matching, destructive phrases always block, and
ambiguous words (`dd`, `format`, `crontab`) only fire next to an execution verb or a
shell metacharacter — otherwise the gate blocks "the crontab entry was formatted
nicely" and someone turns the gate off.

## Develop

```bash
pip install -r requirements.txt
python app.py                       # UI + API on http://127.0.0.1:7860
uvicorn main:app --reload           # API only
python3 -m unittest -v test_governance   # stdlib tests (no pytest needed)

# certify a running instance from the repo root:
AGIOS_BASE_URL=http://127.0.0.1:7860 npm run certify:production
```
