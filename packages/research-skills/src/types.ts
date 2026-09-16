export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  quality: number;
  retrievedAt: string;
}

export interface Claim {
  id: string;
  text: string;
  evidence: Evidence[];
  confidence: number;
  sources: string[];
}

export interface Evidence {
  sourceId: string;
  text: string;
  relevance: number;
  supports: boolean;
}

export interface ResearchReport {
  id: string;
  query: string;
  claims: Claim[];
  contradictions: Array<{ claim1: string; claim2: string; reason: string }>;
  overallConfidence: number;
  sources: ResearchSource[];
  synthesizedAt: string;
}
