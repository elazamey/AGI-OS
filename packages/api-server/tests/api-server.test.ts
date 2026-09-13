import { describe, it, expect, beforeEach } from 'vitest';
import { ApiServer } from '../src/index.js';

describe('ApiServer', () => {
  let server: ApiServer;

  beforeEach(() => {
    server = new ApiServer({
      port: 3000,
      host: 'localhost',
      enableCors: true,
    });
  });

  it('should create with default config', () => {
    const defaultServer = new ApiServer();
    expect(defaultServer).toBeDefined();
    expect(defaultServer.getConfig().port).toBe(3000);
  });

  it('should create with custom config', () => {
    expect(server).toBeDefined();
    expect(server.getConfig().port).toBe(3000);
    expect(server.getConfig().host).toBe('localhost');
  });

  it('should have routes defined', () => {
    const routes = server.getRoutes();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes).toContain('POST /api/generate');
    expect(routes).toContain('POST /api/missions');
    expect(routes).toContain('GET /api/missions/:id');
    expect(routes).toContain('GET /api/health');
  });

  it('should handle health check', async () => {
    const response = await server.handleRequest({
      method: 'GET',
      path: '/api/health',
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect((response.data as any).status).toBe('healthy');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await server.handleRequest({
      method: 'GET',
      path: '/api/unknown',
      headers: {},
    });

    expect(response.status).toBe(404);
  });

  it('should require API key when configured', async () => {
    const secureServer = new ApiServer({
      apiKey: 'test-key',
    });

    const response = await secureServer.handleRequest({
      method: 'GET',
      path: '/api/health',
      headers: {},
    });

    expect(response.status).toBe(401);
  });

  it('should accept valid API key', async () => {
    const secureServer = new ApiServer({
      apiKey: 'test-key',
    });

    const response = await secureServer.handleRequest({
      method: 'GET',
      path: '/api/health',
      headers: { 'x-api-key': 'test-key' },
    });

    expect(response.status).toBe(200);
  });

  it('should create mission', async () => {
    const response = await server.handleRequest({
      method: 'POST',
      path: '/api/missions',
      headers: {},
      body: {
        tasks: [
          { id: 'task-1', type: 'test', payload: {}, priority: 1 },
        ],
      },
    });

    expect(response.status).toBe(201);
    expect((response.data as any).missionId).toBeDefined();
  });

  it('should get mission state', async () => {
    // First create a mission
    const createResponse = await server.handleRequest({
      method: 'POST',
      path: '/api/missions',
      headers: {},
      body: {
        tasks: [
          { id: 'task-1', type: 'test', payload: {}, priority: 1 },
        ],
      },
    });

    const missionId = (createResponse.data as any).missionId;

    // Then get it
    const getResponse = await server.handleRequest({
      method: 'GET',
      path: `/api/missions/${missionId}`,
      headers: {},
    });

    expect(getResponse.status).toBe(200);
    expect((getResponse.data as any).id).toBe(missionId);
  });

  it('should return 404 for non-existent mission', async () => {
    const response = await server.handleRequest({
      method: 'GET',
      path: '/api/missions/non-existent',
      headers: {},
    });

    expect(response.status).toBe(404);
  });

  it('should handle generate request (will fail without Ollama)', async () => {
    const response = await server.handleRequest({
      method: 'POST',
      path: '/api/generate',
      headers: {},
      body: {
        prompt: 'Hello',
      },
    });

    // This will fail because Ollama is not running, but it should be a valid request
    expect(response.status).toBe(500);
    expect(response.error).toBeDefined();
  });
});
