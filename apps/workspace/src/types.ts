export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  thought?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface DagNode {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executionTimeMs?: number;
  dependencies?: string[];
}

export interface PatchAuditItem {
  id: string;
  fileName: string;
  description: string;
  diff: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  applied: boolean;
  governanceScore: number;
}

export interface FileTreeItem {
  id: string;
  name: string;
  path?: string;
  type: 'file' | 'folder';
  language?: string;
  content?: string;
  children?: FileTreeItem[];
}

export interface SystemLevel {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export interface TelemetryState {
  totalTokens: number;
  costUsd: number;
  uptime: string;
  missionsCompleted: number;
  governanceScore: number;
}

export interface GatewayConfig {
  gatewayUrl: string;
  apiKey: string;
  model: string;
  autonomousMode: boolean;
}
