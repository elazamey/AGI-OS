import React from 'react';
import { DagNode } from '../../types';
import { CheckCircle, Clock, Loader, XCircle, RotateCcw } from 'lucide-react';

interface ExecutionDagTabProps {
  nodes: DagNode[];
  language: 'ar' | 'en';
  onReplayDag: () => void;
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.3)]' },
  running: { icon: Loader, color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', glow: 'shadow-[0_0_8px_rgba(34,211,238,0.3)] animate-pulse' },
  pending: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', glow: '' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', glow: 'shadow-[0_0_8px_rgba(248,113,113,0.3)]' },
};

export const ExecutionDagTab: React.FC<ExecutionDagTabProps> = ({ nodes, language, onReplayDag }) => {
  const isAr = language === 'ar';

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
          {isAr ? 'مسار العمليات (DAG)' : 'Execution DAG'}
        </h3>
        <button
          onClick={onReplayDag}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold hover:bg-cyan-500/25 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          {isAr ? 'إعادة تشغيل' : 'Replay'}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-lg">
          {/* Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {nodes.map((node, i) => {
              if (i === 0) return null;
              const x1 = 50;
              const y1 = ((i - 1) / (nodes.length - 1)) * 80 + 10;
              const x2 = 50;
              const y2 = (i / (nodes.length - 1)) * 80 + 10;
              return (
                <line
                  key={`line-${node.id}`}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          <div className="relative space-y-3">
            {nodes.map((node, i) => {
              const config = STATUS_CONFIG[node.status];
              const Icon = config.icon;
              return (
                <div key={node.id} className="flex items-center gap-3 relative z-10">
                  <div className={`w-8 h-8 rounded-full ${config.bg} border ${config.border} flex items-center justify-center ${config.glow}`}>
                    <Icon className={`w-4 h-4 ${config.color} ${node.status === 'running' ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="flex-1 bg-[#0d1117] border border-white/[0.06] rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{node.label}</div>
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {isAr ? 'الأوباش' : 'Node'} {i + 1}/{nodes.length}
                      </div>
                    </div>
                    {node.executionTimeMs && (
                      <div className="text-[10px] text-slate-500 font-mono">{node.executionTimeMs}ms</div>
                    )}
                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${config.bg} ${config.color} border ${config.border}`}>
                      {node.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
