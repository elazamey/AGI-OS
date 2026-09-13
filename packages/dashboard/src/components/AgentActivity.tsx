const ACTIVITIES = [
  { time: '12:14', icon: '🔍', text: 'Browser → فتح GitHub', status: 'completed' as const },
  { time: '12:15', icon: '📄', text: 'Research → 4 مصادر', status: 'completed' as const },
  { time: '12:16', icon: '💻', text: 'Code → تعديل app/page.tsx', status: 'running' as const },
  { time: '12:17', icon: '🧪', text: 'Test → 34/34 PASS', status: 'completed' as const },
];

export function AgentActivity() {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
      <div className="flex items-center gap-4 px-4 py-2 overflow-x-auto">
        {ACTIVITIES.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] shrink-0">
            <span className="text-[var(--text-muted)]">{a.time}</span>
            <span>{a.icon}</span>
            <span className={a.status === 'running' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}>{a.text}</span>
            {a.status === 'running' && <span className="status-dot status-running" />}
          </div>
        ))}
      </div>
    </div>
  );
}
