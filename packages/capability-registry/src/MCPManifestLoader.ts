// ═══════════════════════════════════════════════════════
// MCPManifestLoader — Load MCP Tool Definitions
// ═══════════════════════════════════════════════════════

import { MCPManifest, RepositoryCapability } from './types';

export class MCPManifestLoader {
  private manifests: Map<string, MCPManifest> = new Map();

  loadManifest(capabilityId: string, manifest: MCPManifest): void {
    this.manifests.set(capabilityId, manifest);
  }

  loadFromJSON(capabilityId: string, json: string): boolean {
    try {
      const manifest = JSON.parse(json) as MCPManifest;
      if (!manifest.name || !manifest.tools || !Array.isArray(manifest.tools)) {
        return false;
      }
      this.loadManifest(capabilityId, manifest);
      return true;
    } catch {
      return false;
    }
  }

  getManifest(capabilityId: string): MCPManifest | undefined {
    return this.manifests.get(capabilityId);
  }

  getAllManifests(): MCPManifest[] {
    return Array.from(this.manifests.values());
  }

  getToolsForCapability(capabilityId: string): MCPManifest['tools'] {
    const manifest = this.manifests.get(capabilityId);
    return manifest ? manifest.tools : [];
  }

  findToolByName(toolName: string): { capabilityId: string; tool: MCPManifest['tools'][0] } | undefined {
    for (const [capId, manifest] of this.manifests) {
      const tool = manifest.tools.find(t => t.name === toolName);
      if (tool) return { capabilityId: capId, tool };
    }
    return undefined;
  }

  convertToCapability(capabilityId: string, repoName: string, category: RepositoryCapability['category']): RepositoryCapability | undefined {
    const manifest = this.manifests.get(capabilityId);
    if (!manifest) return undefined;

    return {
      id: capabilityId,
      repoName,
      type: 'mcp_service',
      category,
      endpoint: manifest.endpoint,
      providedSkills: manifest.tools.map(t => t.name),
      healthCheckUrl: manifest.endpoint,
      policyRequirements: {
        requiresApproval: false,
        riskLevel: 'LOW',
      },
      status: 'UNKNOWN',
    };
  }

  getManifestCount(): number { return this.manifests.size; }
  getTotalToolCount(): number {
    return Array.from(this.manifests.values()).reduce((s, m) => s + m.tools.length, 0);
  }
}
