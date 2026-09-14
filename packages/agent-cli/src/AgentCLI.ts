import { SkillRegistry } from '@agi-os/skill-registry';
import { CapabilityFetcher, CapabilityManager } from '@agi-os/capability-marketplace';
import { AgentUI, Message } from '@agi-os/agent-ui';

export interface CLIConfig {
  registryOwner?: string;
  registryRepo?: string;
  theme?: 'light' | 'dark';
  verbose?: boolean;
}

export class AgentCLI {
  private registry: SkillRegistry;
  private capabilityManager: CapabilityManager;
  private ui: AgentUI;
  private config: CLIConfig;

  constructor(config: CLIConfig = {}) {
    this.config = {
      registryOwner: 'elazamey',
      registryRepo: 'skills-registry',
      theme: 'dark',
      verbose: false,
      ...config,
    };

    this.registry = new SkillRegistry();
    const fetcher = new CapabilityFetcher({
      owner: this.config.registryOwner!,
      repo: this.config.registryRepo!,
    });
    this.capabilityManager = new CapabilityManager({ registry: this.registry, fetcher });
    this.ui = new AgentUI(this.registry, this.capabilityManager, {
      theme: this.config.theme,
    });
  }

  async start(): Promise<void> {
    console.log('\n🚀 AGI-OS Agent CLI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Type "help" for available commands\n');

    await this.syncSkills();
    await this.interactiveLoop();
  }

  private async syncSkills(): Promise<void> {
    console.log('📡 Syncing skills from registry...');
    const result = await this.capabilityManager.sync();
    console.log(`✅ Loaded ${result.loaded} skills`);
    if (result.errors.length > 0) {
      console.log(`⚠️  ${result.errors.length} errors occurred`);
    }
  }

  private async interactiveLoop(): Promise<void> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question('\n🧑 You: ', async (input) => {
        if (input.trim() === '') {
          prompt();
          return;
        }

        if (input.trim().toLowerCase() === 'exit' || input.trim().toLowerCase() === 'quit') {
          console.log('\n👋 Goodbye!\n');
          rl.close();
          process.exit(0);
        }

        if (input.trim().toLowerCase() === 'help') {
          this.showHelp();
          prompt();
          return;
        }

        if (input.trim().toLowerCase() === 'skills') {
          this.showSkills();
          prompt();
          return;
        }

        if (input.trim().toLowerCase() === 'clear') {
          this.ui.clearHistory();
          console.log('\n🗑️  History cleared');
          prompt();
          return;
        }

        const response = await this.ui.processInput(input);
        console.log(`\n🤖 Assistant: ${response.content}`);
        prompt();
      });
    };

    prompt();
  }

  private showHelp(): void {
    console.log('\n📖 Available Commands:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  help        - Show this help message');
    console.log('  skills      - List available skills');
    console.log('  clear       - Clear conversation history');
    console.log('  exit/quit   - Exit the CLI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 You can ask me to:');
    console.log('  - Read files from your filesystem');
    console.log('  - Search the web');
    console.log('  - Generate code');
    console.log('  - Analyze data');
  }

  private showSkills(): void {
    const skills = this.ui.getLoadedSkills();
    console.log('\n📚 Available Skills:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (skills.length === 0) {
      console.log('  No skills loaded');
    } else {
      for (const skill of skills) {
        console.log(`  • ${skill.metadata.name} - ${skill.metadata.description}`);
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  getUI(): AgentUI {
    return this.ui;
  }

  getRegistry(): SkillRegistry {
    return this.registry;
  }

  getCapabilityManager(): CapabilityManager {
    return this.capabilityManager;
  }
}
