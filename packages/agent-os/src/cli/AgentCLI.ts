import * as readline from 'readline';
import type { ChatRequest, SSEEvent } from '../api/StreamingApiServer.js';
import { StreamingApiServer } from '../api/StreamingApiServer.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';

const COLORS = {
  CYAN: '\x1b[96m',
  YELLOW: '\x1b[93m',
  GREEN: '\x1b[92m',
  RED: '\x1b[91m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
};

export class AgentCLI {
  private server: StreamingApiServer;
  private policyEngine: PolicyEngine;
  private rl: readline.Interface | null = null;

  constructor() {
    this.server = new StreamingApiServer();
    this.policyEngine = new PolicyEngine();
  }

  async run(args: string[]): Promise<void> {
    const command = args[0];

    if (command === '--sync') {
      await this.syncSkills();
    } else if (command && !command.startsWith('--')) {
      await this.executePrompt(args.join(' '), this.findArg(args, '--test-cmd'));
    } else {
      await this.interactiveMode();
    }
  }

  private async syncSkills(): Promise<void> {
    console.log(`${COLORS.CYAN}🔄 Syncing skills from GitHub...${COLORS.RESET}`);
    const result = await this.server.syncSkills();
    if (result.status === 'success') {
      console.log(`${COLORS.GREEN}✅ Skills synced successfully${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.RED}❌ Sync failed: ${result.error}${COLORS.RESET}`);
    }
  }

  private async executePrompt(prompt: string, testCmd?: string): Promise<void> {
    console.log(`${COLORS.CYAN}🚀 Executing: ${prompt}${COLORS.RESET}\n`);

    const request: ChatRequest = {
      messages: [{ role: 'user', content: prompt }],
      test_cmd: testCmd,
    };

    for await (const event of this.server.handleChatStream(request)) {
      this.handleEvent(event);
    }
  }

  private handleEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'step':
        console.log(`${COLORS.YELLOW}📋 ${event.content}${COLORS.RESET}`);
        break;
      case 'token':
        process.stdout.write(`${COLORS.GREEN}${event.content}${COLORS.RESET}`);
        break;
      case 'approval_required':
        console.log(`\n${COLORS.RED}⚠️  ${event.content}${COLORS.RESET}`);
        console.log(`${COLORS.YELLOW}Type "yes" to approve or "no" to deny${COLORS.RESET}`);
        break;
      case 'error':
        console.log(`\n${COLORS.RED}❌ Error: ${event.content}${COLORS.RESET}`);
        break;
      case 'done':
        console.log(`\n${COLORS.CYAN}✨ Done${COLORS.RESET}`);
        break;
    }
  }

  private async interactiveMode(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`${COLORS.CYAN}${COLORS.BOLD}`);
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║           AGI-OS Agent CLI v1.0.0               ║');
    console.log('║  Type "help" for commands, "exit" to quit       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`${COLORS.RESET}\n`);

    const prompt = () => {
      this.rl!.question(`${COLORS.CYAN}agent> ${COLORS.RESET}`, async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === 'exit' || trimmed === 'quit') {
          console.log(`${COLORS.CYAN}👋 Goodbye!${COLORS.RESET}`);
          this.rl!.close();
          process.exit(0);
        }

        if (trimmed === 'help') {
          this.showHelp();
          prompt();
          return;
        }

        if (trimmed === 'skills') {
          this.showSkills();
          prompt();
          return;
        }

        if (trimmed === 'clear') {
          console.clear();
          prompt();
          return;
        }

        const testCmd = trimmed.match(/--test-cmd\s+"([^"]+)"/)?.[1];
        const cleanPrompt = trimmed.replace(/--test-cmd\s+"[^"]+"/, '').trim();

        const request: ChatRequest = {
          messages: [{ role: 'user', content: cleanPrompt }],
          test_cmd: testCmd,
        };

        for await (const event of this.server.handleChatStream(request)) {
          this.handleEvent(event);
        }

        prompt();
      });
    };

    prompt();
  }

  private showHelp(): void {
    console.log(`${COLORS.CYAN}${COLORS.BOLD}📖 Available Commands:${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
    console.log(`  ${COLORS.GREEN}help${COLORS.RESET}                    Show this help message`);
    console.log(`  ${COLORS.GREEN}skills${COLORS.RESET}                  List loaded skills`);
    console.log(`  ${COLORS.GREEN}clear${COLORS.RESET}                  Clear the screen`);
    console.log(`  ${COLORS.GREEN}exit${COLORS.RESET} / ${COLORS.GREEN}quit${COLORS.RESET}              Exit the CLI`);
    console.log(`${COLORS.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
    console.log(`\n${COLORS.CYAN}💡 Usage:${COLORS.RESET}`);
    console.log(`  ${COLORS.GREEN}agent "prompt"${COLORS.RESET}              Execute a prompt`);
    console.log(`  ${COLORS.GREEN}agent "prompt" --test-cmd "cmd"${COLORS.RESET}  Execute with test`);
    console.log(`  ${COLORS.GREEN}agent --sync${COLORS.RESET}              Sync skills from GitHub`);
    console.log(`  ${COLORS.GREEN}agent${COLORS.RESET}                     Interactive mode`);
  }

  private showSkills(): void {
    const skills = this.server.getSkillEngine().getAllSkills();
    console.log(`${COLORS.CYAN}${COLORS.BOLD}📚 Loaded Skills:${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
    if (skills.length === 0) {
      console.log(`  ${COLORS.YELLOW}No skills loaded. Run "agent --sync" to load.${COLORS.RESET}`);
    } else {
      for (const skill of skills) {
        console.log(`  ${COLORS.GREEN}• ${skill.name}${COLORS.RESET} - ${skill.description}`);
        console.log(`    ${COLORS.YELLOW}Triggers: ${skill.triggers.join(', ')}${COLORS.RESET}`);
      }
    }
    console.log(`${COLORS.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
  }

  private findArg(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }
    return undefined;
  }
}
