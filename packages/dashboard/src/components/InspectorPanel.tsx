interface InspectorPanelProps {
  taskId: string | null;
}

export function InspectorPanel(_props: InspectorPanelProps) {
  return (
    <aside className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col shrink-0">
      <div className="p-3 border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">الفاحص</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Mission info */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">المهمة</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">المعرف</span><span className="font-mono">#m1</span></div>
            <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">الحالة</span><span className="text-[var(--accent)]">قيد التنفيذ</span></div>
            <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">التقدم</span><span>72%</span></div>
          </div>
        </div>

        {/* Risk */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">المخاطر</h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[var(--success)]" style={{ width: '30%' }} />
            </div>
            <span className="text-[10px] text-[var(--success)]">LOW</span>
          </div>
        </div>

        {/* Model */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">النموذج</h3>
          <div className="text-xs">Auto (Fast → Reasoning)</div>
        </div>

        {/* Tools */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">الأدوات</h3>
          <div className="flex flex-wrap gap-1">
            {['Browser', 'Coding', 'Testing', 'Git'].map(t => (
              <span key={t} className="text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">الأدلة</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs"><span className="status-dot status-success" /><span className="text-[var(--text-secondary)]">Build passed</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="status-dot status-success" /><span className="text-[var(--text-secondary)]">34 tests pass</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="status-dot status-success" /><span className="text-[var(--text-secondary)]">Screenshot captured</span></div>
          </div>
        </div>

        {/* Artifacts */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">النتائج</h3>
          <div className="space-y-1">
            {['page.tsx', 'layout.tsx', 'globals.css'].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <span>📄</span><span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Approvals */}
        <div>
          <h3 className="text-[10px] uppercase text-[var(--text-muted)] mb-2 font-semibold">الموافقات</h3>
          <div className="text-xs text-[var(--success)]">✓ لا حاجة لموافقات</div>
        </div>
      </div>
    </aside>
  );
}
