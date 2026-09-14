import React from 'react';
import { PatchAuditItem } from '../../types';
import {
  AlertTriangle,
  CheckCircle,
  Code2,
  GitCompare,
  ShieldCheck,
} from 'lucide-react';

interface AutoPatcherTabProps {
  patchItem: PatchAuditItem;
  language: 'ar' | 'en';
  onApplyPatch: () => void;
}

const RISK_CONFIG = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: { ar: 'منخفض', en: 'Low' } },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: { ar: 'متوسط', en: 'Medium' } },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', label: { ar: 'مرتفع', en: 'High' } },
  critical: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: { ar: 'حرج', en: 'Critical' } },
};

export const AutoPatcherTab: React.FC<AutoPatcherTabProps> = ({ patchItem, language, onApplyPatch }) => {
  const isAr = language === 'ar';
  const risk = RISK_CONFIG[patchItem.riskLevel];

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            {isAr ? 'الترقيع الذاتي' : 'Auto-Patcher'}
          </h3>
        </div>
        <div className={`px-2.5 py-1 rounded-lg ${risk.bg} border ${risk.border} text-[10px] font-bold ${risk.color}`}>
          {isAr ? risk.label.ar : risk.label.en}
        </div>
      </div>

      {/* File Info */}
      <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-1">
          <GitCompare className="w-3 h-3" />
          <span>{patchItem.fileName}</span>
        </div>
        <div className="text-xs text-slate-300">{patchItem.description}</div>
      </div>

      {/* Diff View */}
      <div className="bg-[#05070f] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="h-8 px-3 border-b border-white/[0.06] bg-black/40 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          <span className="text-[9px] text-slate-500 font-mono mr-2">unified diff</span>
        </div>
        <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
          {patchItem.diff.split('\n').map((line, i) => {
            let colorClass = 'text-slate-400';
            let bgClass = '';
            if (line.startsWith('+')) {
              colorClass = 'text-emerald-400';
              bgClass = 'bg-emerald-500/5';
            } else if (line.startsWith('-')) {
              colorClass = 'text-red-400';
              bgClass = 'bg-red-500/5';
            } else if (line.startsWith('@@')) {
              colorClass = 'text-cyan-400';
              bgClass = 'bg-cyan-500/5';
            }
            return (
              <div key={i} className={`${bgClass} px-2 -mx-2`}>
                <span className="text-slate-600 inline-block w-6 text-right mr-2">{i + 1}</span>
                <span className={colorClass}>{line}</span>
              </div>
            );
          })}
        </pre>
      </div>

      {/* Governance Score */}
      <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-300">{isAr ? 'نتيجة الحوكمة' : 'Governance Score'}</span>
        </div>
        <span className="text-sm font-bold text-emerald-400 font-mono">{patchItem.governanceScore}/100</span>
      </div>

      {/* Apply Button */}
      <button
        onClick={onApplyPatch}
        disabled={patchItem.applied}
        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
          patchItem.applied
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-default'
            : 'bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.2)]'
        }`}
      >
        {patchItem.applied ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle className="w-3.5 h-3.5" />
            {isAr ? 'تم التطبيق بنجاح' : 'Applied Successfully'}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isAr ? 'تطبيق الترقيع' : 'Apply Patch'}
          </span>
        )}
      </button>
    </div>
  );
};
