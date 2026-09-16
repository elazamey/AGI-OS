export function SystemBar() {
  return (
    <footer className="h-8 border-t border-[var(--border)] flex items-center justify-between px-4 text-[10px] text-[var(--text-muted)] shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1"><span className="status-dot status-success" /> Connected</span>
        <span>4 Missions</span>
        <span>9 Agents</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Event Stream</span>
        <span>v1.4.0</span>
      </div>
    </footer>
  );
}
