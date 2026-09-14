// ═══════════════════════════════════════════════════════
// AGI-OS OpenAPI Specification
// ═══════════════════════════════════════════════════════

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'AGI-OS API',
    description: 'Cognitive Agent Operating System — Enterprise API Gateway',
    version: '1.33.0',
    contact: { name: 'AGI-OS Contributors', url: 'https://github.com/elazamey/agi-system' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [
    { url: 'https://elazamey-agi-system.hf.space', description: 'Production (HuggingFace Spaces)' },
    { url: 'http://localhost:7860', description: 'Local Development' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          '200': { description: 'System is healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness check',
        operationId: 'getReady',
        responses: {
          '200': { description: 'System is ready', content: { 'application/json': { schema: { type: 'object', properties: { ready: { type: 'boolean' } } } } } },
        },
      },
    },
    '/v1/models': {
      get: {
        tags: ['Models'],
        summary: 'List available models',
        operationId: 'listModels',
        responses: {
          '200': { description: 'List of models', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Model' } } } } },
        },
      },
    },
    '/api/v1/missions/execute': {
      post: {
        tags: ['Agent'],
        summary: 'Execute a mission',
        description: 'Submit a prompt for autonomous execution with governance, self-healing, and rollback.',
        operationId: 'executeMission',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecuteRequest' } } },
        },
        responses: {
          '202': { description: 'Mission accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MissionAccepted' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limited', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/v1/missions': {
      get: {
        tags: ['Agent'],
        summary: 'List missions',
        operationId: 'listMissions',
        responses: {
          '200': { description: 'List of missions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Mission' } } } } },
        },
      },
    },
    '/api/v1/missions/{id}': {
      get: {
        tags: ['Agent'],
        summary: 'Get mission by ID',
        operationId: 'getMission',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Mission details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Mission' } } } },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/v1/missions/{id}/rollback': {
      post: {
        tags: ['Agent'],
        summary: 'Rollback a mission',
        operationId: 'rollbackMission',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Rollback result', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
        },
      },
    },
    '/api/v1/skills': {
      get: {
        tags: ['Skills'],
        summary: 'List available skills',
        operationId: 'listSkills',
        responses: {
          '200': { description: 'List of skills', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Skill' } } } } },
        },
      },
    },
    '/api/v1/skills/synthesize': {
      post: {
        tags: ['Skills'],
        summary: 'Synthesize a new skill',
        operationId: 'synthesizeSkill',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] } } },
        },
        responses: {
          '201': { description: 'Skill synthesized', content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, code: { type: 'string' } } } } } },
        },
      },
    },
    '/api/v1/memory/store': {
      post: {
        tags: ['Memory'],
        summary: 'Store a memory entry',
        operationId: 'storeMemory',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MemoryEntry' } } },
        },
        responses: {
          '201': { description: 'Stored', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
        },
      },
    },
    '/api/v1/memory/query': {
      post: {
        tags: ['Memory'],
        summary: 'Query memory',
        operationId: 'queryMemory',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, namespace: { type: 'string' } }, required: ['query'] } } },
        },
        responses: {
          '200': { description: 'Query results', content: { 'application/json': { schema: { type: 'array', items: {} } } } },
        },
      },
    },
    '/v1/chat/completions': {
      post: {
        tags: ['OpenAI'],
        summary: 'OpenAI-compatible chat completions',
        description: 'Full OpenAI API compatibility (L0-L4: Error Format, Chat, Streaming, Tool Calling)',
        operationId: 'chatCompletions',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatCompletionRequest' } } },
        },
        responses: {
          '200': { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatCompletionResponse' } } } },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Rate limited' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key' },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          version: { type: 'string' },
          uptime: { type: 'number' },
          missions: { type: 'integer' },
          skills: { type: 'integer' },
        },
      },
      Model: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          owned_by: { type: 'string' },
        },
      },
      ExecuteRequest: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', description: 'The task for the agent to execute' },
          capabilities: { type: 'array', items: { type: 'string' }, description: 'Required capabilities' },
          context: { type: 'object', description: 'Additional context' },
          webhook_url: { type: 'string', description: 'Callback URL for mission updates' },
          budget_usd: { type: 'number', description: 'Max USD spend for this mission' },
          budget_tokens: { type: 'integer', description: 'Max tokens for this mission' },
        },
      },
      MissionAccepted: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['ACCEPTED', 'PENDING_APPROVAL'] },
          approval_required: { type: 'boolean' },
        },
      },
      Mission: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          result: { type: 'object' },
          events: { type: 'array', items: { $ref: '#/components/schemas/MissionEvent' } },
        },
      },
      MissionEvent: {
        type: 'object',
        properties: {
          stage: { type: 'string' },
          event: { type: 'string' },
          data: { type: 'object' },
          timestamp: { type: 'number' },
        },
      },
      Skill: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          triggers: { type: 'array', items: { type: 'string' } },
          riskLevel: { type: 'string' },
        },
      },
      MemoryEntry: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string' },
          value: {},
          namespace: { type: 'string' },
        },
      },
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: { type: 'string' },
          messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
          temperature: { type: 'number' },
          max_tokens: { type: 'integer' },
          stream: { type: 'boolean' },
          tools: { type: 'array' },
        },
      },
      ChatCompletionResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          object: { type: 'string' },
          choices: { type: 'array' },
          usage: { type: 'object' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
          content: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              type: { type: 'string' },
              param: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export type OpenAPISpec = typeof OPENAPI_SPEC;
