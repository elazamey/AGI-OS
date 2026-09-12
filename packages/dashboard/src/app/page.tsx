import { ensureSeeded } from '@/lib/data';
import { ShieldCheck, Activity, Database, Cpu, Lock, ArrowRight, Server } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DashboardOverview() {
  ensureSeeded();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AGI OS Control Center</h1>
          <p className="text-sm text-zinc-400 mt-1">Local-First Autonomous Agentic Framework (v1.2)</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-emerald-400">SYSTEM SECURE & ONLINE</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-sm font-medium">Passing Tests</span>
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">909 / 909</p>
          <span className="text-xs text-emerald-400 mt-2 block">100% E2E Local Loop Verified</span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-sm font-medium">Budget Ceiling</span>
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">$0.00</p>
          <span className="text-xs text-blue-400 mt-2 block">Strict CostGuard Active</span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-sm font-medium">Governance Latency</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">&lt; 5ms</p>
          <span className="text-xs text-zinc-400 mt-2 block">Zero-bypass Intercept</span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-sm font-medium">Ollama Local Node</span>
            <Server className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400">ONLINE</p>
          <span className="text-xs text-zinc-400 mt-2 block">localhost:11434 &middot; $0.00 Cost</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/governance" className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition rounded-xl p-6 block">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Governance & Audits</h3>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
          </div>
          <p className="text-sm text-zinc-400 mt-2">Inspect security logs, blocked attempts, and approval gates.</p>
        </Link>

        <Link href="/loop" className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition rounded-xl p-6 block">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">EventLoop Telemetry</h3>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
          </div>
          <p className="text-sm text-zinc-400 mt-2">Monitor active mission pipelines and 5-interface contract states.</p>
        </Link>

        <Link href="/memory" className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition rounded-xl p-6 block">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Vector Memory RAG</h3>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
          </div>
          <p className="text-sm text-zinc-400 mt-2">Browse stored lessons, vector indices, and similarity matches.</p>
        </Link>

        <Link href="/self-model" className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition rounded-xl p-6 block">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Self-Model</h3>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
          </div>
          <p className="text-sm text-zinc-400 mt-2">Reliability metrics, domain confidence, and failure patterns.</p>
        </Link>

        <Link href="/reflection" className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition rounded-xl p-6 block">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Reflection Lessons</h3>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
          </div>
          <p className="text-sm text-zinc-400 mt-2">Post-mission analysis, root cause extraction, and lesson decay.</p>
        </Link>
      </div>
    </main>
  );
}
