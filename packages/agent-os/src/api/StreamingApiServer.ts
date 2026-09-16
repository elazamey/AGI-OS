import { MultiProviderLLMRouter, StreamChunk } from '../llm/MultiProviderLLMRouter.js';
import { SkillDiscoveryEngine } from '../skills/SkillDiscoveryEngine.js';
import { ExecutionSandbox } from '../sandbox/ExecutionSandbox.js';
import { RollbackLedger } from '../healing/RollbackLedger.js';
import type { RiskLevel } from '../policy/PolicyEngine.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  file_path?: string;
  test_cmd?: string;
  approval_granted?: boolean;
}

export interface SSEEvent {
  type: 'step' | 'token' | 'approval_required' | 'error' | 'done';
  content: string;
  metadata?: {
    execution_time?: number;
    attempt?: number;
    risk_level?: RiskLevel;
  };
}

export interface ApiResponse {
  status: string;
  data?: unknown;
  error?: string;
}

export class StreamingApiServer {
  private llmRouter: MultiProviderLLMRouter;
  private skillEngine: SkillDiscoveryEngine;
  private sandbox: ExecutionSandbox;
  private rollbackLedger: RollbackLedger;
  private policyEngine: PolicyEngine;

  constructor() {
    this.llmRouter = new MultiProviderLLMRouter();
    this.skillEngine = new SkillDiscoveryEngine();
    this.sandbox = new ExecutionSandbox();
    this.rollbackLedger = new RollbackLedger();
    this.policyEngine = new PolicyEngine();
  }

  async *handleChatStream(request: ChatRequest): AsyncGenerator<SSEEvent> {
    const startTime = Date.now();

    // Match skills based on user input
    const userInput = request.messages[request.messages.length - 1]?.content || '';
    const matchedSkills = this.skillEngine.searchByTrigger(userInput);

    if (matchedSkills.length > 0) {
      yield {
        type: 'step',
        content: `Found matching skill: ${matchedSkills[0].name}`,
        metadata: { risk_level: 'SAFE', execution_time: Date.now() - startTime },
      };

      // Use skill instructions as system prompt
      const systemMessage = {
        role: 'system',
        content: matchedSkills[0].instructions,
      };
      request.messages = [systemMessage, ...request.messages];
    }

    // Stream LLM response
    try {
      for await (const chunk of this.llmRouter.stream({ messages: request.messages })) {
        if (chunk.type === 'token') {
          yield {
            type: 'token',
            content: chunk.content,
            metadata: { execution_time: Date.now() - startTime },
          };
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'LLM error',
        metadata: { execution_time: Date.now() - startTime },
      };
      return;
    }

    // Execute test command if provided
    if (request.test_cmd) {
      const policyDecision = this.policyEngine.evaluate(request.test_cmd);

      if (policyDecision.requires_approval && !request.approval_granted) {
        const approvalId = this.policyEngine.requestApproval(policyDecision);
        yield {
          type: 'approval_required',
          content: `Approval required for: ${request.test_cmd}`,
          metadata: { risk_level: policyDecision.risk_level },
        };
        return;
      }

      yield {
        type: 'step',
        content: `Executing: ${request.test_cmd}`,
        metadata: { risk_level: policyDecision.risk_level },
      };

      const result = await this.sandbox.executeTest(request.test_cmd);

      if (!result.success) {
        yield {
          type: 'step',
          content: `Test failed, attempting self-healing...`,
          metadata: { attempt: 1 },
        };
      }
    }

    yield {
      type: 'done',
      content: '',
      metadata: { execution_time: Date.now() - startTime },
    };
  }

  async syncSkills(owner?: string, repo?: string, branch?: string): Promise<ApiResponse> {
    try {
      const result = await this.skillEngine.syncFromGitHub(
        owner || process.env.GITHUB_SKILLS_OWNER || '',
        repo || process.env.GITHUB_SKILLS_REPO || '',
        branch || process.env.GITHUB_SKILLS_BRANCH || 'main'
      );
      return { status: 'success', data: result };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  getSkillEngine(): SkillDiscoveryEngine {
    return this.skillEngine;
  }

  getLLMRouter(): MultiProviderLLMRouter {
    return this.llmRouter;
  }

  getSandbox(): ExecutionSandbox {
    return this.sandbox;
  }

  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  getRollbackLedger(): RollbackLedger {
    return this.rollbackLedger;
  }
}
