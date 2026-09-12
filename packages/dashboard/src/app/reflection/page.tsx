import { ensureSeeded, getReflection } from '@/lib/data';
import { ArrowLeft, Brain, BookOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ReflectionPage() {
  ensureSeeded();
  const reflection = getReflection();
  const reflections = reflection.getReflections();
  const lessons = reflection.getAllValidatedLessons();

  const statusCounts: Record<string, number> = lessons.reduce((acc: Record<string, number>, l) => {
    const status = l.validation.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-2 rounded-lg text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Reflection Lessons</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Post-mission analysis, root cause extraction, and lesson decay</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400">
            <Brain className="w-4 h-4" />
            <span>{lessons.length} lessons stored</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Total Reflections</p>
            <p className="text-2xl font-bold text-white">{reflections.length}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Validated</p>
            <p className="text-2xl font-bold text-emerald-400">{statusCounts['validated'] || 0}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Weak</p>
            <p className="text-2xl font-bold text-amber-400">{statusCounts['weak'] || 0}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Contradicted</p>
            <p className="text-2xl font-bold text-red-400">{statusCounts['contradicted'] || 0}</p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Validated Lessons
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {lessons.map((vl) => (
              <div key={vl.lesson.id} className="px-6 py-4 hover:bg-zinc-900/80 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        vl.validation.status === 'validated' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' :
                        vl.validation.status === 'weak' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50' :
                        vl.validation.status === 'contradicted' ? 'bg-red-950/80 text-red-400 border border-red-800/50' :
                        'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {vl.validation.status === 'validated' && <CheckCircle className="w-2.5 h-2.5" />}
                        {vl.validation.status === 'contradicted' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {vl.validation.status}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                        {vl.lesson.category}
                      </span>
                      <span className={`text-[10px] font-semibold ${
                        vl.lesson.impact === 'critical' ? 'text-red-400' :
                        vl.lesson.impact === 'high' ? 'text-amber-400' :
                        vl.lesson.impact === 'medium' ? 'text-blue-400' :
                        'text-zinc-400'
                      }`}>
                        {vl.lesson.impact}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200 mb-1">{vl.lesson.statement}</p>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                      <span>Confidence: {(vl.validation.confidence * 100).toFixed(0)}%</span>
                      <span>Evidence: {vl.validation.evidenceCount}</span>
                      <span>Contradictions: {vl.validation.contradictingEvidenceCount}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{vl.memoryType}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {lessons.length === 0 && (
              <div className="p-12 text-center text-zinc-500 text-sm">No lessons generated yet. Run reflections to populate.</div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Reflection History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-6 font-semibold">Mission</th>
                  <th className="py-3 px-6 font-semibold">Outcome</th>
                  <th className="py-3 px-6 font-semibold">Confidence</th>
                  <th className="py-3 px-6 font-semibold">Lessons</th>
                  <th className="py-3 px-6 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {reflections.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/80 transition">
                    <td className="py-3 px-6 font-mono text-xs text-zinc-300">{r.missionId}</td>
                    <td className="py-3 px-6">
                      <span className={`text-xs font-semibold ${r.outcome.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.outcome.success ? 'SUCCESS' : 'FAILURE'}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{(r.confidence * 100).toFixed(0)}%</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{r.validatedLessons.length}</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-500">
                      {new Date(r.reflectedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {reflections.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-zinc-500 text-sm">No reflections recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
