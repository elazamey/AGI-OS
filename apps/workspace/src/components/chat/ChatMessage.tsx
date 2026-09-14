import React from 'react';
import { Message } from '../../types';
import { HoloOrb } from '../common/HoloOrb';
import { User, Bot, ShieldCheck, Wrench } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  language: 'ar' | 'en';
  onNavigateToTool?: (toolName: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, language, onNavigateToTool }) => {
  const isAr = language === 'ar';
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-[10px] text-slate-500 font-mono">
        <ShieldCheck className="w-3 h-3 text-emerald-500" />
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
            <User className="w-4 h-4 text-sky-400" />
          </div>
        ) : (
          <HoloOrb size="sm" isStreaming={false} />
        )}
      </div>

      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {message.thoughtProcess && (
          <div className="mb-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[10px] text-cyan-300/80 font-mono max-w-full border-r-2 border-r-cyan-400">
            <div className="font-semibold text-cyan-400 mb-1">💭 {isAr ? 'التفكير الخوارزمي' : 'Thought Process'}</div>
            {message.thoughtProcess}
          </div>
        )}

        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-sky-600/20 border border-sky-500/30 text-sky-100 rounded-tr-sm'
              : 'bg-[#111827] border border-white/[0.06] text-slate-200 rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc) => (
              <button
                key={tc.id}
                onClick={() => onNavigateToTool?.(tc.name)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[10px] text-violet-300 hover:bg-violet-500/25 transition-colors"
              >
                <Wrench className="w-2.5 h-2.5" />
                {tc.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 text-[9px] text-slate-600 font-mono">{message.timestamp}</div>
      </div>
    </div>
  );
};
