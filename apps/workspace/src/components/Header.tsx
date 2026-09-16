import React from 'react';
import type { TelemetryState } from '../types';
import {
  Activity,
  Brain,
  Coins,
  Globe,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
  onOpenGatewayModal: () => void;
  isWorkspaceOpen: boolean;
  onToggleWorkspace: () => void;
  telemetry: TelemetryState;
  isStreaming: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  onOpenGatewayModal,
  isWorkspaceOpen,
  onToggleWorkspace,
  telemetry,
  isStreaming,
}) => {
  const isAr = language === 'ar';

  return (
    <header className="h-12 px-4 border-b border-white/[0.06] bg-[#080b14]/95 flex items-center justify-between shrink-0 backdrop-blur-md z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-sm text-cyan-300 tracking-wide">AGI-OS</span>
          <span className="text-[10px] text-slate-500 font-mono">v1.34</span>
        </div>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Autonomous Agent Engine</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Activity className="w-3 h-3" />
          <span>{telemetry.totalTokens.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Coins className="w-3 h-3" />
          <span>${telemetry.costUsd.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <Zap className="w-3 h-3" />
          <span>{telemetry.missionsCompleted} missions</span>
        </div>

        {isStreaming && (
          <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Streaming</span>
          </div>
        )}

        <div className="h-4 w-px bg-white/[0.08]" />

        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
        >
          <Globe className="w-3 h-3" />
          <span>{isAr ? 'EN' : 'عربي'}</span>
        </button>

        <button
          onClick={onOpenGatewayModal}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
        >
          <Settings className="w-3 h-3" />
          <span>Gateway</span>
        </button>
      </div>
    </header>
  );
};
