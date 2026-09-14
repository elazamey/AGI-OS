'use client';
import { useState, useRef, useEffect } from 'react';
import { useAgiStore } from '@/lib/store';
import { useAgiStream } from '@/hooks/useAgiStream';
import { Send, Loader2, Bot, User, Trash2 } from 'lucide-react';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const { messages, isStreaming, streamingContent, clearMessages } = useAgiStore();
  const { sendMessage } = useAgiStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-agi-border/50">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-agi-cyan" />
          <span className="font-semibold text-sm">AGI-OS Chat</span>
          <span className="chip chip-cyan">L4</span>
        </div>
        <button onClick={clearMessages} className="p-1.5 rounded-lg hover:bg-white/5 text-agi-muted hover:text-agi-text transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-agi-muted text-sm">
            <div className="text-center">
              <Bot size={40} className="mx-auto mb-3 opacity-30" />
              <p>Start a conversation with AGI-OS</p>
              <p className="text-xs mt-1 opacity-50">Governed • Scoped • Observable</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-agi-cyan/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-agi-cyan" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user' ? 'msg-user' : msg.role === 'system' ? 'chip-red' : 'msg-assistant'
            }`}>
              {msg.content}
              {msg.usage && (
                <div className="mt-1.5 flex gap-2 text-[10px] text-agi-muted">
                  <span>{msg.usage.total_tokens} tokens</span>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <User size={14} className="text-purple-400" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-agi-cyan/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Bot size={14} className="text-agi-cyan" />
            </div>
            <div className="msg-assistant px-3 py-2 rounded-xl text-sm leading-relaxed streaming-cursor">
              {streamingContent}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-agi-border/50">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            disabled={isStreaming}
            className="flex-1 bg-agi-surface border border-agi-border/50 rounded-xl px-4 py-2.5 text-sm text-agi-text placeholder:text-agi-muted focus:outline-none focus:border-agi-cyan/50 focus:ring-1 focus:ring-agi-cyan/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-agi-cyan/10 border border-agi-cyan/30 text-agi-cyan hover:bg-agi-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
