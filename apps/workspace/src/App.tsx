import React, { useState } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/chat/ChatPanel';
import { AutoPatcherTab } from './components/canvas/AutoPatcherTab';
import { ExecutionDagTab } from './components/canvas/ExecutionDagTab';
import {
  INITIAL_DAG_NODES,
  INITIAL_FILES,
  INITIAL_MESSAGES,
  INITIAL_PATCH_AUDIT,
  INITIAL_TELEMETRY,
  SYSTEM_LEVELS,
} from './data/mockData';
import { executeAgiPrompt } from './lib/agi-client';
import { DagNode, FileTreeItem, Message, PatchAuditItem, TelemetryState } from './types';
import {
  Code2,
  FileCode,
  Folder,
  GitBranch,
  X,
} from 'lucide-react';

export default function App() {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [activeCanvasTab, setActiveCanvasTab] = useState<'dag' | 'patcher' | 'files'>('patcher');

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [systemLevel, setSystemLevel] = useState('L0');
  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [dagNodes, setDagNodes] = useState<DagNode[]>(INITIAL_DAG_NODES);
  const [patchAudit, setPatchAudit] = useState<PatchAuditItem>(INITIAL_PATCH_AUDIT);
  const [fileTree] = useState<FileTreeItem[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<FileTreeItem | null>(INITIAL_FILES[1]?.children?.[0]?.children?.[0] || null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThought, setStreamingThought] = useState('');

  const [gatewayConfig, setGatewayConfig] = useState({
    gatewayUrl: 'http://localhost:4000/v1',
    apiKey: 'agi-os-sk-local-test-key',
    model: 'agi-os-cortex-v2.5',
    autonomousMode: true,
  });

  const isAr = language === 'ar';
  const currentSystemInfo = SYSTEM_LEVELS[systemLevel];

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingThought('');

    await executeAgiPrompt(
      text,
      [...messages, userMsg],
      {
        onToken: (chunk) => setStreamingContent((prev) => prev + chunk),
        onThought: (thoughtChunk) => setStreamingThought((prev) => prev + thoughtChunk),
        onSystemLevel: (level) => setSystemLevel(level),
        onDagUpdate: (updatedNodes) => setDagNodes(updatedNodes),
        onPatchUpdate: (updatedPatch) => setPatchAudit(updatedPatch),
        onComplete: (fullMessage) => {
          setMessages((prev) => [...prev, fullMessage]);
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingThought('');
          setTelemetry((prev) => ({
            ...prev,
            totalTokens: prev.totalTokens + 650,
            costUsd: prev.costUsd + 0.0018,
          }));
        },
        onError: (err) => {
          console.error(err);
          setIsStreaming(false);
        },
      },
      gatewayConfig
    );
  };

  const handleNavigateToTool = (toolName: string) => {
    if (toolName.includes('patch') || toolName.includes('audit')) {
      setActiveCanvasTab('patcher');
    } else {
      setActiveCanvasTab('dag');
    }
    setIsWorkspaceOpen(true);
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="h-screen w-screen flex flex-col bg-[#050609] text-[#e2e8f0] overflow-hidden font-sans select-none">
      <Header
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'ar' ? 'en' : 'ar'))}
        onOpenGatewayModal={() => setIsGatewayModalOpen(true)}
        isWorkspaceOpen={isWorkspaceOpen}
        onToggleWorkspace={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
        telemetry={telemetry}
        isStreaming={isStreaming}
      />

      {/* System Level Banner */}
      <div className="h-7 px-4 border-b border-white/[0.06] bg-[#080b14]/90 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: currentSystemInfo.accentColor }} />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentSystemInfo.badgeBg} ${currentSystemInfo.badgeBorder} ${currentSystemInfo.badgeText} border`}>
            {currentSystemInfo.code}
          </span>
          <span className="text-slate-300 font-medium hidden sm:inline">
            {isAr ? currentSystemInfo.nameAr : currentSystemInfo.nameEn}
          </span>
          <span className="text-slate-600 hidden md:inline">•</span>
          <span className="text-slate-400 text-[11px] hidden md:inline">
            {isAr ? currentSystemInfo.descriptionAr : currentSystemInfo.descriptionEn}
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Chat Panel */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isWorkspaceOpen ? 'lg:max-w-[45%] xl:max-w-[40%]' : 'w-full'}`}>
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingThought={streamingThought}
            systemLevel={systemLevel}
            language={language}
            onSendMessage={handleSendMessage}
            onStopStreaming={() => setIsStreaming(false)}
            onClearHistory={() => setMessages([])}
            onNavigateToTool={handleNavigateToTool}
          />
        </div>

        {/* Canvas Workspace */}
        {isWorkspaceOpen && (
          <div className="hidden lg:flex flex-1 flex-col border-l border-white/[0.08] bg-[#070911] min-w-0 shadow-2xl relative">
            {/* Tab Header */}
            <div className="h-11 px-3 border-b border-white/[0.08] bg-[#080a12] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                {[
                  { key: 'patcher' as const, icon: Code2, labelAr: 'الترقيع الذاتي', labelEn: 'Auto-Patcher', color: 'purple' },
                  { key: 'dag' as const, icon: GitBranch, labelAr: 'مسار العمليات', labelEn: 'Execution DAG', color: 'cyan' },
                  { key: 'files' as const, icon: Folder, labelAr: 'شجرة الملفات', labelEn: 'Project Files', color: 'blue' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCanvasTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                      activeCanvasTab === tab.key
                        ? `bg-${tab.color}-500/20 text-${tab.color}-300 border border-${tab.color}-500/40 shadow-[0_0_12px_rgba(var(--tw-shadow-color),0.2)]`
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <tab.icon className={`w-3.5 h-3.5 text-${tab.color}-400`} />
                    <span>{isAr ? tab.labelAr : tab.labelEn}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsWorkspaceOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Body */}
            <div className="flex-1 overflow-hidden relative">
              {activeCanvasTab === 'patcher' && (
                <AutoPatcherTab
                  patchItem={patchAudit}
                  language={language}
                  onApplyPatch={() => setPatchAudit((prev) => ({ ...prev, applied: !prev.applied }))}
                />
              )}
              {activeCanvasTab === 'dag' && (
                <ExecutionDagTab
                  nodes={dagNodes}
                  language={language}
                  onReplayDag={() =>
                    setDagNodes((prev) =>
                      prev.map((n) => ({ ...n, status: 'completed' as const, executionTimeMs: Math.floor(60 + Math.random() * 120) }))
                    )
                  }
                />
              )}
              {activeCanvasTab === 'files' && (
                <div className="h-full flex bg-[#080a12]">
                  <div className="w-64 border-r border-white/[0.08] bg-[#060810] p-3 overflow-y-auto space-y-2 font-mono text-xs">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider px-2 py-1">
                      {isAr ? 'مستكشف النظام' : 'SYSTEM EXPLORER'}
                    </div>
                    {fileTree.map((folder) => (
                      <div key={folder.id} className="space-y-1">
                        <div className="flex items-center gap-1.5 text-cyan-300 px-2 py-1 rounded bg-white/[0.02]">
                          <Folder className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold">{folder.name}</span>
                        </div>
                        <div className="pl-4 space-y-0.5">
                          {folder.children?.map((sub) => (
                            <div key={sub.id} className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-400 px-2 py-0.5 text-[11px]">
                                <Folder className="w-3 h-3 text-slate-500" />
                                <span>{sub.name}</span>
                              </div>
                              <div className="pl-4 space-y-0.5">
                                {sub.children?.map((file) => (
                                  <button
                                    key={file.id}
                                    onClick={() => setSelectedFile(file)}
                                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
                                      selectedFile?.id === file.id
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                                    }`}
                                  >
                                    <FileCode className="w-3 h-3 text-cyan-400" />
                                    <span className="truncate">{file.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col bg-[#080b15] overflow-hidden">
                    <div className="h-9 px-4 border-b border-white/[0.06] bg-black/40 flex items-center justify-between font-mono text-xs">
                      <span className="text-cyan-300">{selectedFile?.path || '/packages/gateway/src/auth-guard.ts'}</span>
                      <span className="text-slate-500">{selectedFile?.language || 'typescript'}</span>
                    </div>
                    <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 leading-relaxed bg-[#05070f]">
                      <pre className="whitespace-pre">{selectedFile?.content || '// Select a file from tree explorer'}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gateway Modal */}
      {isGatewayModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0e1b] border border-cyan-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <span>{isAr ? 'إعدادات بوابة AGI-OS' : 'AGI-OS Gateway Config'}</span>
              </div>
              <button onClick={() => setIsGatewayModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">{isAr ? 'عنوان البوابة:' : 'Gateway URL:'}</label>
                <input
                  type="text"
                  value={gatewayConfig.gatewayUrl}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, gatewayUrl: e.target.value })}
                  className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">{isAr ? 'مفتاح الوصول:' : 'API Key:'}</label>
                <input
                  type="password"
                  value={gatewayConfig.apiKey}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })}
                  className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">{isAr ? 'معرف النموذج:' : 'Model ID:'}</label>
                <input
                  type="text"
                  value={gatewayConfig.model}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, model: e.target.value })}
                  className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="pt-3 border-t border-white/[0.08] flex justify-end">
              <button
                onClick={() => setIsGatewayModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-bold transition-all"
              >
                {isAr ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
