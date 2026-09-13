'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MissionCard } from '@/components/MissionCard';
import { QuickActions } from '@/components/QuickActions';
import { SystemBar } from '@/components/SystemBar';

const MOCK_MISSIONS = [
  { id: 'm1', title: 'بناء موقع التجارة', status: 'running' as const, progress: 78, agents: 3, skills: ['Browser', 'Coding', 'Testing'] },
  { id: 'm2', title: 'تقرير مقارنة النماذج', status: 'completed' as const, progress: 100, agents: 2, skills: ['Research', 'Artifact'] },
  { id: 'm3', title: 'إصلاح اختبارات GitHub', status: 'running' as const, progress: 43, agents: 1, skills: ['Coding', 'Git'] },
];

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center text-xs font-bold">N</div>
              <span className="font-semibold text-sm">Nawah OS</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="status-dot status-success" />
              <span>Kernel ●</span>
              <span className="status-dot status-success" />
              <span>Sandbox ●</span>
              <span className="status-dot status-success" />
              <span>Memory ●</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">مرحبًا 👋</h1>
            <p className="text-[var(--text-secondary)]">ماذا تريد أن أنفذ لك؟</p>
          </div>

          {/* Mission input */}
          <div className="mb-8 max-w-3xl">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <input
                type="text"
                placeholder="اكتب هدفك هنا... مثال: ابني لي موقع تجارة إلكترونية"
                className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none text-sm"
              />
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1">📎 ملف</button>
                  <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1">🌐 بحث</button>
                  <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1">🧠 ذاكرة</button>
                </div>
                <button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs px-4 py-1.5 rounded-lg font-medium">▶ تنفيذ</button>
              </div>
            </div>
          </div>

          {/* Active Missions */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">المهام الجارية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {MOCK_MISSIONS.map(m => (
                <MissionCard key={m.id} {...m} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <QuickActions />
        </main>

        <SystemBar />
      </div>
    </div>
  );
}
