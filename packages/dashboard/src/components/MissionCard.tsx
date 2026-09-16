interface MissionCardProps {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  agents: number;
  skills: string[];
}

const STATUS_CONFIG = {
  running: { color: 'var(--accent)', label: 'قيد التنفيذ', dot: 'status-running' },
  completed: { color: 'var(--success)', label: 'مكتملة', dot: 'status-success' },
  failed: { color: 'var(--error)', label: 'فاشلة', dot: 'status-error' },
  paused: { color: 'var(--warning)', label: 'متوقفة', dot: 'status-warning' },
};

export function MissionCard({ id: _id, title, status, progress, agents, skills }: MissionCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--text-muted)] transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium truncate">{title}</h3>
        <span className={`status-dot ${config.dot}`} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs" style={{ color: config.color }}>{config.label}</span>
        <span className="text-xs text-[var(--text-muted)]">{progress}%</span>
      </div>
      <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5 mb-3">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: config.color }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {skills.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">{agents} Agent{agents > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
