export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: string[];
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export class MCPServer {
  private config: MCPServerConfig;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  registerTool(tool: MCPTool, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.tools.set(tool.name, tool);
    this.toolHandlers.set(tool.name, handler);
  }

  registerResource(resource: MCPResource): void {
    this.resources.set(resource.uri, resource);
  }

  registerPrompt(prompt: MCPPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return await this.handleToolsCall(request);
        case 'resources/list':
          return this.handleResourcesList(request);
        case 'resources/read':
          return this.handleResourcesRead(request);
        case 'prompts/list':
          return this.handlePromptsList(request);
        case 'prompts/get':
          return this.handlePromptsGet(request);
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          };
      }
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: error.message || 'Internal error' },
      };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: this.config.capabilities,
        serverInfo: { name: this.config.name, version: this.config.version },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools = Array.from(this.tools.values());
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools },
    };
  }

  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params as { name: string; arguments: Record<string, unknown> };
    const handler = this.toolHandlers.get(name);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32602, message: `Tool not found: ${name}` },
      };
    }
    const result = await handler(args || {});
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
    };
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    const resources = Array.from(this.resources.values());
    return { jsonrpc: '2.0', id: request.id, result: { resources } };
  }

  private handleResourcesRead(request: MCPRequest): MCPResponse {
    const { uri } = request.params as { uri: string };
    const resource = this.resources.get(uri);
    if (!resource) {
      return { jsonrpc: '2.0', id: request.id, error: { code: -32602, message: `Resource not found: ${uri}` } };
    }
    return { jsonrpc: '2.0', id: request.id, result: { contents: [{ uri, mimeType: resource.mimeType, text: '' }] } };
  }

  private handlePromptsList(request: MCPRequest): MCPResponse {
    const prompts = Array.from(this.prompts.values());
    return { jsonrpc: '2.0', id: request.id, result: { prompts } };
  }

  private handlePromptsGet(request: MCPRequest): MCPResponse {
    const { name } = request.params as { name: string };
    const prompt = this.prompts.get(name);
    if (!prompt) {
      return { jsonrpc: '2.0', id: request.id, error: { code: -32602, message: `Prompt not found: ${name}` } };
    }
    return { jsonrpc: '2.0', id: request.id, result: { description: prompt.description, messages: [] } };
  }

  getTools(): MCPTool[] { return Array.from(this.tools.values()); }
  getResources(): MCPResource[] { return Array.from(this.resources.values()); }
  getPrompts(): MCPPrompt[] { return Array.from(this.prompts.values()); }
  getConfig(): MCPServerConfig { return { ...this.config }; }
}

export class MCPClient {
  private serverUrl: string;
  private requestId: number = 0;
  private connected: boolean = false;
  private capabilities: Record<string, boolean> = {};

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }
  getServerUrl(): string { return this.serverUrl; }

  async listTools(): Promise<MCPTool[]> {
    this.requestId++;
    const response = await this.sendRequest({ jsonrpc: '2.0', id: this.requestId, method: 'tools/list' });
    return (response.result as { tools: MCPTool[] })?.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.requestId++;
    const response = await this.sendRequest({
      jsonrpc: '2.0', id: this.requestId, method: 'tools/call',
      params: { name, arguments: args },
    });
    return response.result;
  }

  async listResources(): Promise<MCPResource[]> {
    this.requestId++;
    const response = await this.sendRequest({ jsonrpc: '2.0', id: this.requestId, method: 'resources/list' });
    return (response.result as { resources: MCPResource[] })?.resources || [];
  }

  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    return { jsonrpc: '2.0', id: request.id, result: {} };
  }
}
