'use client';
import { useAgiStore } from '@/lib/store';
import { Shield, Cpu, Coins, Activity, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TelemetryBar() {
  const { totalTokens, totalCostUsd, governanceStatus, messages } = useAgiStore();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:4000/health');
        setConnected(res.ok);
      } catch { setConnected(false); }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-8 border-t border-agi-border/50 bg-agi-surface/80 backdrop-blur-sm flex items-center px-4 gap-4 text-[10px] text-agi-muted">
      {/* Connection */}
      <div className="flex items-center gap-1">
        {connected ? <Wifi size={10} className="text-agi-green" /> : <WifiOff size={10} className="text-red-400" />}
        <span className={connected ? 'text-agi-green' : 'text-red-400'}>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="w-px h-3 bg-agi-border/50" />

      {/* Governance */}
      <div className="flex items-center gap-1">
        <Shield size={10} className={governanceStatus === 'executing' ? 'text-agi-cyan' : 'text-agi-muted'} />
        <span>Policy: {governanceStatus || 'idle'}</span>
      </div>

      <div className="w-px h-3 bg-agi-border/50" />

      {/* Tokens */}
      <div className="flex items-center gap-1">
        <Cpu size={10} className="text-agi-orange" />
        <span>{totalTokens.toLocaleString()} tokens</span>
      </div>

      <div className="w-px h-3 bg-agi-border/50" />

      {/* Cost */}
      <div className="flex items-center gap-1">
        <Coins size={10} className="text-agi-green" />
        <span>${totalCostUsd.toFixed(4)}</span>
      </div>

      <div className="w-px h-3 bg-agi-border/50" />

      {/* Messages */}
      <div className="flex items-center gap-1">
        <Activity size={10} className="text-agi-purple" />
        <span>{messages.length} messages</span>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1">
        <span className="text-agi-cyan font-medium">AGI-OS</span>
        <span className="text-agi-muted">v1.25.1</span>
      </div>
    </div>
  );
}
