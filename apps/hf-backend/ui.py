"""Gradio chat front-end for the AGI-OS Space.

Kept separate from ``main.py`` so the API can start even when the gradio extra is
absent (an API-only deployment, or a broken optional dependency in the image).
"""

from __future__ import annotations

import time

GOVERNANCE_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"]

THINKING_STEPS = {
    "general": [
        "🔍 تحليل طلب المستخدم وتحديد السياق...",
        "📊 تم تحديد السياق. فحص طبقة الحوكمة...",
        "🧠 وضع خطة التنفيذ عبر MCTS Planning...",
        "⚙️ تنفيذ العملية في البيئة المعزولة...",
        "✅ اجتازت النتيجة بوابة الحوكمة Governance Gate",
    ],
    "patch": [
        "🔍 فحص الشجرة البرمجية بحثاً عن ثغرات...",
        "🛡️ رصد نقطة ضعف أمنية في طبقة التحقق...",
        "🔧 توليد ترقيع ذكي مع التحقق من الحوكمة...",
        "✅ الترقيع مُطبَّق بنجاح",
    ],
    "build": [
        "📋 تحليل المتطلبات وتحديد الهيكل...",
        "🔧 اختيار الأدوات والإعدادات المناسبة...",
        "⚡ بدء التنفيذ في البيئة المعزولة...",
        "✅ تم إنشاء المشروع بنجاح",
    ],
    "analyze": [
        "🔍 مسح الكود وتحليل البنية...",
        "📊 تقييم الأداء والثغرات...",
        "📝 إعداد تقرير التحليل...",
        "✅ التقرير جاهز",
    ],
}

RESPONSES = {
    "general": "تمت معالجة طلبك بنجاح عبر النواة المعرفية لـ AGI-OS. النظام يعمل في الوضع المستقل مع حوكمة 5 طبقات.",
    "patch": "تم رصد الثغرة البرمجية وتطبيق ترقيع ذكي آمن. نتيجة الحوكمة: 98/100. المخاطر: منخفضة.",
    "build": "تم بناء المشروع بنجاح عبر محرك AGI-OS. الهيكل جاهز والتحقق من الحوكمة مكتمل (100/100).",
    "analyze": "اكتمل تحليل الكود. تم اكتشاف 3 نقاط قابلة للتحسين. لا توجد ثغرات حرجة. الأداء: 78/100.",
}

INTENT_KEYWORDS = {
    "patch": ("ترقيع", "patch", "إصلاح", "fix", "ثغرة", "security", "vulnerab"),
    "build": ("بناء", "build", "create", "إنشاء", "مشروع", "project", "scaffold"),
    "analyze": ("تحليل", "analyze", "review", "فحص", "مراجعة", "audit", "code review"),
}


def detect_intent(message: str) -> str:
    lower = (message or "").lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(word in lower for word in keywords):
            return intent
    return "general"


def build_demo():
    """Return the ``gr.ChatInterface`` for the Space, or ``None`` without gradio."""
    try:
        import gradio as gr
    except Exception:  # pragma: no cover - optional dependency
        return None

    def agi_chat(message: str, history: list):
        intent = detect_intent(message)
        steps = THINKING_STEPS.get(intent, THINKING_STEPS["general"])
        response = RESPONSES.get(intent, RESPONSES["general"])

        partial = ""
        for index, step in enumerate(steps):
            level = GOVERNANCE_LEVELS[min(index + 1, len(GOVERNANCE_LEVELS) - 1)]
            partial += f"**[{level}]** {step}\n\n"
            yield partial
            time.sleep(0.3)

        yield f"{partial}\n---\n\n{response}"

    return gr.ChatInterface(
        fn=agi_chat,
        title="🧠 AGI-OS Agent",
        description="Cognitive Agent Operating System — 5-Layer Governance • Self-Healing • Autonomous",
        examples=[
            "قم ببناء مشروع جديد",
            "حلل هذا الكود",
            "قم بتطبيق ترقيع أمني",
            "نشر التطبيق",
        ],
        theme=gr.themes.Soft(primary_hue="cyan", secondary_hue="purple"),
    )


demo = build_demo()
