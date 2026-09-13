'use client';

import { use, useState } from 'react';
import { PlanPanel } from '@/components/PlanPanel';
import { AgentActivity } from '@/components/AgentActivity';
import { InspectorPanel } from '@/components/InspectorPanel';
import { ChatInput } from '@/components/ChatInput';

const MOCK_PLAN = [
  { id: 't1', name: 'تحليل الهدف', status: 'completed' as const, skill: 'Intent', risk: 'LOW', duration: '2s' },
  { id: 't2', name: 'جمع المعلومات', status: 'completed' as const, skill: 'Research', risk: 'LOW', duration: '45s' },
  { id: 't3', name: 'بناء الواجهة', status: 'running' as const, skill: 'Browser + Coding', risk: 'MEDIUM', duration: '3m' },
  { id: 't4', name: 'اختبار النتائج', status: 'pending' as const, skill: 'Testing', risk: 'LOW', duration: '~2m' },
  { id: 't5', name: 'التحقق النهائي', status: 'pending' as const, skill: 'Verification', risk: 'LOW', duration: '~1m' },
];

export default function MissionWorkspace({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15+: dynamic route params are asynchronous.
  const { id: missionId } = use(params);
  const [selectedTask, setSelectedTask] = useState<string | null>('t3');

  return (
    <div className="flex h-screen">
      {/* Left: Plan */}
      <PlanPanel plan={MOCK_PLAN} selectedTask={selectedTask} onSelect={setSelectedTask} />

      {/* Center: Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mission header */}
        <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">← رجوع</button>
            <span className="text-sm font-medium">مهمة #{missionId}</span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="status-dot status-running" />
              <span style={{ color: 'var(--accent)' }}>قيد التنفيذ</span>
            </span>
            <span className="text-xs text-[var(--text-muted)]">72%</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border)]">⏸ إيقاف</button>
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-error)] px-2 py-1 rounded border border-[var(--border)]">⏹ إلغاء</button>
          </div>
        </div>

        {/* Agent Activity */}
        <AgentActivity />

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-[var(--accent)] text-white text-sm px-4 py-2 rounded-2xl rounded-br-sm max-w-md">
                ابنِ لي موقع تجارة إلكترونية بسيط
              </div>
            </div>
            {/* Agent response */}
            <div className="flex justify-start">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] text-sm px-4 py-3 rounded-2xl rounded-bl-sm max-w-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold">N</div>
                  <span className="text-xs text-[var(--text-muted)]">Nawah</span>
                </div>
                <div className="space-y-2 text-[var(--text-secondary)]">
                  <p>فهمت الهدف. سأقوم بالآتي:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li className="text-[var(--success)]">✓ تحليل المتطلبات</li>
                    <li className="text-[var(--success)]">✓ تصميم Architecture</li>
                    <li className="text-[var(--accent)]">● تنفيذ الواجهة</li>
                    <li className="text-[var(--text-muted)]">○ اختبار</li>
                    <li className="text-[var(--text-muted)]">○ تسليم</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat input */}
        <ChatInput />
      </div>

      {/* Right: Inspector */}
      <InspectorPanel taskId={selectedTask} />
    </div>
  );
}
