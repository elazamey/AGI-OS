interface PlanStep {
  id: string;
  name: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  skill: string;
  risk: string;
  duration: string;
}

interface PlanPanelProps {
  plan: PlanStep[];
  selectedTask: string | null;
  onSelect: (id: string) => void;
}

const STATUS_ICON = { completed: '✓', running: '●', pending: '○', failed: '✕' };
const STATUS_COLOR = { completed: 'var(--success)', running: 'var(--accent)', pending: 'var(--text-muted)', failed: 'var(--error)' };

export function PlanPanel({ plan, selectedTask, onSelect }: PlanPanelProps) {
  const completed = plan.filter(s => s.status === 'completed').length;
  const percentage = Math.round((completed / plan.length) * 100);

  return (
    <aside className="w-64 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col shrink-0">
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">خطة المهمة</span>
          <span className="text-[10px] text-[var(--text-muted)]">{percentage}%</span>
        </div>
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1">
          <div className="h-1 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {plan.map((step) => (
          <button
            key={step.id}
            onClick={() => onSelect(step.id)}
            className={`w-full text-right px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors ${selectedTask === step.id ? 'bg-[var(--bg-hover)] border-r-2 border-[var(--accent)]' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold" style={{ color: STATUS_COLOR[step.status] }}>{STATUS_ICON[step.status]}</span>
              <span className="text-xs font-medium">{step.name}</span>
            </div>
            <div className="flex items-center gap-2 mr-5">
              <span className="text-[10px] text-[var(--text-muted)]">{step.skill}</span>
              <span className="text-[10px] text-[var(--text-muted)]">•</span>
              <span className="text-[10px] text-[var(--text-muted)]">{step.risk}</span>
              <span className="text-[10px] text-[var(--text-muted)]">•</span>
              <span className="text-[10px] text-[var(--text-muted)]">{step.duration}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
