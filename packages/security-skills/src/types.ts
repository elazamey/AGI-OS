export interface SecurityScanResult {
  id: string;
  scanner: string;
  target: string;
  threats: Threat[];
  score: number;
  passed: boolean;
  timestamp: string;
}

export interface Threat {
  id: string;
  type: 'secret' | 'injection' | 'traversal' | 'command_risk' | 'dependency' | 'permission' | 'injection_prompt' | 'tool_abuse';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  location?: string;
  recommendation: string;
}

export interface CommandRiskResult {
  command: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  allowed: boolean;
}
