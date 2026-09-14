'use client';
import { useState } from 'react';
import { OPENAPI_SPEC } from '@/lib/openapi-spec';
import { Book, ChevronDown, ChevronRight, Copy, Check, Send, Code, FileJson } from 'lucide-react';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

const METHOD_COLORS: Record<HttpMethod, string> = {
  get: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  post: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  put: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  delete: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const TAG_ORDER = ['System', 'Agent', 'Skills', 'Memory', 'Models', 'OpenAI'];

export default function DocsPage() {
  const [expandedTag, setExpandedTag] = useState<string | null>('Agent');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [tryItResult, setTryItResult] = useState<string | null>(null);

  const paths = OPENAPI_SPEC.paths as Record<string, Record<string, unknown>>;
  const tags: Record<string, Array<{ path: string; method: string; operation: Record<string, unknown> }>> = {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'delete'].includes(method)) {
        const op = operation as Record<string, unknown>;
        const tag = ((op.tags as string[]) || ['Other'])[0];
        if (!tags[tag]) tags[tag] = [];
        tags[tag].push({ path, method, operation: op });
      }
    }
  }

  const copyCode = (path: string, method: string) => {
    const code = generateCurl(path, method);
    navigator.clipboard.writeText(code);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const tryIt = async (path: string, method: string) => {
    const baseUrl = 'http://localhost:7860';
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTryItResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setTryItResult(`Error: ${err instanceof Error ? err.message : 'Connection refused'}`);
    }
  };

  const generateCurl = (path: string, method: string) => {
    const base = 'https://elazamey-agi-system.hf.space';
    if (method === 'post') {
      return `curl -X POST ${base}${path} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{"prompt": "Analyze codebase"}'`;
    }
    return `curl ${base}${path} \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
  };

  const generateTypeScript = (path: string, _method: string) => {
    if (path.includes('/missions/execute')) {
      return `import { AGIOS } from '@agi-os/sdk';\n\nconst client = new AGIOS({\n  baseUrl: 'https://elazamey-agi-system.hf.space',\n  apiKey: process.env.AGI_OS_KEY,\n});\n\nconst result = await client.execute({\n  prompt: 'Analyze codebase',\n  capabilities: ['github'],\n});\n\nconsole.log(result.output);`;
    }
    if (path.includes('/memory/query')) {
      return `import { AGIOS } from '@agi-os/sdk';\n\nconst client = new AGIOS({ baseUrl: '...' });\nconst memories = await client.queryMemory('deployment history');`;
    }
    return `import { AGIOS } from '@agi-os/sdk';\n\nconst client = new AGIOS({ baseUrl: '...' });\nconst result = await client.health();`;
  };

  const generatePython = (path: string) => {
    if (path.includes('/missions/execute')) {
      return `from agios import AGIOS\n\nclient = AGIOS(base_url="https://elazamey-agi-system.hf.space")\n\nresult = client.agent.execute(\n    prompt="Analyze codebase",\n    capabilities=["github"]\n)\n\nprint(f"Status: {result.status}")`;
    }
    return `from agios import AGIOS\n\nclient = AGIOS(base_url="...")\nhealth = client.health()\nprint(health.status)`;
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Book size={24} className="text-agi-cyan" />
          <h1 className="text-2xl font-bold text-white">AGI-OS API Reference</h1>
        </div>
        <p className="text-sm text-slate-400">OpenAPI 3.1 — Interactive Documentation</p>
        <div className="flex justify-center gap-2 mt-3">
          <span className="chip chip-cyan">v1.33.0</span>
          <span className="chip chip-green">OpenAI Compatible</span>
          <span className="chip chip-purple">MCP Protocol</span>
        </div>
      </div>

      {/* Server Info */}
      <div className="glass p-3 rounded-xl mb-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Servers:</span>
          {OPENAPI_SPEC.servers.map((s) => (
            <span key={s.url} className="chip chip-cyan text-[10px]">{s.description}: {s.url}</span>
          ))}
        </div>
      </div>

      {/* Endpoints by Tag */}
      <div className="space-y-4">
        {TAG_ORDER.filter((t) => tags[t]).map((tag) => (
          <div key={tag} className="glass-strong rounded-xl overflow-hidden">
            {/* Tag Header */}
            <button
              onClick={() => setExpandedTag(expandedTag === tag ? null : tag)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-2">
                {expandedTag === tag ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="text-sm font-bold text-white">{tag}</span>
                <span className="text-[10px] text-slate-500">{tags[tag].length} endpoints</span>
              </div>
            </button>

            {/* Endpoints */}
            {expandedTag === tag && (
              <div className="border-t border-slate-700/50">
                {tags[tag].map(({ path, method, operation }) => {
                  const key = `${method}-${path}`;
                  const isExpanded = expandedPath === key;
                  const op = operation as Record<string, unknown>;

                  return (
                    <div key={key} className="border-b border-slate-700/30 last:border-0">
                      {/* Endpoint Header */}
                      <button
                        onClick={() => setExpandedPath(isExpanded ? null : key)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition text-left"
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${METHOD_COLORS[method as HttpMethod]}`}>
                          {method}
                        </span>
                        <span className="text-xs text-agi-cyan font-mono">{path}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{String(op.summary)}</span>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="p-4 bg-black/20 space-y-3">
                          <p className="text-xs text-slate-300">{String(op.description || op.summary)}</p>

                          {op.security !== undefined && (
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-amber-400">🔒</span>
                              <span className="text-slate-400">Requires: Bearer Token</span>
                            </div>
                          )}

                          {/* Code Examples */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {/* cURL */}
                            <div className="bg-slate-900 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-400">cURL</span>
                                <button onClick={() => copyCode(path, method)} className="text-slate-500 hover:text-white">
                                  {copiedPath === path ? <Check size={10} /> : <Copy size={10} />}
                                </button>
                              </div>
                              <pre className="text-[9px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                                {generateCurl(path, method)}
                              </pre>
                            </div>

                            {/* TypeScript */}
                            <div className="bg-slate-900 rounded-lg p-3">
                              <div className="flex items-center gap-1 mb-2">
                                <Code size={10} className="text-blue-400" />
                                <span className="text-[10px] text-slate-400">TypeScript</span>
                              </div>
                              <pre className="text-[9px] text-blue-300 overflow-x-auto whitespace-pre-wrap">
                                {generateTypeScript(path, method)}
                              </pre>
                            </div>

                            {/* Python */}
                            <div className="bg-slate-900 rounded-lg p-3">
                              <div className="flex items-center gap-1 mb-2">
                                <FileJson size={10} className="text-amber-400" />
                                <span className="text-[10px] text-slate-400">Python</span>
                              </div>
                              <pre className="text-[9px] text-amber-300 overflow-x-auto whitespace-pre-wrap">
                                {generatePython(path)}
                              </pre>
                            </div>
                          </div>

                          {/* Try It */}
                          {method === 'get' && (
                            <button
                              onClick={() => tryIt(path, method)}
                              className="px-3 py-1.5 rounded-lg bg-agi-cyan/10 text-agi-cyan text-[10px] font-semibold border border-agi-cyan/20 hover:bg-agi-cyan/20 transition"
                            >
                              <Send size={10} className="inline mr-1" />
                              Try it Live
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Try It Result */}
      {tryItResult && (
        <div className="fixed bottom-4 right-4 w-96 glass-strong p-4 rounded-xl z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">Response</span>
            <button onClick={() => setTryItResult(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
          <pre className="text-[10px] text-emerald-400 overflow-auto max-h-60">{tryItResult}</pre>
        </div>
      )}
    </main>
  );
}
