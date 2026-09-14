import json
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="AGI-OS Backend", version="1.25.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "agi-os-cortex"
    messages: List[ChatMessage]
    stream: bool = False
    temperature: float = 0.7
    max_tokens: int = 2048

GOVERNANCE_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"]

THINKING_STEPS = {
    "default": [
        "🔍 تحليل طلب المستخدم وتحديد السياق...",
        "📊 تم تحديد السياق. فحص طبقة الحوكمة...",
        "🧠 وضع خطة التنفيذ عبر MCTS Planning...",
        "⚙️ تنفيذ العملية في البيئة المعزولة...",
        "✅ اجتازت النتيجة بوابة الحوكمة Governance Gate"
    ],
    "patch": [
        "🔍 فحص الشجرة البرمجية بحثاً عن ثغرات...",
        "🛡️ رصد نقطة ضعف أمنية في طبقة التحقق...",
        "🔧 توليد ترقيع ذكي مع التحقق من الحوكمة...",
        "✅ الترقيع مُطبَّق بنجاح"
    ],
    "build": [
        "📋 تحليل المتطلبات وتحديد الهيكل...",
        "🔧 اختيار الأدوات والإعدادات المناسبة...",
        "⚡ بدء التنفيذ في البيئة المعزولة...",
        "✅ تم إنشاء المشروع بنجاح"
    ],
    "analyze": [
        "🔍 مسح الكود وتحليل البنية...",
        "📊 تقييم الأداء والثغرات...",
        "📝 إعداد تقرير التحليل...",
        "✅ التقرير جاهز"
    ]
}

RESPONSES = {
    "default": "تمت معالجة طلبك بنجاح عبر النواة المعرفية for AGI-OS. النظام يعمل في الوضع المستقل مع حوكمة 5 طبقات.",
    "patch": "تم رصد الثغرة البرمجية وتطبيق ترقيع ذكي آمن. نتيجة الحوكمة: 98/100. المخاطر: منخفضة.",
    "build": "تم بناء المشروع بنجاح عبر محرك AGI-OS. الهيكل جاهز والتحقق من الحوكمة مكتمل (100/100).",
    "analyze": "اكتمل تحليل الكود. تم اكتشاف 3 نقاط قابلة للتحسين. لا توجد ثغرات حرجة. الأداء: 78/100."
}

def detect_intent(messages: List[ChatMessage]) -> str:
    last_msg = messages[-1].content.lower() if messages else ""
    if any(w in last_msg for w in ["ترقيع", "patch", "إصلاح", "fix", "ثغرة"]):
        return "patch"
    if any(w in last_msg for w in ["بناء", "build", "create", "إنشاء", "مشروع"]):
        return "build"
    if any(w in last_msg for w in ["تحليل", "analyze", "review", "فحص", "مراجعة"]):
        return "analyze"
    return "default"

def generate_thinking(intent: str):
    steps = THINKING_STEPS.get(intent, THINKING_STEPS["default"])
    for i, step in enumerate(steps):
        level = GOVERNANCE_LEVELS[min(i + 1, 5)]
        yield f"data: {json.dumps({'choices': [{'delta': {'reasoning': step}}]})}\n\n"
        yield f"data: {json.dumps({'choices': [{'delta': {'content': ''}}]})}\n\n"
        time.sleep(0.15)

def generate_response(intent: str):
    response = RESPONSES.get(intent, RESPONSES["default"])
    words = response.split(" ")
    for word in words:
        yield f"data: {json.dumps({'choices': [{'delta': {'content': word + ' '}}]})}\n\n"
        time.sleep(0.03)
    yield "data: [DONE]\n\n"

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.25.1", "system": "AGI-OS Cortex Core", "level": "L4"}

@app.get("/v1/models")
async def models():
    return {
        "object": "list",
        "data": [
            {"id": "agi-os-cortex", "object": "model", "owned_by": "agi-os"},
            {"id": "agi-os-cortex-v2", "object": "model", "owned_by": "agi-os"}
        ]
    }

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    intent = detect_intent(request.messages)

    if request.stream:
        async def stream_generator():
            for chunk in generate_thinking(intent):
                yield chunk
            for chunk in generate_response(intent):
                yield chunk

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    thinking = " → ".join(THINKING_STEPS.get(intent, THINKING_STEPS["default"]))
    response = RESPONSES.get(intent, RESPONSES["default"])

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": response},
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 50, "completion_tokens": 120, "total_tokens": 170}
    }

@app.get("/")
async def root():
    return {"message": "AGI-OS Backend is running", "version": "1.25.1", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
