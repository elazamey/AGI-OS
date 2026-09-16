// ============================================================================
// AGI OS - Provider Broker Types
// Unified interface for local (Ollama), direct API (Gemini), aggregators
// ============================================================================

// ---------------------------------------------------------------------------
// Unified Request / Response
// ---------------------------------------------------------------------------
export interface ProviderRequest {
  id: string;
  messages: ChatMessage[];
  model?: string;            // override per-request
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderResponse {
  id: string;
  requestId: string;
  providerId: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'error' | 'rate_limit' | 'quota_exceeded';
  usage: TokenUsage;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Provider Configuration
// ---------------------------------------------------------------------------
export type ProviderType = 'local' | 'cloud-free' | 'cloud-paid';

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  availableModels: string[];
  rateLimitRpm: number | null;
  rateLimitTpm: number | null;
  costPerInputToken: number;   // must be 0 for our system
  costPerOutputToken: number;  // must be 0 for our system
  maxRetries: number;
  timeoutMs: number;
  priority: number;            // lower = preferred
}

// ---------------------------------------------------------------------------
// Provider Status
// ---------------------------------------------------------------------------
export type ProviderHealth = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

export interface ProviderStatus {
  providerId: string;
  health: ProviderHealth;
  lastCheckAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  requestsInWindow: number;
  windowStartedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Cost Guard
// ---------------------------------------------------------------------------
export interface CostGuardConfig {
  maxSpendPerRequest: number;   // max $ per single request (default: 0)
  maxSpendPerDay: number;       // max $ per day (default: 0)
  maxSpendTotal: number;        // max $ lifetime (default: 0)
  warnAtPercent: number;        // warn when usage hits this % of limit (default: 80)
  blockOnQuotaExhausted: boolean;
}

export interface CostGuardState {
  spentToday: number;
  spentTotal: number;
  requestCount: number;
  blockedCount: number;
  lastResetAt: string;
}

export interface CostCheckResult {
  allowed: boolean;
  reason: string;
  estimatedCost: number;
  remainingDaily: number;
  remainingTotal: number;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
export interface RouteDecision {
  providerId: string;
  model: string;
  reason: string;
  fallbackChain: string[];
  confidence: number;
}

export interface RouteContext {
  request: ProviderRequest;
  excludeProviders?: string[];
  preferredModel?: string;
}

// ---------------------------------------------------------------------------
// Quota Monitor
// ---------------------------------------------------------------------------
export interface QuotaUsage {
  providerId: string;
  windowStart: string;
  windowEnd: string;
  requestsUsed: number;
  requestsLimit: number | null;
  tokensUsed: number;
  tokensLimit: number | null;
}

// ---------------------------------------------------------------------------
// Provider Adapter Interface
// ---------------------------------------------------------------------------
export interface ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  /**
   * Check if provider is reachable
   */
  healthCheck(): Promise<boolean>;

  /**
   * Send a completion request
   */
  complete(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Get current quota usage
   */
  getQuotaUsage(): Promise<QuotaUsage>;

  /**
   * Check if a model is available
   */
  isModelAvailable(model: string): boolean;
}
