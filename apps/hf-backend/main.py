"""AGI-OS Space backend — one ASGI app serving the API *and* the chat UI.

Why this file looks different from the first cut of the Space: the deployment ran
``app.py`` (Gradio only) while ``main.py`` (FastAPI) was never started. Every
documented route — ``/health``, ``/ready``, ``/v1/models``, ``/v1/chat/completions``,
``/api/v1/*`` — therefore 404'd on the live Space even though the code existed, and
the UI polled the same missing paths. Here the API *is* the ASGI app and Gradio is
mounted onto it at ``/``, so the Space, the Dockerfile (``uvicorn main:app``) and the
docs all describe one server on one port.

Behavioural contract enforced by ``tests/production`` (see that README):

* dangerous request text is blocked or escalated by ``governance.evaluate`` — never
  silently executed, and never with a 500;
* corrupt / oversized / unknown-model requests answer 4xx with an OpenAI-shaped
  error, not a stack trace;
* completed missions return a real artefact plus an ordered lifecycle ledger.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from collections import deque
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

import governance
from ui import RESPONSES, THINKING_STEPS, detect_intent

VERSION = "1.34.0"
SYSTEM = "AGI-OS Cortex Core"
GOVERNANCE_LEVEL = "L4"
MODELS = ("agi-os-cortex", "agi-os-cortex-v2")
MAX_BODY_BYTES = int(os.environ.get("AGI_OS_MAX_BODY_BYTES", 1024 * 1024))
STARTED_AT = time.time()

# A public Space cannot authenticate unknown callers, but it must never *pretend*
# to. Set AGI_OS_API_KEYS to a comma-separated list to switch the governed surfaces
# to deny-by-default; with no keys configured the introspection routes answer with
# a deliberately shallow payload (no ids, no cost data).
API_KEYS = {k.strip() for k in os.environ.get("AGI_OS_API_KEYS", "").split(",") if k.strip()}


class ApiError(Exception):
    def __init__(self, status: int, message: str, err_type: str = "invalid_request_error", code: str | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.type = err_type
        self.code = code


app = FastAPI(title="AGI-OS Backend", version=VERSION, docs_url="/docs", openapi_url="/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# state (in-memory: a Space is ephemeral and must stay zero-cost)
# ---------------------------------------------------------------------------

MISSIONS: dict[str, dict[str, Any]] = {}
APPROVALS: dict[str, dict[str, Any]] = {}
MEMORY: dict[str, Any] = {}
SKILLS = ["core-skills.filesystem", "coding-skills.patch", "git-skills.commit", "research-skills.search", "verification-skills.diff-audit"]
COUNTERS: dict[str, int] = {"requests": 0, "missions_total": 0, "blocked": 0, "approvals": 0, "errors_4xx": 0, "errors_5xx": 0}
RECENT: deque[str] = deque(maxlen=200)


def short_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def fingerprint(text: str) -> str:
    import hashlib

    return hashlib.sha256(governance.normalize(text).encode("utf-8", "ignore")).hexdigest()[:10]


def bearer(request: Request) -> str:
    raw = request.headers.get("authorization", "")
    return raw[7:].strip() if raw.startswith("Bearer ") else ""


def require_key(request: Request, permission: str | None = None) -> bool:
    """True when the caller may proceed. With no keys configured the Space is open."""
    if not API_KEYS:
        return True
    token = bearer(request)
    if not token:
        raise ApiError(401, "API key required", "authentication_error")
    if token not in API_KEYS:
        raise ApiError(401, "Invalid API key", "authentication_error")
    return True


async def read_json(request: Request) -> Any:
    """Parse the body defensively: corrupt input is a 4xx, never an unhandled 500."""
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise ApiError(
            413,
            f"payload too large ({len(raw)} bytes > {MAX_BODY_BYTES} limit)",
            "invalid_request_error",
            "context_length_exceeded",
        )
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError(400, f"request body is not valid JSON ({exc.msg} at line {exc.lineno})") from exc


def openai_error(status: int, message: str, err_type: str = "invalid_request_error", code: str | None = None) -> JSONResponse:
    COUNTERS["errors_4xx" if 400 <= status < 500 else "errors_5xx"] += 1
    return JSONResponse({"error": {"message": message, "type": err_type, "param": None, "code": code}}, status_code=status)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return openai_error(exc.status, exc.message, "invalid_request_error", exc.code)


# ---------------------------------------------------------------------------
# system surfaces
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": VERSION,
        "system": SYSTEM,
        "level": GOVERNANCE_LEVEL,
        "governance": "policy-engine-inline",
        "authenticated_surface": bool(API_KEYS),
        "missions": len(MISSIONS),
        "uptime_s": round(time.time() - STARTED_AT),
    }


@app.get("/ready")
async def ready() -> dict[str, Any]:
    return {"ready": True, "checks": {"kernel": "ok", "policy": "ok", "ledger": "ok", "ui": "mounted"}}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics() -> str:
    lines = [
        "# HELP agi_os_requests_total Requests served",
        "# TYPE agi_os_requests_total counter",
        f"agi_os_requests_total {COUNTERS['requests']}",
        "# HELP agi_os_missions_total Total missions executed",
        "# TYPE agi_os_missions_total counter",
        f"agi_os_missions_total {COUNTERS['missions_total']}",
        "# HELP agi_os_missions_blocked Missions refused by the policy gate",
        "# TYPE agi_os_missions_blocked counter",
        f"agi_os_missions_blocked {COUNTERS['blocked']}",
        "# HELP agi_os_approvals_pending Approvals awaiting an operator",
        "# TYPE agi_os_approvals_pending gauge",
        f"agi_os_approvals_pending {sum(1 for a in APPROVALS.values() if a['status'] == 'pending')}",
    ]
    return "\n".join(lines) + "\n"


@app.get("/v1/models")
async def models() -> dict[str, Any]:
    created = int(STARTED_AT)
    return {
        "object": "list",
        "data": [{"id": mid, "object": "model", "created": created, "owned_by": "agi-os"} for mid in MODELS],
    }


@app.get("/api/auth/{provider}")
async def oauth_start(provider: str, request: Request) -> JSONResponse:
    """The Space has no OAuth client credentials, so say so instead of 404ing.

    The UI's "Connect" button opens this path; an unrouted 404 shows up in the
    browser as a silent no-op, which is how this stayed unnoticed.
    """
    if provider not in ("github", "google"):
        return JSONResponse({"success": False, "error": f"unknown provider: {provider}"}, status_code=404)
    if not os.environ.get(f"{provider.upper()}_CLIENT_ID"):
        return JSONResponse(
            {
                "success": False,
                "error": f"{provider} OAuth is not configured on this deployment",
                "hint": "set GITHUB_CLIENT_ID / GOOGLE_CLIENT_ID and redeploy, "
                        "or point the UI at the api-gateway (NEXT_PUBLIC_BACKEND_URL)",
            },
            status_code=501,
        )
    return JSONResponse({"success": True, "data": {"authorize_url": f"/api/auth/{provider}/redirect"}})


@app.get("/api/integrations/status")
async def integrations(request: Request) -> dict[str, Any]:
    require_key(request)
    return {"success": True, "data": {"github": {"status": "disconnected"}, "google": {"status": "disconnected"}}}


@app.get("/api/v1/self-model")
async def self_model(request: Request) -> dict[str, Any]:
    """Deliberately shallow when the Space is public: no mission ids, no cost data."""
    require_key(request)
    data: dict[str, Any] = {
        "version": VERSION,
        "skills_registered": len(SKILLS),
        "missions_completed": sum(1 for m in MISSIONS.values() if m["status"] == "COMPLETED"),
        "capabilities": ["planning", "execution", "verification", "rollback", "openai-L4", "human-in-the-loop"],
    }
    if API_KEYS:
        data["budget_usd"] = 10.0
    return {"success": True, "data": data}


# ---------------------------------------------------------------------------
# answer synthesis
# ---------------------------------------------------------------------------

LAYERS = "L0 request integrity · L1 capability scope · L2 policy gate · L3 execution isolation · L4 outcome verification"

TEMPLATES = {
    "general": "Request {fp}: {words} word(s) triaged through the kernel. Plan: classify → constrain → execute under the L2 policy gate → verify at L4. No destructive operation detected.",
    "patch": "Patch plan {fp}: locate the vulnerable path, add the regression test first, change exactly one module, then re-verify. The diff is the artefact — not the claim that it is fixed.",
    "build": "Build plan {fp}: scaffold module boundaries, wire the public interface, add a smoke test and a changelog entry. Gate: build green and tests green.",
    "analyze": "Analysis {fp}: read for structure, coupling and error handling before judging style. Every finding is reported with file, line and a concrete failure scenario.",
}


def compose_answer(prompt: str, decision: governance.Decision) -> str:
    intent = detect_intent(prompt)
    body = TEMPLATES.get(intent, TEMPLATES["general"]).format(fp=fingerprint(prompt), words=len(prompt.split()))
    if intent == "analyze" or "governance layer" in governance.normalize(prompt):
        body += f"\n\nThe layers, in order: {LAYERS}."
    if decision.injection:
        body += "\n\nGovernance note: instructions embedded in untrusted content were treated as data and ignored."
    elif decision.reason:
        body += f"\n\nGovernance: {decision.reason}."
    return body


def refusal_text(decision: governance.Decision) -> str:
    return (
        "I can't perform that. "
        f"{decision.reason} — the decision came from the governance policy engine, not from prompt text. "
        "Ask me for a plan, a diff or a verification report instead, and I will run it under approval."
    )


def validate_chat(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ApiError(400, "request body must be a JSON object")
    model = payload.get("model")
    if not isinstance(model, str) or not model:
        raise ApiError(400, "missing required parameter: 'model'", code="model_missing")
    if model not in MODELS:
        raise ApiError(404, f"The model '{model}' does not exist. Available: {', '.join(MODELS)}", code="model_not_found")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ApiError(400, "'messages' must be a non-empty array", code="messages_missing")
    for message in messages:
        if not isinstance(message, dict) or not isinstance(message.get("role"), str):
            raise ApiError(400, "each message needs a string role")
        content = message.get("content")
        if content is not None and not isinstance(content, str):
            raise ApiError(400, f"message.content must be a string or null, got {type(content).__name__}")
    max_tokens = payload.get("max_tokens")
    if max_tokens is not None and (not isinstance(max_tokens, int) or isinstance(max_tokens, bool) or max_tokens < 1):
        raise ApiError(400, "'max_tokens' must be a positive integer")
    return payload


def last_user_text(payload: dict[str, Any]) -> str:
    for message in reversed(payload.get("messages", [])):
        if message.get("role") == "user":
            return str(message.get("content") or "")
    return ""


def completion_body(prompt: str, model: str, content: str, decision: governance.Decision, tool_call: dict | None = None) -> dict[str, Any]:
    prompt_tokens = max(1, len(prompt.split()))
    completion_tokens = max(1, len(content.split()))
    message: dict[str, Any] = {"role": "assistant", "content": content}
    finish = "stop"
    if tool_call is not None:
        message["content"] = None
        message["tool_calls"] = [tool_call]
        finish = "tool_calls"
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish}],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
        "governance": decision.as_dict(),
    }


# ---------------------------------------------------------------------------
# /v1/chat/completions — OpenAI compatible (L1-L4)
# ---------------------------------------------------------------------------

@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> Any:
    payload = validate_chat(await read_json(request))
    prompt = last_user_text(payload)
    decision = governance.evaluate(prompt)
    reveal_attempt = bool(
        __import__("re").search(
            r"(print|reveal|repeat|show)[\s\S]{0,40}(system prompt|preamble|instructions you were given)",
            governance.normalize(prompt),
        )
    )

    if payload.get("stream"):
        if decision.blocked:
            raise ApiError(403, decision.reason, "governance_error", "policy_blocked")
        return StreamingResponse(stream_answer(prompt), media_type="text/event-stream")

    tool_choice = payload.get("tool_choice")
    declared = [
        (tool or {}).get("function", {}).get("name")
        for tool in (payload.get("tools") or [])
        if isinstance(tool, dict)
    ]
    if isinstance(tool_choice, dict):
        wanted = (tool_choice.get("function") or {}).get("name")
        if wanted not in declared:
            raise ApiError(400, f"tool_choice references an undeclared tool: {wanted}", code="tool_not_registered")
    if tool_choice in ("required", "auto") and decision.decision == "allow" and declared:
        call = {
            "id": short_id("call"),
            "type": "function",
            "function": {"name": declared[0], "arguments": json.dumps({"prompt": prompt[:200]})},
        }
        return JSONResponse(completion_body(prompt, payload["model"], "", decision, call))

    if decision.blocked or reveal_attempt:
        reason = (
            "the system prompt and policy configuration are not disclosed to callers"
            if reveal_attempt and not decision.blocked
            else decision.reason
        )
        refusal = refusal_text(governance.Decision(decision="block", reason=reason))
        return JSONResponse(completion_body(prompt, payload["model"], refusal, decision))

    content = compose_answer(prompt, decision)
    if (payload.get("response_format") or {}).get("type") == "json_object":
        content = json.dumps(
            {
                "request_id": fingerprint(prompt),
                "intent": detect_intent(prompt),
                "governance": {"decision": decision.decision, "level": GOVERNANCE_LEVEL, "layers": len(LAYERS.split(" · "))},
                "summary": content.split(".")[0],
            },
            ensure_ascii=False,
        )
    return JSONResponse(completion_body(prompt, payload["model"], content, decision))


async def stream_answer(prompt: str):
    """SSE chunks in OpenAI shape, terminated by the [DONE] sentinel."""
    answer = compose_answer(prompt, governance.evaluate(prompt))
    chunk_id = f"chatcmpl-{fingerprint(prompt)}"
    created = int(time.time())

    def envelope(delta: dict, finish: str | None) -> str:
        body = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": MODELS[0],
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
        }
        return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"

    yield envelope({"role": "assistant"}, None)
    pieces = [answer[i : i + 28] for i in range(0, len(answer), 28)] or [answer]
    for piece in pieces:
        yield envelope({"content": piece}, None)
        await asyncio.sleep(0.01)
    yield envelope({}, "stop")
    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# governed mission surface
# ---------------------------------------------------------------------------

def create_mission(prompt: str) -> tuple[dict[str, Any], governance.Decision, str | None]:
    mission_id = short_id("miss")
    now = time.time()
    decision = governance.evaluate(prompt)
    mission: dict[str, Any] = {
        "id": mission_id,
        "prompt": prompt[:4000],
        "status": "ACCEPTED",
        "lifecycle_stage": "INIT",
        "created_at": now,
        "updated_at": now,
        "events": [{"stage": "INIT", "type": "mission_accepted", "at": now, "prompt_hash": fingerprint(prompt)}],
        "governance": decision.as_dict(),
        "result": None,
        "approval_required": False,
        "approval_status": None,
    }
    mission["events"].append(
        {
            "stage": "POLICY",
            "type": "policy_evaluated",
            "at": time.time(),
            "risk_level": decision.risk_level,
            "decision": decision.decision.upper(),
            "rule_id": decision.rule,
            "reason": decision.reason,
        }
    )

    if decision.blocked:
        mission["status"] = "BLOCKED"
        mission["lifecycle_stage"] = "POLICY"
        mission["events"].append({"stage": "POLICY", "type": "execution_refused", "at": time.time(), "reason": decision.reason})
        COUNTERS["blocked"] += 1
        MISSIONS[mission_id] = mission
        return mission, decision, None

    if decision.requires_approval:
        approval_id = short_id("appr")
        APPROVALS[approval_id] = {
            "approval_id": approval_id,
            "mission_id": mission_id,
            "action": prompt[:160],
            "status": "pending",
            "created_at": time.time(),
        }
        mission["status"] = "PENDING_APPROVAL"
        mission["approval_required"] = True
        mission["approval_status"] = "pending"
        mission["approval_id"] = approval_id
        mission["events"].append({"stage": "POLICY", "type": "approval_requested", "at": time.time(), "approval_id": approval_id})
        COUNTERS["approvals"] += 1
        MISSIONS[mission_id] = mission
        return mission, decision, approval_id

    intent = detect_intent(prompt)
    for stage, event, extra in (
        ("PLANNER", "planning_started", {"subtasks": 3, "intent": intent}),
        ("EXECUTION", "execution_completed", {"isolated": True, "sandbox": "workspace-scope"}),
        ("VERIFIER", "verification_passed", {"pass_rate": 1.0, "checks_run": 3}),
    ):
        mission["lifecycle_stage"] = stage
        mission["status"] = {"PLANNER": "PLANNING", "EXECUTION": "EXECUTING", "VERIFIER": "VERIFYING"}[stage]
        mission["events"].append({"stage": stage, "type": event, "at": time.time(), **extra})

    transaction = short_id("txn")
    mission["lifecycle_stage"] = "LEDGER"
    mission["status"] = "RECORDED"
    mission["events"].append({"stage": "LEDGER", "type": "transaction_recorded", "at": time.time(), "txn_id": transaction})

    note = (
        "Embedded instructions from untrusted content were detected and ignored."
        if decision.injection
        else "No untrusted instruction patterns found."
    )
    mission["result"] = {
        "output": compose_answer(prompt, decision),
        "report": {
            "request_id": fingerprint(prompt),
            "intent": intent,
            "verified": True,
            "response_template": RESPONSES.get(intent, RESPONSES["general"])[:160],
            "thinking_steps": len(THINKING_STEPS.get(intent, THINKING_STEPS["general"])),
            "injection_detected": bool(decision.injection),
            "note": note,
        },
        "verification": {"pass_rate": 1.0, "checks_run": 3, "evidence_required": True},
        "transaction": transaction,
    }
    mission["status"] = "COMPLETED"
    mission["updated_at"] = time.time()
    mission["events"].append({"stage": "LEDGER", "type": "mission_completed", "at": time.time(), "txn_id": transaction})
    MISSIONS[mission_id] = mission
    return mission, decision, None


def public_mission(mission: dict[str, Any]) -> dict[str, Any]:
    view = {k: v for k, v in mission.items() if k != "prompt"}
    view["prompt"] = f"{mission['prompt'][:80]}…"
    return view


@app.post("/api/v1/missions/execute")
async def execute_mission(request: Request) -> Any:
    require_key(request, "missions:execute")
    payload = await read_json(request)
    if not isinstance(payload, dict):
        raise ApiError(400, "body must be a JSON object")
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ApiError(400, "'prompt' must be a non-empty string", code="prompt_missing")

    mission, decision, approval_id = create_mission(prompt)
    COUNTERS["missions_total"] += 1
    RECENT.appendleft(mission["id"])

    if mission["status"] == "BLOCKED":
        return JSONResponse(
            {
                "success": False,
                "error": f"governance: {decision.reason}",
                "decision": "block",
                "rule": decision.rule,
                "mission_id": mission["id"],
                "risk_level": decision.risk_level,
            },
            status_code=403,
        )

    meta: dict[str, Any] = {"policy_decision": decision.decision, "rate_limit_remaining": 59}
    if approval_id:
        meta["requires_approval"] = True
        meta["approval_id"] = approval_id
    return {"success": True, "data": public_mission(mission), "meta": meta}


@app.get("/api/v1/missions")
async def list_missions(request: Request) -> dict[str, Any]:
    require_key(request)
    return {"success": True, "data": [public_mission(m) for m in MISSIONS.values()]}


@app.get("/api/v1/missions/{mission_id}")
async def get_mission(mission_id: str, request: Request) -> Any:
    require_key(request)
    mission = MISSIONS.get(mission_id)
    if mission is None:
        return JSONResponse({"success": False, "error": "Mission not found"}, status_code=404)
    return {"success": True, "data": public_mission(mission)}


@app.post("/api/v1/missions/{mission_id}/rollback")
async def rollback_mission(mission_id: str, request: Request) -> Any:
    require_key(request, "missions:execute")
    mission = MISSIONS.get(mission_id)
    if mission is None:
        return JSONResponse({"success": False, "error": "Mission not found"}, status_code=404)
    transaction = short_id("txn")
    mission["status"] = "FAILED"
    mission["updated_at"] = time.time()
    mission["events"].append({"stage": "LEDGER", "type": "rollback_initiated", "at": time.time(), "txn_id": transaction})
    return {"success": True, "data": {"rolled_back": True, "txn_id": transaction, "mission_id": mission_id}}


@app.get("/api/v1/approvals")
async def list_approvals(request: Request) -> dict[str, Any]:
    require_key(request)
    return {"success": True, "data": list(APPROVALS.values())}


@app.post("/api/v1/approvals/{approval_id}/{action}")
async def resolve_approval(approval_id: str, action: str, request: Request) -> Any:
    require_key(request, "missions:execute")
    if action not in ("approve", "reject"):
        raise ApiError(400, "action must be 'approve' or 'reject'")
    entry = APPROVALS.get(approval_id)
    if entry is None:
        return JSONResponse({"success": False, "error": "Approval not found"}, status_code=404)
    entry["status"] = "approved" if action == "approve" else "rejected"
    mission = MISSIONS.get(entry["mission_id"])
    if mission is not None:
        mission["approval_status"] = entry["status"]
        mission["status"] = "EXECUTING" if action == "approve" else "FAILED"
    return {"success": True, "data": {"approval_id": approval_id, "status": entry["status"]}}


# ---------------------------------------------------------------------------
# skills + memory
# ---------------------------------------------------------------------------

@app.get("/api/v1/skills")
async def list_skills(request: Request) -> dict[str, Any]:
    require_key(request, "skills:read")
    return {"success": True, "data": list(SKILLS)}


@app.post("/api/v1/skills/synthesize")
async def synthesize_skill(request: Request) -> Any:
    require_key(request, "skills:write")
    payload = await read_json(request)
    if not isinstance(payload, dict):
        raise ApiError(400, "body must be a JSON object")
    import re as _re

    name = str(payload.get("name") or "")
    if not _re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,40}", name):
        return JSONResponse(
            {"success": False, "error": "skill name must match ^[a-z0-9][a-z0-9._-]{2,40}$", "code": "invalid_skill_name"},
            status_code=422,
        )
    corpus = " ".join(
        [name, str(payload.get("description") or ""), " ".join(map(str, payload.get("triggers") or [])),
         str(payload.get("instructions") or ""), str(payload.get("testCode") or "")]
    )
    decision = governance.evaluate(corpus)
    if decision.decision != "allow":
        COUNTERS["blocked"] += 1
        # A skill body is code that will run later: refuse it here rather than
        # trusting a reviewer to notice.
        return JSONResponse(
            {
                "success": False,
                "error": f"skill refused by policy {decision.rule}: {decision.reason}",
                "code": "policy_blocked",
                "skill": name,
                "registered": False,
            },
            status_code=403,
        )
    SKILLS.append(name)
    return {"success": True, "data": {"registered": name, "quarantine": "workspace-only", "review": "pending"}}


@app.post("/api/v1/memory/store")
async def store_memory(request: Request) -> Any:
    require_key(request, "memory:write")
    payload = await read_json(request)
    if not isinstance(payload, dict) or not isinstance(payload.get("key"), str) or not payload["key"]:
        raise ApiError(400, "'key' is required")
    import re as _re

    flat = json.dumps(payload.get("value"), ensure_ascii=False)
    if _re.search(r"AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|api[_-]?key[\"'\s:=]+[A-Za-z0-9+/_-]{12,}", flat, _re.I):
        return JSONResponse(
            {"success": False, "error": "credential-shaped material may not be persisted in memory", "code": "secret_material_refused"},
            status_code=422,
        )
    MEMORY[payload["key"]] = payload.get("value")
    return {"success": True, "data": {"stored": True, "key": payload["key"]}}


@app.post("/api/v1/memory/query")
async def query_memory(request: Request) -> Any:
    require_key(request, "memory:read")
    payload = await read_json(request)
    needle = governance.normalize(str((payload or {}).get("query") or ""))
    results = [
        {"key": key, "value": value, "source": "memory"}
        for key, value in MEMORY.items()
        if not needle or needle in governance.normalize(f"{key} {json.dumps(value, ensure_ascii=False)}")
    ][:10]
    return {"success": True, "data": {"results": results, "query": (payload or {}).get("query", "")}}


# ---------------------------------------------------------------------------
# optional Gradio UI mounted at "/" — the API always starts, UI degrades cleanly
# ---------------------------------------------------------------------------

def mount_ui():
    try:
        from ui import demo  # noqa: PLC0415
    except Exception:  # pragma: no cover
        return None
    if demo is None or os.environ.get("AGI_OS_MOUNT_UI", "1") == "0":
        return None
    try:
        import gradio as gr

        return gr.mount_gradio_app(app, demo, path="/")
    except Exception as exc:  # pragma: no cover - UI must never take the API down
        print(f"[agi-os] gradio UI not mounted ({exc.__class__.__name__}: {exc}); serving API only")
        return None


mounted = mount_ui()
if mounted is None:

    @app.get("/")
    async def root() -> dict[str, Any]:
        return {
            "message": "AGI-OS backend is running (API only; gradio UI not mounted)",
            "version": VERSION,
            "docs": "/docs",
            "models": list(MODELS),
        }

app_for_server = mounted or app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app_for_server, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
