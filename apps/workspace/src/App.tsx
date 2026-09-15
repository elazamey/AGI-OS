import React, { useState } from 'react';
import { ChatPanel } from './components/chat/ChatPanel';
import { AutoPatcherTab } from './components/canvas/AutoPatcherTab';
import { ExecutionDagTab } from './components/canvas/ExecutionDagTab';
import { GatewayModal } from './components/GatewayModal';
import { HoloOrb } from './components/common/HoloOrb';
import { INITIAL_DAG_NODES } from './data/mockData';
import { executeAgiPrompt } from './lib/agi-client';
import type { DagNode, Message, PatchAuditItem } from './types';
import {
  Brain,
  Code2,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: 'أهلاً بك في نظام AGI-OS Workspace. النواة المعرفية متصلة وجاهزة لتلقي توجيهاتك.',
      timestamp: new Date().toLocaleTimeString(),
      thoughtProcess: 'تهيئة النظام المعرفي -> فحص جاهزية الـ DAG -> الاستعداد للمهام.',
    },
  ]);

  const [systemLevel, setSystemLevel] = useState('L1');
  const [autonomousMode] = useState(true);
  const [dagNodes, setDagNodes] = useState<DagNode[]>(INITIAL_DAG_NODES);
  const [patches, setPatches] = useState<PatchAuditItem[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'patcher' | 'dag'>('chat');
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThought, setStreamingThought] = useState('');

  const [gatewayConfig, setGatewayConfig] = useState({
    gatewayUrl: 'https://sayed101-agi-system.hf.space',
    apiKey: '',
    model: 'agi-os-cortex',
    autonomousMode: true,
  });

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingThought('');

    await executeAgiPrompt(
      promptText,
      [...messages, userMsg],
      {
        currentSystemLevel: systemLevel,
        dagNodes,
      },
      {
        onToken: (token) => setStreamingContent((prev) => prev + token),
        onThought: (thought) => setStreamingThought((prev) => prev + thought),
        onSystemLevel: (level) => setSystemLevel(level),
        onDagUpdate: (nodes) => setDagNodes(nodes),
        onPatchUpdate: (patch) => setPatches((prev) => [patch, ...prev]),
        onComplete: (completeMsg) => {
          setMessages((prev) => [...prev, completeMsg]);
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingThought('');
        },
        onError: (err) => {
          console.error(err);
          setIsStreaming(false);
        },
      },
      gatewayConfig
    );
  };

  const handleStopStreaming = () => setIsStreaming(false);
  const handleClearHistory = () => setMessages([]);

  const levelColors: Record<string, string> = {
    L0: 'text-slate-400 bg-slate-500/20 border-slate-500/40',
    L1: 'text-sky-300 bg-sky-500/20 border-sky-500/40',
    L2: 'text-violet-300 bg-violet-500/20 border-violet-500/40',
    L3: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40',
    L4: 'text-amber-300 bg-amber-500/20 border-amber-500/40',
    L5: 'text-pink-300 bg-pink-500/20 border-pink-500/40',
  };

  return (
    <div dir="rtl" className="h-screen w-screen flex flex-col bg-[#050609] text-[#e2e8f0] overflow-hidden font-sans select-none">
      {/* Header */}
      <header className="h-14 px-5 border-b border-white/[0.06] bg-[#080b14]/95 flex items-center justify-between shrink-0 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <HoloOrb size="sm" isStreaming={isStreaming} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                AGI-OS Workspace
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${levelColors[systemLevel] || levelColors.L1}`}>
                {systemLevel}
              </span>
              {autonomousMode && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  Autonomous
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">Cognitive Agent Operating System</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Streaming</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Gov: 100/100</span>
          </div>
          <button
            onClick={() => setIsGatewayOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            Gateway
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-white/[0.06] bg-[#080a12] px-5 shrink-0">
        {[
          { key: 'chat' as const, icon: Sparkles, label: 'المحادثة والنواة الذكية' },
          { key: 'patcher' as const, icon: Code2, label: `الترقيع الذاتي (${patches.length})` },
          { key: 'dag' as const, icon: GitBranch, label: 'مسار العمليات (DAG)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingThought={streamingThought}
            systemLevel={systemLevel}
            language="ar"
            onSendMessage={handleSendPrompt}
            onStopStreaming={handleStopStreaming}
            onClearHistory={handleClearHistory}
            onNavigateToTool={(tool) => {
              if (tool.includes('patch')) setActiveTab('patcher');
              else setActiveTab('dag');
            }}
          />
        )}
        {activeTab === 'patcher' && (
          <AutoPatcherTab
            patches={patches}
            language="ar"
          />
        )}
        {activeTab === 'dag' && (
          <ExecutionDagTab
            nodes={dagNodes}
            language="ar"
            onReplayDag={() =>
              setDagNodes((prev) =>
                prev.map((n) => ({ ...n, status: 'completed' as const, executionTimeMs: Math.floor(60 + Math.random() * 120) }))
              )
            }
          />
        )}
      </main>

      {/* Gateway Modal */}
      {isGatewayOpen && (
        <GatewayModal
          config={gatewayConfig}
          onChange={setGatewayConfig}
          onClose={() => setIsGatewayOpen(false)}
        />
      )}
    </div>
  );
}
