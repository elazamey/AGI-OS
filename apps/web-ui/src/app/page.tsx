'use client';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';
import { TelemetryBar } from '@/components/telemetry/TelemetryBar';
import { Cpu } from 'lucide-react';

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-agi-bg">
      {/* Top Bar */}
      <header className="h-12 border-b border-agi-border/50 bg-agi-surface/80 backdrop-blur-sm flex items-center px-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-agi-cyan/20 to-agi-purple/20 border border-agi-cyan/30 flex items-center justify-center">
            <Cpu size={16} className="text-agi-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">AGI-OS</h1>
            <p className="text-[9px] text-agi-muted leading-none mt-0.5">Cognitive Operating System</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="chip chip-green">
            <span className="w-1.5 h-1.5 rounded-full bg-agi-green animate-pulse" />
            Live
          </span>
          <span className="chip chip-cyan">L4 Compliant</span>
          <span className="text-[10px] text-agi-muted">elazamey-agi-system.hf.space</span>
        </div>
      </header>

      {/* Main Content — Dual View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="w-[45%] border-r border-agi-border/50 flex flex-col">
          <ChatPanel />
        </div>

        {/* Right: Canvas Panel */}
        <div className="w-[55%] flex flex-col">
          <CanvasPanel />
        </div>
      </div>

      {/* Bottom Telemetry Bar */}
      <TelemetryBar />
    </div>
  );
}
