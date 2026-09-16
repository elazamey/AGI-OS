export interface VerificationResult {
  id: string;
  skillId: string;
  action: string;
  verified: boolean;
  confidence: number;
  evidence: EvidenceItem[];
  timestamp: string;
}

export interface EvidenceItem {
  type:
    | 'file_exists'
    | 'build_passed'
    | 'test_passed'
    | 'screenshot'
    | 'hash_match'
    | 'output_match'
    | 'commit_exists'
    | 'custom';
  description: string;
  value: unknown;
  verified: boolean;
}

export interface VerificationRequest {
  skillId: string;
  action: string;
  expectedOutput?: unknown;
  actualOutput: unknown;
  level: 'BASIC' | 'STRICT' | 'PROOF';
}
