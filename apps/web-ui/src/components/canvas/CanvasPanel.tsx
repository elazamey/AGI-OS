'use client';
import { useAgiStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { Activity, Shield, Cpu, Database, Zap, Clock, CheckCircle2, AlertCircle, Loader2, Wrench, Eye } from 'lucide-react';
import { IntegrationsPanel } from './IntegrationsPanel';
import { backendUrl } from '@/lib/backend';

export function CanvasPanel() {
  const { missions, totalTokens, totalCostUsd, governanceStatus, activeTools } = useAgiStore();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [models, setModels] = useState<Array<{ id: string; owned_by: string }>>([]);
  const [activeTab, setActiveTab] = useState<'missions' | 'tools' | 'system' | 'integrations'>('missions');

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(backendUrl('/health'));
        const data = await res.json();
        setHealth(data.data || data);
      } catch { /* ignore */ }
    };
    const fetchModels = async () => {
      try {
        const res = await fetch(backendUrl('/v1/models'));
        const data = await res.json();
        setModels(data.data || []);
      } catch { /* ignore */ }
    };
    fetchHealth();
    fetchModels();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const statusIcon = (s: string) => {
    if (s === 'completed' || s === 'ok') return <CheckCircle2 size={14} className="text-agi-green" />;
    if (s === 'executing' || s === 'planning') return <Loader2 size={14} className="text-agi-cyan animate-spin" />;
    if (s === 'failed') return <AlertCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-agi-muted" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-agi-border/50">
        <Activity size={18} className="text-agi-green" />
        <span className="font-semibold text-sm">Canvas</span>
        <div className="ml-auto flex gap-1">
          {['missions', 'tools', 'integrations', 'system'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                activeTab === tab ? 'bg-agi-cyan/10 text-agi-cyan border border-agi-cyan/30' : 'text-agi-muted hover:text-agi-text hover:bg-white/5'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Status Chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`chip ${governanceStatus === 'executing' ? 'chip-cyan' : governanceStatus === 'completed' ? 'chip-green' : 'chip-purple'}`}>
            <Shield size={10} />
            {governanceStatus || 'idle'}
          </span>
          <span className="chip chip-orange">
            <Cpu size={10} />
            {totalTokens.toLocaleString()} tokens
          </span>
          <span className="chip chip-green">
            <Database size={10} />
            ${totalCostUsd.toFixed(4)}
          </span>
          {activeTools.length > 0 && (
            <span className="chip chip-purple">
              <Wrench size={10} />
              {activeTools.length} tools
            </span>
          )}
        </div>

        {/* Missions Tab */}
        {activeTab === 'missions' && (
          <div className="space-y-2">
            {missions.length === 0 ? (
              <div className="text-center py-8 text-agi-muted text-xs">
                <Activity size={24} className="mx-auto mb-2 opacity-30" />
                <p>No missions yet</p>
              </div>
            ) : (
              missions.slice().reverse().map((m, i) => (
                <div key={i} className="glass p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(m.status)}
                      <span className="text-xs font-medium">{m.stage}</span>
                    </div>
                    <span className="text-[10px] text-agi-muted">{m.event}</span>
                  </div>
                  <div className="text-xs text-agi-muted truncate">{m.id}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className="space-y-2">
            {activeTools.length === 0 ? (
              <div className="text-center py-8 text-agi-muted text-xs">
                <Wrench size={24} className="mx-auto mb-2 opacity-30" />
                <p>No tools active</p>
              </div>
            ) : (
              activeTools.map((tool, i) => (
                <div key={i} className="glass p-3 rounded-xl flex items-center gap-2">
                  <Zap size={14} className="text-agi-orange" />
                  <span className="text-xs">{tool}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && <IntegrationsPanel />}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-3">
            {/* Health */}
            <div className="glass p-3 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                {statusIcon(String(health?.status || 'unknown'))}
                <span className="text-xs font-medium">System Health</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-agi-muted">
                <div>Version: {String(health?.version || '—')}</div>
                <div>Uptime: {health?.uptime ? `${Math.floor(Number(health.uptime))}s` : '—'}</div>
                <div>Missions: {String(health?.missions || 0)}</div>
                <div>Skills: {String(health?.skills || 0)}</div>
              </div>
            </div>

            {/* Models */}
            <div className="glass p-3 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={14} className="text-agi-purple" />
                <span className="text-xs font-medium">Models</span>
              </div>
              <div className="space-y-1">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-agi-text">{m.id}</span>
                    <span className="text-agi-muted">{m.owned_by}</span>
                  </div>
                ))}
                {models.length === 0 && <div className="text-agi-muted text-[10px]">Loading...</div>}
              </div>
            </div>

            {/* Capabilities */}
            <div className="glass p-3 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={14} className="text-agi-cyan" />
                <span className="text-xs font-medium">Capabilities</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['planning', 'execution', 'verification', 'rollback', 'tool-calling', 'streaming', 'openai-L4', 'webhooks', 'governance'].map((cap) => (
                  <span key={cap} className="chip chip-cyan text-[9px]">{cap}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
