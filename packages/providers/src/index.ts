// ============================================================================
// AGI OS - Provider Broker Package
// Cost-free provider management with fallback routing and CostGuard $0
// ============================================================================

// Types
export type {
  ProviderRequest,
  ChatMessage,
  ProviderResponse,
  TokenUsage,
  ProviderConfig,
  ProviderType,
  ProviderHealth,
  ProviderStatus,
  CostGuardConfig,
  CostGuardState,
  CostCheckResult,
  RouteDecision,
  RouteContext,
  QuotaUsage,
  ProviderAdapter,
} from './types.js';

// CostGuard
export { CostGuard, createCostGuard } from './cost-guard.js';

// Router
export { Router, createRouter } from './router.js';

// Broker
export { ProviderBroker, createProviderBroker } from './provider-broker.js';

// Adapters
export { OllamaAdapter, createOllamaAdapter } from './adapters/ollama.js';
export { GeminiAdapter, createGeminiAdapter } from './adapters/gemini.js';
export { OpenRouterAdapter, createOpenRouterAdapter } from './adapters/openrouter.js';
export { HuggingFaceAdapter, createHuggingFaceAdapter } from './adapters/huggingface.js';
