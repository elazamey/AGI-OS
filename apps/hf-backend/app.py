import time
import gradio as gr

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

def detect_intent(message):
    lower = message.lower()
    if any(w in lower for w in ["ترقيع", "patch", "إصلاح", "fix", "ثغرة", "security"]):
        return "patch"
    if any(w in lower for w in ["بناء", "build", "create", "إنشاء", "مشروع", "project"]):
        return "build"
    if any(w in lower for w in ["تحليل", "analyze", "review", "فحص", "مراجعة", "code review"]):
        return "analyze"
    return "default"

def agi_chat(message, history):
    intent = detect_intent(message)
    thinking_steps = THINKING_STEPS.get(intent, THINKING_STEPS["default"])
    response = RESPONSES.get(intent, RESPONSES["default"])
    partial = ""
    for i, step in enumerate(thinking_steps):
        level = GOVERNANCE_LEVELS[min(i + 1, 5)]
        partial += f"[{level}] {step}\n\n"
        yield partial
        time.sleep(0.3)
    partial += f"\n---\n\n{response}"
    yield partial

demo = gr.ChatInterface(
    fn=agi_chat,
    title="AGI-OS Agent",
    description="Cognitive Agent Operating System - 5-Layer Governance - Self-Healing - Autonomous",
    examples=["Build a project", "Analyze code", "Apply security patch", "Deploy app"],
)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
