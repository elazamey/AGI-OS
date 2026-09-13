import { generateId } from '@agi-os/kernel';
import { LLMGateway, LLMRequestConfig } from '@agi-os/llm-gateway';
import { MissionRuntime, TaskDefinition } from '@agi-os/mission-runtime';

export interface ApiServerConfig {
  port?: number;
  host?: string;
  apiKey?: string;
  enableCors?: boolean;
}

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  data?: unknown;
  error?: string;
  requestId: string;
}

export class ApiServer {
  private config: ApiServerConfig;
  private llmGateway: LLMGateway;
  private missionRuntime: MissionRuntime;
  private routes: Map<string, (req: ApiRequest) => Promise<ApiResponse>> = new Map();

  constructor(config: ApiServerConfig = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      enableCors: true,
      ...config,
    };
    this.llmGateway = new LLMGateway();
    this.missionRuntime = new MissionRuntime();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.routes.set('POST /api/generate', this.handleGenerate.bind(this));
    this.routes.set('POST /api/missions', this.handleCreateMission.bind(this));
    this.routes.set('GET /api/missions/:id', this.handleGetMission.bind(this));
    this.routes.set('POST /api/missions/:id/start', this.handleStartMission.bind(this));
    this.routes.set('POST /api/missions/:id/pause', this.handlePauseMission.bind(this));
    this.routes.set('POST /api/missions/:id/complete', this.handleCompleteMission.bind(this));
    this.routes.set('GET /api/health', this.handleHealth.bind(this));
  }

  async handleRequest(req: ApiRequest): Promise<ApiResponse> {
    const requestId = generateId();

    if (this.config.apiKey) {
      const providedKey = req.headers['x-api-key'];
      if (providedKey !== this.config.apiKey) {
        return {
          status: 401,
          error: 'Unauthorized: Invalid API key',
          requestId,
        };
      }
    }

    const routeKey = `${req.method} ${this.matchRoute(req.path)}`;
    const handler = this.routes.get(routeKey);

    if (!handler) {
      return {
        status: 404,
        error: 'Not Found',
        requestId,
      };
    }

    try {
      return await handler({ ...req, query: req.query || {} });
    } catch (error: any) {
      return {
        status: 500,
        error: error.message,
        requestId,
      };
    }
  }

  private matchRoute(path: string): string {
    for (const route of this.routes.keys()) {
      const routePath = route.split(' ')[1];
      const routeParts = routePath.split('/');
      const pathParts = path.split('/');

      if (routeParts.length !== pathParts.length) continue;

      let match = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) continue;
        if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }
      if (match) return routePath;
    }
    return path;
  }

  private extractParams(path: string, route: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeParts = route.split('/');
    const pathParts = path.split('/');

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      }
    }
    return params;
  }

  private async handleGenerate(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body as LLMRequestConfig;
    const response = await this.llmGateway.generate(body);
    return { status: 200, data: response, requestId: generateId() };
  }

  private async handleCreateMission(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body as { tasks: TaskDefinition[] };
    const missionId = await this.missionRuntime.createMission(body.tasks);
    return { status: 201, data: { missionId }, requestId: generateId() };
  }

  private async handleGetMission(req: ApiRequest): Promise<ApiResponse> {
    const params = this.extractParams(req.path, '/api/missions/:id');
    const state = await this.missionRuntime.getMissionState(params.id);
    if (!state) {
      return { status: 404, error: 'Mission not found', requestId: generateId() };
    }
    return { status: 200, data: state, requestId: generateId() };
  }

  private async handleStartMission(req: ApiRequest): Promise<ApiResponse> {
    const params = this.extractParams(req.path, '/api/missions/:id/start');
    await this.missionRuntime.startMission(params.id);
    return { status: 200, data: { status: 'started' }, requestId: generateId() };
  }

  private async handlePauseMission(req: ApiRequest): Promise<ApiResponse> {
    const params = this.extractParams(req.path, '/api/missions/:id/pause');
    await this.missionRuntime.pauseMission(params.id);
    return { status: 200, data: { status: 'paused' }, requestId: generateId() };
  }

  private async handleCompleteMission(req: ApiRequest): Promise<ApiResponse> {
    const params = this.extractParams(req.path, '/api/missions/:id/complete');
    const state = await this.missionRuntime.completeMission(params.id);
    return { status: 200, data: state, requestId: generateId() };
  }

  private async handleHealth(req: ApiRequest): Promise<ApiResponse> {
    return {
      status: 200,
      data: {
        status: 'healthy',
        version: '1.9.0',
        timestamp: new Date().toISOString(),
      },
      requestId: generateId(),
    };
  }

  getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }

  getConfig(): ApiServerConfig {
    return { ...this.config };
  }
}
