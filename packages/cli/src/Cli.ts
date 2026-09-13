import { generateId } from '@agi-os/kernel';
import { LLMGateway, LLMGatewayConfig } from '@agi-os/llm-gateway';
import { MissionRuntime, TaskDefinition } from '@agi-os/mission-runtime';

export interface CliConfig {
  dataDir?: string;
  llmConfig?: LLMGatewayConfig;
}

export interface CliResult {
  success: boolean;
  command: string;
  data?: unknown;
  error?: string;
}

export class Cli {
  private config: CliConfig;
  private llmGateway: LLMGateway;
  private missionRuntime: MissionRuntime;

  constructor(config: CliConfig = {}) {
    this.config = {
      dataDir: '.agi-os',
      ...config,
    };
    this.llmGateway = new LLMGateway(config.llmConfig);
    this.missionRuntime = new MissionRuntime();
  }

  async execute(args: string[]): Promise<CliResult> {
    const command = args[0];

    switch (command) {
      case 'init':
        return this.init();
      case 'status':
        return this.status();
      case 'mission':
        return this.mission(args.slice(1).join(' '));
      case 'help':
        return this.help();
      default:
        return {
          success: false,
          command: command || 'help',
          error: `Unknown command: ${command}. Use 'agi help' for available commands.`,
        };
    }
  }

  private async init(): Promise<CliResult> {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const dataDir = path.resolve(this.config.dataDir!);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbDir = path.join(dataDir, 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      return {
        success: true,
        command: 'init',
        data: {
          dataDir,
          dbPath: path.join(dbDir, 'agi_os.db'),
          message: 'AGI-OS environment initialized successfully',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        command: 'init',
        error: error.message,
      };
    }
  }

  private async status(): Promise<CliResult> {
    try {
      const remaining = this.llmGateway.getRemainingBudget();
      const provider = this.llmGateway.getDefaultProvider();

      return {
        success: true,
        command: 'status',
        data: {
          costGuard: {
            enforced: true,
            maxSpend: this.llmGateway.getMaxSpend(),
            remaining,
            status: remaining >= 0 ? 'OK' : 'OVER_BUDGET',
          },
          llm: {
            provider,
            defaultModel: provider === 'ollama' ? 'llama3.2:3b' : 'unknown',
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        command: 'status',
        error: error.message,
      };
    }
  }

  private async mission(prompt: string): Promise<CliResult> {
    if (!prompt) {
      return {
        success: false,
        command: 'mission',
        error: 'Please provide a mission prompt. Example: agi mission "Analyze repository code"',
      };
    }

    try {
      const tasks: TaskDefinition[] = [
        {
          id: generateId(),
          type: 'llm-generate',
          payload: { prompt },
          priority: 1,
        },
      ];

      const missionId = await this.missionRuntime.createMission(tasks);

      return {
        success: true,
        command: 'mission',
        data: {
          missionId,
          prompt,
          status: 'created',
          message: `Mission created successfully. Use 'agi mission-status ${missionId}' to track progress.`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        command: 'mission',
        error: error.message,
      };
    }
  }

  private async help(): Promise<CliResult> {
    return {
      success: true,
      command: 'help',
      data: {
        commands: [
          {
            name: 'init',
            description: 'Initialize AGI-OS environment and database',
            usage: 'agi init',
          },
          {
            name: 'status',
            description: 'Check system health and safety policies',
            usage: 'agi status',
          },
          {
            name: 'mission',
            description: 'Dispatch an autonomous agent mission',
            usage: 'agi mission "<prompt>"',
          },
          {
            name: 'help',
            description: 'Show available commands',
            usage: 'agi help',
          },
        ],
      },
    };
  }

  getLlmGateway(): LLMGateway {
    return this.llmGateway;
  }

  getMissionRuntime(): MissionRuntime {
    return this.missionRuntime;
  }
}
