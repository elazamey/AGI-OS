from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


app = FastAPI(
    title="Celia Agent Runtime",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================
# Models
# ============================================================

@dataclass
class AgentRun:
    run_id: str
    status: str = "created"
    event_id: int = 0
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class CodeUpdate(BaseModel):
    code: str


RUNS: dict[str, AgentRun] = {}
EVENT_QUEUES: dict[str, asyncio.Queue[str]] = {}
RUNTIME_TASKS: dict[str, asyncio.Task[Any]] = {}


# ============================================================
# Helpers
# ============================================================

def make_sse(
    run: AgentRun,
    event_type: str,
    payload: dict[str, Any],
) -> str:
    run.event_id += 1
    run.updated_at = time.time()

    data = {
        "type": event_type,
        "run_id": run.run_id,
        "event_id": run.event_id,
        "timestamp": run.updated_at,
        **payload,
    }

    return (
        f"id: {run.event_id}\n"
        f"event: {event_type}\n"
        f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    )


async def publish(
    run: AgentRun,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    queue = EVENT_QUEUES.get(run.run_id)

    if queue is None:
        return

    await queue.put(
        make_sse(run, event_type, payload)
    )


# ============================================================
# Local Preview
# No external CDN - Local First
# ============================================================

DEFAULT_HTML = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #020617;
            color: white;
            font-family: Arial, sans-serif;
        }

        .card {
            width: min(520px, 90vw);
            padding: 32px;
            border-radius: 18px;
            border: 1px solid #1e293b;
            background: #0f172a;
            text-align: center;
        }

        h1 {
            color: #60a5fa;
            margin-bottom: 12px;
        }

        p {
            color: #cbd5e1;
            line-height: 1.8;
        }

        button {
            margin-top: 16px;
            border: 0;
            border-radius: 10px;
            padding: 12px 18px;
            background: #2563eb;
            color: white;
            cursor: pointer;
        }

        button:hover {
            background: #1d4ed8;
        }
    </style>
</head>

<body>

<div class="card">
    <h1>Celia Agent</h1>

    <p>
        هذه المعاينة تعمل داخل Sandbox مستقل.
    </p>

    <button id="agent-button">
        تفاعل مع الواجهة
    </button>

    <p id="output"></p>
</div>

<script>
    document
        .getElementById("agent-button")
        .addEventListener("click", () => {
            document.getElementById("output").textContent =
                "الوكيل يتفاعل معك الآن 🚀";
        });
</script>

</body>
</html>
"""


# ============================================================
# Agent Runtime
# ============================================================

async def runtime_loop(run: AgentRun) -> None:
    run.status = "running"

    await publish(
        run,
        "run_started",
        {
            "status": "running",
            "mode": "fixture",
        },
    )

    await publish(
        run,
        "phase",
        {
            "name": "observe",
            "status": "running",
        },
    )

    await asyncio.sleep(0.5)

    await publish(
        run,
        "phase",
        {
            "name": "plan",
            "status": "running",
        },
    )

    await asyncio.sleep(0.5)

    await publish(
        run,
        "tool_call",
        {
            "tool": "pnpm verify",
            "status": "running",
        },
    )

    await asyncio.sleep(1)

    await publish(
        run,
        "tool_result",
        {
            "tool": "pnpm verify",
            "status": "success",
            "exit_code": 0,
        },
    )

    await publish(
        run,
        "terminal_log",
        {
            "stream": "stdout",
            "log": "✔ Hygiene PASSED",
        },
    )

    await publish(
        run,
        "terminal_log",
        {
            "stream": "stdout",
            "log": "✔ Build PASSED",
        },
    )

    await publish(
        run,
        "terminal_log",
        {
            "stream": "stdout",
            "log": "✔ Typecheck PASSED",
        },
    )

    await publish(
        run,
        "preview_update",
        {
            "format": "html",
            "html": DEFAULT_HTML,
        },
    )

    await publish(
        run,
        "verification",
        {
            "status": "passed",
        },
    )

    await publish(
        run,
        "run_completed",
        {
            "status": "waiting_for_input",
        },
    )

    run.status = "waiting_for_input"

    # -----------------------------------------------
    # Keep Runtime alive for incoming editor updates
    # -----------------------------------------------

    queue = EVENT_QUEUES[run.run_id]

    while run.status == "waiting_for_input":

        await asyncio.sleep(0.25)


# ============================================================
# Create Run
# ============================================================

@app.post("/api/agent/runs")
async def create_run():
    run_id = str(uuid.uuid4())

    run = AgentRun(run_id=run_id)

    RUNS[run_id] = run
    EVENT_QUEUES[run_id] = asyncio.Queue()

    task = asyncio.create_task(
        runtime_loop(run)
    )

    RUNTIME_TASKS[run_id] = task

    return {
        "run_id": run_id,
        "status": run.status,
    }


# ============================================================
# SSE Stream
# ============================================================

async def stream_events(
    request: Request,
    run: AgentRun,
) -> AsyncGenerator[str, None]:

    queue = EVENT_QUEUES[run.run_id]

    while True:

        if await request.is_disconnected():
            break

        try:
            event = await asyncio.wait_for(
                queue.get(),
                timeout=15,
            )

            yield event

        except asyncio.TimeoutError:

            # SSE heartbeat
            yield ": heartbeat\n\n"


@app.get("/api/agent/runs/{run_id}/stream")
async def agent_stream(
    run_id: str,
    request: Request,
):

    run = RUNS.get(run_id)

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Run not found",
        )

    return StreamingResponse(
        stream_events(request, run),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# Code Update
# ============================================================

@app.post("/api/agent/runs/{run_id}/update")
async def update_agent_code(
    run_id: str,
    update: CodeUpdate,
):

    run = RUNS.get(run_id)

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Run not found",
        )

    if len(update.code) > 1_000_000:
        raise HTTPException(
            status_code=413,
            detail="Code payload too large",
        )

    # --------------------------------------------------------
    # In production:
    #
    # code
    #   ↓
    # parser
    #   ↓
    # policy
    #   ↓
    # sandbox
    #   ↓
    # test
    #   ↓
    # preview
    # --------------------------------------------------------

    await publish(
        run,
        "code_update",
        {
            "status": "received",
            "source": "monaco",
            "bytes": len(update.code.encode("utf-8")),
        },
    )

    # Fixture behavior:
    # use the submitted HTML directly as preview.
    await publish(
        run,
        "preview_update",
        {
            "format": "html",
            "html": update.code,
            "source": "monaco",
        },
    )

    await publish(
        run,
        "verification",
        {
            "status": "pending",
            "reason": "awaiting_real_agent_verification",
        },
    )

    return {
        "accepted": True,
        "run_id": run_id,
    }


# ============================================================
# Cancel Run
# ============================================================

@app.delete("/api/agent/runs/{run_id}")
async def cancel_run(run_id: str):

    run = RUNS.get(run_id)

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Run not found",
        )

    run.status = "cancelled"

    task = RUNTIME_TASKS.get(run_id)

    if task and not task.done():
        task.cancel()

    await publish(
        run,
        "run_cancelled",
        {
            "status": "cancelled",
        },
    )

    return {
        "run_id": run_id,
        "status": "cancelled",
    }


# ============================================================
# Run Status
# ============================================================

@app.get("/api/agent/runs/{run_id}")
async def get_run(run_id: str):

    run = RUNS.get(run_id)

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Run not found",
        )

    return {
        "run_id": run.run_id,
        "status": run.status,
        "event_id": run.event_id,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


# ============================================================
# Health
# ============================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "celia-agent-runtime",
        "active_runs": sum(
            1
            for run in RUNS.values()
            if run.status in {
                "running",
                "waiting_for_input",
            }
        ),
    }
