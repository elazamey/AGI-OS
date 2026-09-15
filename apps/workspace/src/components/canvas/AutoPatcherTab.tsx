import React from 'react';
import type { PatchAuditItem } from '../../types';
import {
  AlertTriangle,
  CheckCircle,
  Code2,
  GitCompare,
  ShieldCheck,
} from 'lucide-react';

interface AutoPatcherTabProps {
  patches: PatchAuditItem[];
  language: 'ar' | 'en';
}

const RISK_CONFIG = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', labelAr: 'منخفض', labelEn: 'Low' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', labelAr: 'متوسط', labelEn: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', labelAr: 'مرتفع', labelEn: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', labelAr: 'حرج', labelEn: 'Critical' },
};

export const AutoPatcherTab: React.FC<AutoPatcherTabProps> = ({ patches, language }) => {
  const isAr = language === 'ar';

  if (patches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 p-8">
        <Code2 className="w-12 h-12 text-slate-600" />
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-400 mb-1">
            {isAr ? 'لا توجد ترقيعات بعد' : 'No patches yet'}
          </div>
          <div className="text-xs text-slate-600">
            {isAr ? 'سيظهر الترقيع هنا عندما يكتشف النظام ثغرة أو يطلب تطبيق ترقيع' : 'Patches appear when the system detects a vulnerability or applies a fix'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            {isAr ? 'الترقيع الذاتي' : 'Auto-Patcher'}
          </h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            {patches.length}
          </span>
        </div>
      </div>

      {patches.map((patch) => {
        const risk = RISK_CONFIG[patch.riskLevel];
        return (
          <div key={patch.id} className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <GitCompare className="w-3 h-3" />
                <span>{patch.fileName}</span>
              </div>
              <div className={`px-2.5 py-1 rounded-lg ${risk.bg} border ${risk.border} text-[10px] font-bold ${risk.color}`}>
                {isAr ? risk.labelAr : risk.labelEn}
              </div>
            </div>

            <div className="text-xs text-slate-300">{patch.description}</div>

            <div className="bg-[#05070f] border border-white/[0.06] rounded-lg overflow-hidden">
              <div className="h-7 px-3 border-b border-white/[0.06] bg-black/40 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                <span className="text-[9px] text-slate-500 font-mono mr-2">unified diff</span>
              </div>
              <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
                {patch.diff.split('\n').map((line, i) => {
                  let colorClass = 'text-slate-400';
                  let bgClass = '';
                  if (line.startsWith('+')) { colorClass = 'text-emerald-400'; bgClass = 'bg-emerald-500/5'; }
                  else if (line.startsWith('-')) { colorClass = 'text-red-400'; bgClass = 'bg-red-500/5'; }
                  else if (line.startsWith('@@')) { colorClass = 'text-cyan-400'; bgClass = 'bg-cyan-500/5'; }
                  return (
                    <div key={i} className={`${bgClass} px-2 -mx-2`}>
                      <span className="text-slate-600 inline-block w-6 text-right mr-2">{i + 1}</span>
                      <span className={colorClass}>{line}</span>
                    </div>
                  );
                })}
              </pre>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-300">{isAr ? 'الحوكمة' : 'Governance'}</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{patch.governanceScore}/100</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                patch.applied
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              }`}>
                {patch.applied ? (
                  <><CheckCircle className="w-3 h-3" /> {isAr ? 'مُطبَّق' : 'Applied'}</>
                ) : (
                  <><AlertTriangle className="w-3 h-3" /> {isAr ? 'قيد المراجعة' : 'Pending'}</>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
