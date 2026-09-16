const ACTIONS = [
  { icon: '🔍', label: 'بحث ويب' },
  { icon: '📄', label: 'تحليل ملف' },
  { icon: '🏗️', label: 'بناء مشروع' },
  { icon: '🐙', label: 'مراجعة GitHub' },
  { icon: '📊', label: 'إنشاء تقرير' },
];

export function QuickActions() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">اختصارات</h2>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(a => (
          <button
            key={a.label}
            className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
