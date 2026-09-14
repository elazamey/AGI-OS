import React from 'react';
import { X, Globe, Key, Cpu } from 'lucide-react';

interface GatewayConfig {
  gatewayUrl: string;
  apiKey: string;
  model: string;
  autonomousMode: boolean;
}

interface GatewayModalProps {
  config: GatewayConfig;
  onChange: (config: GatewayConfig) => void;
  onClose: () => void;
}

export const GatewayModal: React.FC<GatewayModalProps> = ({ config, onChange, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b0e1b] border border-cyan-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>إعدادات بوابة AGI-OS</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-slate-400 block mb-1 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              عنوان البوابة (Gateway URL):
            </label>
            <input
              type="text"
              value={config.gatewayUrl}
              onChange={(e) => onChange({ ...config, gatewayUrl: e.target.value })}
              className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
              placeholder="https://elazamey-agi-system.hf.space"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 flex items-center gap-1.5">
              <Key className="w-3 h-3" />
              مفتاح الوصول (API Key):
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
              className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
              placeholder="اتركه فارغاً للوضع المحلي"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 flex items-center gap-1.5">
              <Cpu className="w-3 h-3" />
              معرف النموذج (Model ID):
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => onChange({ ...config, model: e.target.value })}
              className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-cyan-300 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              checked={config.autonomousMode}
              onChange={(e) => onChange({ ...config, autonomousMode: e.target.checked })}
              className="rounded border-cyan-500"
            />
            <label className="text-slate-400 text-xs">تفعيل الوضع المستقل (Autonomous Mode)</label>
          </div>
        </div>

        <div className="pt-3 border-t border-white/[0.08] flex justify-between">
          <div className="text-[9px] text-slate-600">
            سيتم الاتصال بالخادم، أو التحول للوضع المحلي تلقائياً
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-bold transition-all"
          >
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
