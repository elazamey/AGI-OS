import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRegistry,
  createToolRegistry,
  FILESYSTEM_READ_TOOL,
  FILESYSTEM_LIST_TOOL,
  GIT_STATUS_TOOL
} from '../src/tool-registry.js';
import type { ToolDefinition, ToolHandler } from '../src/types.js';

// ---------------------------------------------------------------------------
// Mock Tool Handler
// ---------------------------------------------------------------------------
class MockToolHandler implements ToolHandler {
  async execute(input: Record<string, unknown>) {
    return {
      success: true,
      data: { output: `Executed with ${JSON.stringify(input)}` },
      duration: 100,
      timestamp: new Date()
    };
  }

  validate(input: Record<string, unknown>) {
    if (!input.path && !input.command) {
      return { valid: false, errors: ['Missing required input'] };
    }
    return { valid: true, errors: [] };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let handler: MockToolHandler;

  beforeEach(() => {
    registry = createToolRegistry();
    handler = new MockToolHandler();
  });

  describe('register', () => {
    it('should register a tool', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);

      expect(registry.hasTool('filesystem.read')).toBe(true);
      expect(registry.getTool('filesystem.read')).toBeDefined();
    });

    it('should reject duplicate tool', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      expect(() => registry.register(FILESYSTEM_READ_TOOL, handler)).toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      expect(registry.unregister('filesystem.read')).toBe(true);
      expect(registry.hasTool('filesystem.read')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('getTool', () => {
    it('should get tool definition', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      const tool = registry.getTool('filesystem.read');

      expect(tool).toBeDefined();
      expect(tool!.id).toBe('filesystem.read');
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.getTool('non-existent')).toBeUndefined();
    });
  });

  describe('getHandler', () => {
    it('should get tool handler', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      const h = registry.getHandler('filesystem.read');

      expect(h).toBe(handler);
    });
  });

  describe('getAllTools', () => {
    it('should get all tools', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      registry.register(FILESYSTEM_LIST_TOOL, handler);
      registry.register(GIT_STATUS_TOOL, handler);

      const tools = registry.getAllTools();
      expect(tools).toHaveLength(3);
    });
  });

  describe('getToolsByCategory', () => {
    it('should get tools by category', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      registry.register(FILESYSTEM_LIST_TOOL, handler);
      registry.register(GIT_STATUS_TOOL, handler);

      const fsTools = registry.getToolsByCategory('filesystem');
      expect(fsTools).toHaveLength(2);

      const gitTools = registry.getToolsByCategory('git');
      expect(gitTools).toHaveLength(1);
    });
  });

  describe('getToolsByRisk', () => {
    it('should get tools by risk', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      registry.register(GIT_STATUS_TOOL, handler);

      const lowRisk = registry.getToolsByRisk('low');
      expect(lowRisk).toHaveLength(1);

      const noneRisk = registry.getToolsByRisk('none');
      expect(noneRisk).toHaveLength(1);
    });
  });

  describe('enable/disable', () => {
    it('should disable and enable tool', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);

      expect(registry.isToolEnabled('filesystem.read')).toBe(true);

      registry.disableTool('filesystem.read');
      expect(registry.isToolEnabled('filesystem.read')).toBe(false);

      registry.enableTool('filesystem.read');
      expect(registry.isToolEnabled('filesystem.read')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should get registry stats', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);
      registry.register(GIT_STATUS_TOOL, handler);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(2);
      expect(stats.enabledTools).toBe(2);
      expect(stats.toolsRequiringApproval).toBe(0);
    });
  });

  describe('recordExecution', () => {
    it('should record execution', () => {
      registry.register(FILESYSTEM_READ_TOOL, handler);

      registry.recordExecution('filesystem.read', 100, true);
      registry.recordExecution('filesystem.read', 150, true);
      registry.recordExecution('filesystem.read', 200, false);

      const stats = registry.getToolStats('filesystem.read');
      expect(stats).toBeDefined();
      expect(stats!.executionCount).toBe(3);
      expect(stats!.errorCount).toBe(1);
    });
  });
});
