import { ensureSeeded, getGovernance } from '@/lib/data';
import { ShieldAlert, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function GovernancePage() {
  ensureSeeded();
  const gov = getGovernance();
  const stats = gov.getAuditStats();
  const records = gov.getAuditHistory().slice(-20).reverse();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-2 rounded-lg text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Governance & Audit Explorer</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Immutable policy decisions and risk intercept logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Sub-5ms Intercept Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Total Intents</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Allowed</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.allowed}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Blocked</p>
            <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Require Approval</p>
            <p className="text-2xl font-bold text-amber-400">{stats.requireApproval}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Overridden</p>
            <p className="text-2xl font-bold text-purple-400">{stats.overridden}</p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3.5 px-6 font-semibold">Decision</th>
                  <th className="py-3.5 px-6 font-semibold">Module</th>
                  <th className="py-3.5 px-6 font-semibold">Operation</th>
                  <th className="py-3.5 px-6 font-semibold">Target</th>
                  <th className="py-3.5 px-6 font-semibold">Risk</th>
                  <th className="py-3.5 px-6 font-semibold">Rule</th>
                  <th className="py-3.5 px-6 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {records.map((record) => {
                  const isBlocked = record.decision === 'BLOCK';
                  const isAllowed = record.decision === 'ALLOW';
                  const isPending = record.decision === 'REQUIRE_APPROVAL';

                  return (
                    <tr key={record.id} className="hover:bg-zinc-900/80 transition">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isBlocked ? 'bg-red-950/80 text-red-400 border border-red-800/50' :
                          isAllowed ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' :
                          'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                        }`}>
                          {isBlocked && <ShieldAlert className="w-3.5 h-3.5" />}
                          {isAllowed && <ShieldCheck className="w-3.5 h-3.5" />}
                          {isPending && <AlertTriangle className="w-3.5 h-3.5" />}
                          {record.decision}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs font-mono text-zinc-300">{record.intent.module}</td>
                      <td className="py-4 px-6 text-xs font-mono text-zinc-300">{record.intent.operation}</td>
                      <td className="py-4 px-6 font-mono text-xs text-zinc-300 max-w-xs truncate">{record.intent.target}</td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${record.riskAssessment.riskScore > 70 ? 'bg-red-500' : record.riskAssessment.riskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(record.riskAssessment.riskScore, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-zinc-400 font-mono">{record.riskAssessment.riskScore}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-zinc-500 font-mono">{record.matchedRuleId || '—'}</td>
                      <td className="py-4 px-6 whitespace-nowrap text-xs text-zinc-500 font-mono">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {records.length === 0 && (
            <div className="p-12 text-center text-zinc-500 text-sm">No audit records yet. Run some governance intercepts to populate.</div>
          )}
        </div>
      </div>
    </main>
  );
}
