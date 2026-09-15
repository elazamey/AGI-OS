import OpenAI from 'openai';
import { BACKEND_ORIGIN } from '@/lib/backend';

export const agiClient = new OpenAI({
  // Single origin source: see lib/backend.ts (this used to point at a
  // different owner's Space than the rest of the app, so the gateway looked dead).
  baseURL: process.env.NEXT_PUBLIC_AGI_GATEWAY_URL || `${BACKEND_ORIGIN}/v1`,
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
