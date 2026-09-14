import OpenAI from 'openai';

export const agiClient = new OpenAI({
  baseURL: process.env.NEXT_PUBLIC_AGI_GATEWAY_URL || 'https://sayed101-agi-system.hf.space/v1',
  apiKey: process.env.NEXT_PUBLIC_AGI_API_KEY || 'agi-os-dev-key-2026',
  dangerouslyAllowBrowser: true,
});

export interface MissionEvent {
  stage: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface Mission {
  id: string;
  prompt: string;
  status: string;
  lifecycle_stage: string;
  created_at: number;
  updated_at: number;
  result?: unknown;
  events: MissionEvent[];
}

export interface StreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
