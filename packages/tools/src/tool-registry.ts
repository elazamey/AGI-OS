// ============================================================================
// AGI OS - Tool Registry
// Central registry for tool definitions and handlers
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  ToolDefinition,
  ToolHandler,
  ToolCategory,
  ToolRisk,
  ToolEventType,
  ToolEvent
} from './types.js';
import { validateToolDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Tool Registry Entry
// ---------------------------------------------------------------------------
export interface ToolRegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  registeredAt: Date;
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  averageDuration: number;
  errorCount: number;
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------
export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private events: ToolEvent[] = [];

  /**
   * Register a tool
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (!validateToolDefinition(definition)) {
      throw new Error(`Invalid tool definition: ${definition}`);
    }

    if (this.tools.has(definition.id)) {
      throw new Error(`Tool already registered: ${definition.id}`);
    }

    const entry: ToolRegistryEntry = {
      definition: { ...definition },
      handler,
      registeredAt: now(),
      enabled: true,
      executionCount: 0,
      averageDuration: 0,
      errorCount: 0
    };

    this.tools.set(definition.id, entry);
    this.recordEvent('tool.registered', { toolId: definition.id });
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) return false;

    this.tools.delete(toolId);
    this.recordEvent('tool.unregistered', { toolId });
    return true;
  }

  /**
   * Get a tool definition
   */
  getTool(toolId: string): ToolDefinition | undefined {
    const entry = this.tools.get(toolId);
    return entry ? { ...entry.definition } : undefined;
  }

  /**
   * Get a tool handler
   */
  getHandler(toolId: string): ToolHandler | undefined {
    const entry = this.tools.get(toolId);
    return entry?.handler;
  }

  /**
   * Get a tool entry
   */
  getEntry(toolId: string): ToolRegistryEntry | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((e) => ({ ...e.definition }));
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.category === category);
  }

  /**
   * Get tools by risk level
   */
  getToolsByRisk(risk: ToolRisk): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.risk === risk);
  }

  /**
   * Get tools that require approval
   */
  getToolsRequiringApproval(): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.requiresApproval);
  }

  /**
   * Get tools with side effects
   */
  getToolsWithSideEffects(): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.sideEffects);
  }

  /**
   * Check if tool exists
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Check if tool is enabled
   */
  isToolEnabled(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    return entry?.enabled ?? false;
  }

  /**
   * Enable a tool
   */
  enableTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) return false;
    entry.enabled = true;
    return true;
  }

  /**
   * Disable a tool
   */
  disableTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) return false;
    entry.enabled = false;
    return true;
  }

  /**
   * Record execution
   */
  recordExecution(toolId: string, duration: number, success: boolean): void {
    const entry = this.tools.get(toolId);
    if (!entry) return;

    entry.executionCount++;
    entry.lastExecutedAt = now();

    // Update average duration
    entry.averageDuration =
      (entry.averageDuration * (entry.executionCount - 1) + duration) /
      entry.executionCount;

    if (!success) {
      entry.errorCount++;
    }
  }

  /**
   * Get tool stats
   */
  getToolStats(toolId: string): {
    executionCount: number;
    averageDuration: number;
    errorCount: number;
    errorRate: number;
    lastExecutedAt?: Date;
  } | undefined {
    const entry = this.tools.get(toolId);
    if (!entry) return undefined;

    return {
      executionCount: entry.executionCount,
      averageDuration: entry.averageDuration,
      errorCount: entry.errorCount,
      errorRate: entry.executionCount > 0
        ? entry.errorCount / entry.executionCount
        : 0,
      lastExecutedAt: entry.lastExecutedAt
    };
  }

  /**
   * Get registry stats
   */
  getStats(): {
    totalTools: number;
    enabledTools: number;
    toolsRequiringApproval: number;
    toolsWithSideEffects: number;
    byCategory: Record<string, number>;
    byRisk: Record<string, number>;
  } {
    const allTools = this.getAllTools();
    const enabledTools = allTools.filter((t) => {
      const entry = this.tools.get(t.id);
      return entry?.enabled;
    });

    const byCategory: Record<string, number> = {};
    const byRisk: Record<string, number> = {};

    for (const tool of allTools) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
      byRisk[tool.risk] = (byRisk[tool.risk] || 0) + 1;
    }

    return {
      totalTools: allTools.length,
      enabledTools: enabledTools.length,
      toolsRequiringApproval: allTools.filter((t) => t.requiresApproval).length,
      toolsWithSideEffects: allTools.filter((t) => t.sideEffects).length,
      byCategory,
      byRisk
    };
  }

  /**
   * Get events
   */
  getEvents(): ToolEvent[] {
    return [...this.events];
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.events = [];
  }

  /**
   * Record event
   */
  private recordEvent(type: ToolEventType, data: Record<string, unknown>): void {
    this.events.push({
      id: generateId(),
      type,
      timestamp: now(),
      data
    });
  }
}

