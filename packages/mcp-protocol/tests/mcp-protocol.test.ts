import { describe, it, expect, beforeEach } from 'vitest';
import { MCPServer, MCPClient } from '../src/index.js';

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer({
      name: 'agi-os-mcp',
      version: '1.0.0',
      capabilities: { tools: true, resources: true, prompts: true },
    });
  });

  it('should create server with config', () => {
    expect(server).toBeDefined();
    const config = server.getConfig();
    expect(config.name).toBe('agi-os-mcp');
    expect(config.capabilities.tools).toBe(true);
  });

  it('should handle initialize request', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
    });
    expect(response.result).toBeDefined();
    const result = response.result as any;
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.serverInfo.name).toBe('agi-os-mcp');
  });

  it('should register and list tools', async () => {
    server.registerTool(
      { name: 'read-file', description: 'Read a file', inputSchema: { path: { type: 'string' } } },
      async (args) => ({ content: 'file contents' }),
    );

    const response = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const result = response.result as { tools: any[] };
    expect(result.tools.length).toBe(1);
    expect(result.tools[0].name).toBe('read-file');
  });

  it('should call tool', async () => {
    server.registerTool(
      { name: 'add', description: 'Add numbers', inputSchema: {} },
      async (args) => ({ sum: (args.a as number) + (args.b as number) }),
    );

    const response = await server.handleRequest({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'add', arguments: { a: 2, b: 3 } },
    });
    expect(response.result).toBeDefined();
  });

  it('should return error for unknown tool', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'unknown', arguments: {} },
    });
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32602);
  });

  it('should return error for unknown method', async () => {
    const response = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'unknown/method' });
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
  });

  it('should register and list resources', async () => {
    server.registerResource({ uri: 'file:///test.txt', name: 'test.txt', mimeType: 'text/plain' });
    const response = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'resources/list' });
    const result = response.result as { resources: any[] };
    expect(result.resources.length).toBe(1);
    expect(result.resources[0].uri).toBe('file:///test.txt');
  });

  it('should register and list prompts', async () => {
    server.registerPrompt({ name: 'code-review', description: 'Review code', arguments: ['code'] });
    const response = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'prompts/list' });
    const result = response.result as { prompts: any[] };
    expect(result.prompts.length).toBe(1);
    expect(result.prompts[0].name).toBe('code-review');
  });

  it('should get prompts', async () => {
    server.registerPrompt({ name: 'code-review', description: 'Review code' });
    const response = await server.handleRequest({
      jsonrpc: '2.0', id: 1, method: 'prompts/get',
      params: { name: 'code-review' },
    });
    expect(response.result).toBeDefined();
  });

  it('should handle multiple tools', async () => {
    server.registerTool({ name: 'tool-a', description: 'A', inputSchema: {} }, async () => 'a');
    server.registerTool({ name: 'tool-b', description: 'B', inputSchema: {} }, async () => 'b');
    server.registerTool({ name: 'tool-c', description: 'C', inputSchema: {} }, async () => 'c');

    const tools = server.getTools();
    expect(tools.length).toBe(3);
  });
});

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient('http://localhost:3000');
  });

  it('should create client', () => {
    expect(client).toBeDefined();
    expect(client.getServerUrl()).toBe('http://localhost:3000');
  });

  it('should connect', async () => {
    const result = await client.connect();
    expect(result).toBe(true);
    expect(client.isConnected()).toBe(true);
  });

  it('should disconnect', async () => {
    await client.connect();
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('should list tools', async () => {
    await client.connect();
    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
  });
});
