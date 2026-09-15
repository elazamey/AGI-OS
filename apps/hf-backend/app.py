"""HuggingFace Space entry point.

The Space used to launch ``gr.ChatInterface`` directly (``demo.launch()``), which
served the chat page on :7860 and *nothing else* — so ``/health``, ``/v1/models``
and ``/v1/chat/completions`` all 404'd while the Space showed "Running". The API and
the UI are now one ASGI app (``main.app_for_server``): Gradio is mounted at ``/``,
the documented HTTP surface lives beside it.

Run locally::

    pip install -r requirements.txt
    python app.py            # http://127.0.0.1:7860  (UI) + /health, /v1/*, /api/v1/*
    uvicorn main:app --reload  # API only, no gradio
"""

from __future__ import annotations

import os

from main import app_for_server  # re-export: HF runs this file and expects :7860

try:  # keep `demo` importable for anything that introspects the Space object
    from ui import demo  # noqa: F401
except Exception:  # pragma: no cover - gradio is optional for API-only use
    demo = None

__all__ = ["app_for_server", "demo"]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app_for_server,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 7860)),
        log_level=os.environ.get("AGI_OS_LOG_LEVEL", "info"),
    )
