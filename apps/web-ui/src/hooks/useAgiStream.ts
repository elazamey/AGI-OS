'use client';
import { useCallback } from 'react';
import { agiClient } from '@/lib/agi-client';
import { useAgiStore } from '@/lib/store';

export function useAgiStream() {
  const { addMessage, setStreaming, setStreamingContent, appendStreamingContent, updateUsage, setGovernanceStatus } = useAgiStore();

  const sendMessage = useCallback(async (content: string) => {
    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    setStreaming(true);
    setStreamingContent('');
    setGovernanceStatus('planning');

    try {
      const stream = await agiClient.chat.completions.create({
        model: 'agi-os-local',
        messages: [
          { role: 'system', content: 'You are AGI-OS Cognitive Engine. Respond concisely. When executing tasks, describe what you are doing.' },
          { role: 'user', content },
        ],
        stream: true,
      });

      let fullContent = '';
      let usage = undefined;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          appendStreamingContent(delta);
          setGovernanceStatus('executing');
        }
        if (chunk.choices[0]?.finish_reason === 'stop') {
          setGovernanceStatus('completed');
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        usage: usage ? { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens } : undefined,
      });

      if (usage) updateUsage(usage.total_tokens);
      setStreamingContent('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addMessage({
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${message}`,
        timestamp: Date.now(),
      });
    } finally {
      setStreaming(false);
      setGovernanceStatus('idle');
    }
  }, [addMessage, setStreaming, setStreamingContent, appendStreamingContent, updateUsage, setGovernanceStatus]);

  return { sendMessage };
}
