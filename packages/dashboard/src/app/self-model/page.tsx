import { ensureSeeded, getSelfModel } from '@/lib/data';
import { ArrowLeft, Heart, TrendingUp, TrendingDown, AlertTriangle, Wrench, Server, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function SelfModelPage() {
  ensureSeeded();
  const sm = getSelfModel();

  const health = sm.getOverallHealth();
  const domains = sm.getConfidenceScorer().getRankedDomains();
  const reliability = sm.getReliabilityTracker().getRecords();
  const overallReliability = sm.getReliabilityTracker().getOverallReliability();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-2 rounded-lg text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Self-Model</h1>
              <p className="text-sm text-zinc-400 mt-0.5">System self-awareness: capabilities, confidence, reliability</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400">
            <Heart className="w-4 h-4" />
            <span>Health: {(health * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">System Health</p>
            <p className={`text-2xl font-bold ${health > 0.7 ? 'text-emerald-400' : health > 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
              {(health * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Overall Reliability</p>
            <p className="text-2xl font-bold text-white">{(overallReliability * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Components Tracked</p>
            <p className="text-2xl font-bold text-white">{reliability.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Ollama Local Adapter
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">ONLINE</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-zinc-500">Endpoint</p>
              <p className="text-sm font-mono text-zinc-200">http://localhost:11434</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-500">Cost Ceiling</p>
              <p className="text-sm font-mono text-emerald-400">$0.00 (Enforced)</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-500">Governance Intercept</p>
              <p className="text-sm font-mono text-zinc-200">&lt; 5ms</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-500">Default Model</p>
              <p className="text-sm font-mono text-zinc-200">llama3.2:latest</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Domain Confidence
              </h2>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {domains.map((d) => (
                <div key={d.domain} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{d.domain}</p>
                    <p className="text-xs text-zinc-500">{d.sampleSize} samples</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.score > 0.7 ? 'bg-emerald-500' : d.score > 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${d.score * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-mono text-zinc-300 w-12 text-right">{(d.score * 100).toFixed(0)}%</span>
                    {d.trend === 'improving' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                    {d.trend === 'declining' && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    {d.trend === 'stable' && <span className="w-3.5 h-3.5 text-zinc-600 block" />}
                  </div>
                </div>
              ))}
              {domains.length === 0 && (
                <div className="p-6 text-center text-zinc-500 text-sm">No confidence data recorded yet.</div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Component Reliability
              </h2>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {reliability.map((r) => (
                <div key={r.componentId} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white font-mono">{r.componentId}</p>
                    <p className="text-xs text-zinc-500">{r.componentType} &middot; {r.consecutiveSuccesses} consecutive OK</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.successRate > 0.8 ? 'bg-emerald-500' : r.successRate > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${r.successRate * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-mono text-zinc-300 w-12 text-right">{(r.successRate * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              {reliability.length === 0 && (
                <div className="p-6 text-center text-zinc-500 text-sm">No reliability data recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Tool Capabilities
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-6 font-semibold">Tool</th>
                  <th className="py-3 px-6 font-semibold">Category</th>
                  <th className="py-3 px-6 font-semibold">Success Rate</th>
                  <th className="py-3 px-6 font-semibold">Uses</th>
                  <th className="py-3 px-6 font-semibold">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {sm.getToolCapabilities().map((tc) => (
                  <tr key={tc.toolId} className="hover:bg-zinc-900/80 transition">
                    <td className="py-3 px-6 font-mono text-xs text-zinc-200">{tc.toolId}</td>
                    <td className="py-3 px-6 text-xs text-zinc-400 capitalize">{tc.category}</td>
                    <td className="py-3 px-6">
                      <span className={`text-xs font-semibold ${tc.successRate > 0.8 ? 'text-emerald-400' : tc.successRate > 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(tc.successRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{tc.totalUses}</td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-400">{tc.avgLatencyMs}ms</td>
                  </tr>
                ))}
                {sm.getToolCapabilities().length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-zinc-500 text-sm">No tool capabilities tracked yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
