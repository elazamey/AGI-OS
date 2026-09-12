import { ensureSeeded } from '@/lib/data';
import { ArrowLeft, Cpu, Clock, CheckCircle, XCircle, SkipForward, Zap } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function LoopPage() {
  ensureSeeded();

  const phases = [
    { name: 'Perceive', status: 'idle', color: 'text-blue-400', bg: 'bg-blue-950/50 border-blue-800/50' },
    { name: 'Plan', status: 'idle', color: 'text-purple-400', bg: 'bg-purple-950/50 border-purple-800/50' },
    { name: 'Execute', status: 'idle', color: 'text-amber-400', bg: 'bg-amber-950/50 border-amber-800/50' },
    { name: 'Reflect', status: 'idle', color: 'text-emerald-400', bg: 'bg-emerald-950/50 border-emerald-800/50' },
    { name: 'Memorize', status: 'idle', color: 'text-cyan-400', bg: 'bg-cyan-950/50 border-cyan-800/50' },
  ];

  const iterations = [
    { id: 1, outcome: 'success', goal: 'Initialize kernel subsystem', duration: 42, lessons: 1, time: '2 min ago' },
    { id: 2, outcome: 'success', goal: 'Load governance policies', duration: 38, lessons: 0, time: '2 min ago' },
    { id: 3, outcome: 'failure', goal: 'Connect to remote provider', duration: 120, lessons: 2, time: '1 min ago' },
    { id: 4, outcome: 'success', goal: 'Execute local file operation', duration: 15, lessons: 0, time: '1 min ago' },
    { id: 5, outcome: 'success', goal: 'Run vector memory indexing', duration: 85, lessons: 1, time: '45s ago' },
    { id: 6, outcome: 'skipped', goal: 'Network fetch (provider offline)', duration: 5, lessons: 0, time: '30s ago' },
    { id: 7, outcome: 'success', goal: 'Audit ledger persistence', duration: 12, lessons: 0, time: '15s ago' },
    { id: 8, outcome: 'error', goal: 'Database write (schema mismatch)', duration: 200, lessons: 3, time: '5s ago' },
  ];

  const stats = {
    total: 8,
    success: 5,
    failure: 1,
    skipped: 1,
    error: 1,
    avgDuration: 52,
    uptime: '4m 32s',
    lessonsGenerated: 7,
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-2 rounded-lg text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">EventLoop Telemetry</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Perceive &rarr; Plan &rarr; Execute &rarr; Reflect &rarr; Memorize</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400">
            <Cpu className="w-4 h-4" />
            <span>State: Idle</span>
          </div>
        </div>

        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {phases.map((phase, i) => (
            <div key={phase.name} className="flex items-center gap-3">
              <div className={`${phase.bg} border rounded-xl px-5 py-3 text-center min-w-[120px]`}>
                <p className={`text-sm font-semibold ${phase.color}`}>{phase.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{phase.status}</p>
              </div>
              {i < phases.length - 1 && <span className="text-zinc-700">&rarr;</span>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Total Iterations</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Avg Duration</p>
            <p className="text-2xl font-bold text-white">{stats.avgDuration}ms</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Uptime</p>
            <p className="text-2xl font-bold text-white">{stats.uptime}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Lessons Generated</p>
            <p className="text-2xl font-bold text-purple-400">{stats.lessonsGenerated}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-lg font-bold text-emerald-400">{stats.success}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Success</p>
            </div>
          </div>
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-lg font-bold text-red-400">{stats.failure}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Failed</p>
            </div>
          </div>
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-3 flex items-center gap-3">
            <SkipForward className="w-5 h-5 text-zinc-400" />
            <div>
              <p className="text-lg font-bold text-zinc-400">{stats.skipped}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Skipped</p>
            </div>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-lg font-bold text-amber-400">{stats.error}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Error</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300">Iteration Timeline</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-6 font-semibold">#</th>
                  <th className="py-3 px-6 font-semibold">Outcome</th>
                  <th className="py-3 px-6 font-semibold">Goal</th>
                  <th className="py-3 px-6 font-semibold">Duration</th>
                  <th className="py-3 px-6 font-semibold">Lessons</th>
                  <th className="py-3 px-6 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {iterations.map((iter) => (
                  <tr key={iter.id} className="hover:bg-zinc-900/80 transition">
                    <td className="py-3 px-6 font-mono text-xs text-zinc-500">{iter.id}</td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        iter.outcome === 'success' ? 'bg-emerald-950/80 text-emerald-400' :
                        iter.outcome === 'failure' ? 'bg-red-950/80 text-red-400' :
                        iter.outcome === 'error' ? 'bg-amber-950/80 text-amber-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {iter.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-zinc-200">{iter.goal}</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{iter.duration}ms</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{iter.lessons}</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-500">{iter.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
