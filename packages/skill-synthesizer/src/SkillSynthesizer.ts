import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface GeneratedSkillSpec {
  name: string;
  description: string;
  triggers: string[];
  instructions: string;
  testCode: string;
}

export interface SynthesisResult {
  success: boolean;
  skill_name: string;
  test_output: string;
  registered: boolean;
  error?: string;
  duration_ms: number;
}

export interface SynthesisHistory {
  attempts: number;
  successes: number;
  failures: number;
  registered_skills: string[];
}

export class SkillSynthesizer {
  private registryPath: string;
  private timeoutMs: number;
  private history: SynthesisHistory;

  constructor(registryPath: string, options: { timeoutMs?: number } = {}) {
    this.registryPath = registryPath;
    this.timeoutMs = options.timeoutMs || 30000;
    this.history = {
      attempts: 0,
      successes: 0,
      failures: 0,
      registered_skills: [],
    };
  }

  getRegistryPath(): string {
    return this.registryPath;
  }

  getHistory(): SynthesisHistory {
    return { ...this.history, registered_skills: [...this.history.registered_skills] };
  }

  generateSkillMd(spec: GeneratedSkillSpec): string {
    return `# Name
${spec.name}

# Version
1.0.0

# Description
${spec.description}

# Author
agi-os-synthesizer

# Category
auto-generated

# Tags
${spec.triggers.map(t => `- ${t}`).join('\n')}

# Triggers
${spec.triggers.join(', ')}

# Instructions
${spec.instructions}
`;
  }

  validateSpec(spec: GeneratedSkillSpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!spec.name || spec.name.trim().length === 0) {
      errors.push('Skill name is required');
    }
    if (!/^[a-z0-9-]+$/.test(spec.name)) {
      errors.push('Skill name must contain only lowercase letters, numbers, and hyphens');
    }
    if (!spec.description || spec.description.trim().length === 0) {
      errors.push('Description is required');
    }
    if (!spec.triggers || spec.triggers.length === 0) {
      errors.push('At least one trigger is required');
    }
    if (!spec.instructions || spec.instructions.trim().length === 0) {
      errors.push('Instructions are required');
    }
    if (!spec.testCode || spec.testCode.trim().length === 0) {
      errors.push('Test code is required for sandbox verification');
    }

    return { valid: errors.length === 0, errors };
  }

  private executeInSandbox(code: string): { success: boolean; output: string; exitCode: number } {
    const tempFile = join(
      process.cwd(),
      `.synth-test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.js`
    );

    try {
      writeFileSync(tempFile, code, 'utf8');
      const output = execSync(`node --test "${tempFile}"`, {
        timeout: this.timeoutMs,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      rmSync(tempFile);
      return { success: true, output, exitCode: 0 };
    } catch (error: any) {
      if (existsSync(tempFile)) rmSync(tempFile);
      return {
        success: false,
        output: error.stderr || error.message || 'Unknown error',
        exitCode: error.status || 1,
      };
    }
  }

  async synthesizeAndRegister(spec: GeneratedSkillSpec): Promise<SynthesisResult> {
    const startTime = Date.now();
    this.history.attempts++;

    const validation = this.validateSpec(spec);
    if (!validation.valid) {
      this.history.failures++;
      return {
        success: false,
        skill_name: spec.name,
        test_output: '',
        registered: false,
        error: validation.errors.join('; '),
        duration_ms: Date.now() - startTime,
      };
    }

    const testResult = this.executeInSandbox(spec.testCode);

    if (!testResult.success) {
      this.history.failures++;
      return {
        success: false,
        skill_name: spec.name,
        test_output: testResult.output,
        registered: false,
        error: `Sandbox test failed (exit ${testResult.exitCode})`,
        duration_ms: Date.now() - startTime,
      };
    }

    const skillDir = join(this.registryPath, spec.name);
    mkdirSync(skillDir, { recursive: true });

    const skillMd = this.generateSkillMd(spec);
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd, 'utf8');

    this.history.successes++;
    this.history.registered_skills.push(spec.name);

    return {
      success: true,
      skill_name: spec.name,
      test_output: testResult.output,
      registered: true,
      duration_ms: Date.now() - startTime,
    };
  }

  isSkillRegistered(skillName: string): boolean {
    const skillDir = join(this.registryPath, skillName);
    return existsSync(join(skillDir, 'SKILL.md'));
  }

  listRegisteredSkills(): string[] {
    if (!existsSync(this.registryPath)) return [];
    const entries = readdirSync(this.registryPath);
    return entries.filter((entry: string) => {
      const entryPath = join(this.registryPath, entry);
      return statSync(entryPath).isDirectory() && existsSync(join(entryPath, 'SKILL.md'));
    });
  }

  getSkillContent(skillName: string): string | null {
    const skillFile = join(this.registryPath, skillName, 'SKILL.md');
    if (!existsSync(skillFile)) return null;
    return readFileSync(skillFile, 'utf8');
  }
}