// ---------------------------------------------------------------------------
// Tool Registry Factory
// ---------------------------------------------------------------------------
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

// ---------------------------------------------------------------------------
// Built-in Tool Definitions (READ-ONLY)
// ---------------------------------------------------------------------------

export const FILESYSTEM_READ_TOOL: ToolDefinition = {
  id: 'filesystem.read',
  name: 'Read File',
  version: '1.0.0',
  description: 'Read content from a file',
  category: 'filesystem',
  capability: 'filesystem.read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' }
    },
    required: ['path']
  },
  outputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      size: { type: 'number' }
    }
  },
  risk: 'low',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'filesystem'],
  metadata: {}
};

export const FILESYSTEM_LIST_TOOL: ToolDefinition = {
  id: 'filesystem.list',
  name: 'List Directory',
  version: '1.0.0',
  description: 'List contents of a directory',
  category: 'filesystem',
  capability: 'filesystem.read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path' }
    },
    required: ['path']
  },
  outputSchema: {
    type: 'object',
    properties: {
      entries: { type: 'array' }
    }
  },
  risk: 'low',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'filesystem'],
  metadata: {}
};

export const GIT_STATUS_TOOL: ToolDefinition = {
  id: 'git.status',
  name: 'Git Status',
  version: '1.0.0',
  description: 'Get git repository status',
  category: 'git',
  capability: 'git.read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      branch: { type: 'string' },
      files: { type: 'array' }
    }
  },
  risk: 'none',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'git'],
  metadata: {}
};

export const GIT_LOG_TOOL: ToolDefinition = {
  id: 'git.log',
  name: 'Git Log',
  version: '1.0.0',
  description: 'Get git commit log',
  category: 'git',
  capability: 'git.read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      count: { type: 'number', description: 'Number of commits' }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      commits: { type: 'array' }
    }
  },
  risk: 'none',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'git'],
  metadata: {}
};

export const GIT_DIFF_TOOL: ToolDefinition = {
  id: 'git.diff',
  name: 'Git Diff',
  version: '1.0.0',
  description: 'Get git diff',
  category: 'git',
  capability: 'git.read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      ref: { type: 'string', description: 'Git ref to diff' }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      diff: { type: 'string' }
    }
  },
  risk: 'none',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'git'],
  metadata: {}
};

export const MISSION_INSPECT_TOOL: ToolDefinition = {
  id: 'mission.inspect',
  name: 'Inspect Mission',
  version: '1.0.0',
  description: 'Inspect mission state and details',
  category: 'mission',
  capability: 'mission.read',
  inputSchema: {
    type: 'object',
    properties: {
      missionId: { type: 'string', description: 'Mission ID' }
    },
    required: ['missionId']
  },
  outputSchema: {
    type: 'object',
    properties: {
      mission: { type: 'object' }
    }
  },
  risk: 'none',
  sideEffects: false,
  requiresApproval: false,
  tags: ['read', 'mission'],
  metadata: {}
};

// ---------------------------------------------------------------------------
// Built-in Tool Definitions (WRITE - require approval)
// ---------------------------------------------------------------------------

export const FILESYSTEM_WRITE_TOOL: ToolDefinition = {
  id: 'filesystem.write',
  name: 'Write File',
  version: '1.0.0',
  description: 'Write content to a file',
  category: 'filesystem',
  capability: 'filesystem.write',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' }
    },
    required: ['path', 'content']
  },
  outputSchema: {
    type: 'object',
    properties: {
      bytesWritten: { type: 'number' }
    }
  },
  risk: 'high',
  sideEffects: true,
  requiresApproval: true,
  tags: ['write', 'filesystem'],
  metadata: {}
};

export const GIT_COMMIT_TOOL: ToolDefinition = {
  id: 'git.commit',
  name: 'Git Commit',
  version: '1.0.0',
  description: 'Create a git commit',
  category: 'git',
  capability: 'git.write',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      message: { type: 'string', description: 'Commit message' },
      files: { type: 'array', description: 'Files to commit' }
    },
    required: ['message']
  },
  outputSchema: {
    type: 'object',
    properties: {
      commitHash: { type: 'string' }
    }
  },
  risk: 'high',
  sideEffects: true,
  requiresApproval: true,
  tags: ['write', 'git'],
  metadata: {}
};

export const TERMINAL_EXECUTE_TOOL: ToolDefinition = {
  id: 'terminal.execute',
  name: 'Execute Command',
  version: '1.0.0',
  description: 'Execute a terminal command',
  category: 'terminal',
  capability: 'terminal.execute',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      args: { type: 'array', description: 'Command arguments' },
      cwd: { type: 'string', description: 'Working directory' }
    },
    required: ['command']
  },
  outputSchema: {
    type: 'object',
    properties: {
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      exitCode: { type: 'number' }
    }
  },
  risk: 'critical',
  sideEffects: true,
  requiresApproval: true,
  tags: ['execute', 'terminal'],
  metadata: {}
};
