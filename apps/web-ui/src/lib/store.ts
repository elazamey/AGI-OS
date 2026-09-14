import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolCalls?: Array<{ name: string; arguments: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface MissionUpdate {
  id: string;
  status: string;
  stage: string;
  event: string;
  timestamp: number;
}

interface AgiStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  missions: MissionUpdate[];
  totalTokens: number;
  totalCostUsd: number;
  governanceStatus: string;
  activeTools: string[];
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  setStreamingContent: (c: string) => void;
  appendStreamingContent: (c: string) => void;
  addMissionUpdate: (u: MissionUpdate) => void;
  updateUsage: (tokens: number) => void;
  setGovernanceStatus: (s: string) => void;
  setActiveTools: (t: string[]) => void;
  clearMessages: () => void;
}

export const useAgiStore = create<AgiStore>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  missions: [],
  totalTokens: 0,
  totalCostUsd: 0,
  governanceStatus: 'idle',
  activeTools: [],

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setStreaming: (v) => set({ isStreaming: v }),
  setStreamingContent: (c) => set({ streamingContent: c }),
  appendStreamingContent: (c) => set((s) => ({ streamingContent: s.streamingContent + c })),
  addMissionUpdate: (u) => set((s) => ({ missions: [...s.missions.slice(-50), u] })),
  updateUsage: (tokens) => set((s) => ({ totalTokens: s.totalTokens + tokens, totalCostUsd: s.totalCostUsd + tokens * 0.000001 })),
  setGovernanceStatus: (g) => set({ governanceStatus: g }),
  setActiveTools: (t) => set({ activeTools: t }),
  clearMessages: () => set({ messages: [], missions: [], totalTokens: 0 }),
}));
