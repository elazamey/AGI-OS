'use client';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { icon: '🏠', label: 'الرئيسية', active: true },
  { icon: '📋', label: 'المهام' },
  { icon: '📁', label: 'المشاريع' },
  { icon: '🤖', label: 'الوكلاء' },
  { icon: '⚡', label: 'المهارات' },
  { icon: '🔗', label: 'الموصلات' },
  { icon: '🧠', label: 'الذاكرة' },
  { icon: '📦', label: 'النتائج' },
  { icon: '✅', label: 'الموافقات' },
  { icon: '🛡️', label: 'الأمان' },
  { icon: '📊', label: 'المقارنات' },
  { icon: '⚙️', label: 'النظام' },
];

export function Sidebar({ open, onToggle }: SidebarProps) {
  return (
    <aside className={`${open ? 'w-52' : 'w-14'} bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col shrink-0 transition-all duration-200`}>
      <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
        {open && <span className="text-xs font-semibold text-[var(--text-secondary)]">القائمة</span>}
        <button onClick={onToggle} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">☰</button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors ${item.active ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
          >
            <span className="text-sm">{item.icon}</span>
            {open && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-[var(--border)]">
        <button className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs py-2 rounded-lg font-medium">
          {open ? '+ مهمة جديدة' : '+'}
        </button>
      </div>
    </aside>
  );
}
