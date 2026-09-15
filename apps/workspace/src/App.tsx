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
  FileTree,
  GitBranch,
  Globe,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

type CanvasTab = 'code' | 'preview' | 'terminal';

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
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThought, setStreamingThought] = useState('');
  const [canvasTab, setCanvasTab] = useState<CanvasTab>('code');
  const [isPaused, setIsPaused] = useState(false);

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

      {/* Split View Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Agent Chat Stream */}
        <div className="w-1/2 border-l border-white/[0.06] flex flex-col">
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
              if (tool.includes('patch')) setCanvasTab('code');
              else setCanvasTab('terminal');
            }}
          />
        </div>

        {/* Right Panel: Live Workspace Canvas */}
        <div className="w-1/2 flex flex-col">
          {/* Canvas Tabs */}
          <nav className="flex border-b border-white/[0.06] bg-[#080a12] px-4 shrink-0">
            {[
              { key: 'code' as const, icon: FileTree, label: 'المحرر' },
              { key: 'preview' as const, icon: Globe, label: 'المعاينة' },
              { key: 'terminal' as const, icon: Terminal, label: 'المحطة' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCanvasTab(tab.key)}
                className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition ${
                  canvasTab === tab.key
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}

            {/* Human-in-the-loop Controls */}
            <div className="mr-auto flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {isPaused ? 'استئناف' : 'إيقاف مؤقت'}
              </button>
            </div>
          </nav>

          {/* Canvas Content */}
          <div className="flex-1 overflow-hidden">
            {canvasTab === 'code' && (
              <AutoPatcherTab
                patches={patches}
                language="ar"
              />
            )}
            {canvasTab === 'preview' && (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>معاينة التطبيق المباشرة</p>
                  <p className="text-[10px] mt-1">ستظهر هنا عند بناء الوكيل للتطبيق</p>
                </div>
              </div>
            )}
            {canvasTab === 'terminal' && (
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
          </div>
        </div>
      </div>

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
