import { ensureSeeded, getVectorMemory } from '@/lib/data';
import { ArrowLeft, Search, Database, FileText, Tag } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function MemoryPage() {
  ensureSeeded();
  const vm = getVectorMemory();
  const allDocs = vm.getEngine().getAll();
  const totalCount = vm.count();

  const categories: Record<string, number> = allDocs.reduce((acc: Record<string, number>, doc) => {
    const cat = (doc.metadata?.category as string) || 'uncategorized';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sampleSearch = vm.search('security validation file path', 5);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-2 rounded-lg text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Vector Memory RAG</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Local semantic search with 128-dim word-trigram embeddings</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400">
            <Database className="w-4 h-4" />
            <span>{totalCount} documents stored</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Total Documents</p>
            <p className="text-2xl font-bold text-white">{totalCount}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Embedding Dimension</p>
            <p className="text-2xl font-bold text-white">128</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Search Latency</p>
            <p className="text-2xl font-bold text-amber-400">&lt; 20ms</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Object.entries(categories).map(([cat, count]) => (
            <div key={cat} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
              <Tag className="w-4 h-4 text-zinc-500" />
              <div>
                <p className="text-sm font-semibold text-white capitalize">{cat}</p>
                <p className="text-xs text-zinc-400">{count} docs</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Sample Search: &quot;security validation file path&quot; (top 5)
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {sampleSearch.map((result, i) => (
              <div key={i} className="px-6 py-4 hover:bg-zinc-900/80 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500">{result.document.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                        {String(result.document.metadata?.category || 'general')}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200">{result.document.text}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-emerald-400">{(result.score * 100).toFixed(1)}%</p>
                    <p className="text-[10px] text-zinc-500">similarity</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              All Stored Documents
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-6 font-semibold">ID</th>
                  <th className="py-3 px-6 font-semibold">Text</th>
                  <th className="py-3 px-6 font-semibold">Category</th>
                  <th className="py-3 px-6 font-semibold">Impact</th>
                  <th className="py-3 px-6 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {allDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-900/80 transition">
                    <td className="py-3 px-6 font-mono text-xs text-zinc-500">{doc.id}</td>
                    <td className="py-3 px-6 text-xs text-zinc-200 max-w-md truncate">{doc.text}</td>
                    <td className="py-3 px-6 text-xs text-zinc-400 capitalize">{String(doc.metadata?.category || '—')}</td>
                    <td className="py-3 px-6">
                      <span className={`text-xs font-semibold ${
                        doc.metadata?.impact === 'critical' ? 'text-red-400' :
                        doc.metadata?.impact === 'high' ? 'text-amber-400' :
                        doc.metadata?.impact === 'medium' ? 'text-blue-400' :
                        'text-zinc-400'
                      }`}>
                        {String(doc.metadata?.impact || '—')}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-mono text-xs text-zinc-500">
                      {new Date(doc.createdAt).toLocaleTimeString()}
                    </td>
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
