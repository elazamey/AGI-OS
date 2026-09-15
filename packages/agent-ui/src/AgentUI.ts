import type { SkillRegistry} from '@agi-os/skill-registry';
import { SkillMetadata } from '@agi-os/skill-registry';
import type { ParsedSkill, ExecutionResult } from '@agi-os/skill-loader';
import { SkillLoader } from '@agi-os/skill-loader';
import type { CapabilityManager } from '@agi-os/capability-marketplace';

export interface UIConfig {
  title?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
  enableMarkdown?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UIState {
  messages: Message[];
  loadedSkills: ParsedSkill[];
  isProcessing: boolean;
  currentSkill?: string;
}

export class AgentUI {
  private registry: SkillRegistry;
  private loader: SkillLoader;
  private capabilityManager: CapabilityManager;
  private config: UIConfig;
  private state: UIState;

  constructor(registry: SkillRegistry, capabilityManager: CapabilityManager, config: UIConfig = {}) {
    this.registry = registry;
    this.loader = new SkillLoader({ registry });
    this.capabilityManager = capabilityManager;
    this.config = {
      title: 'AGI-OS Agent',
      theme: 'dark',
      showLineNumbers: true,
      enableMarkdown: true,
      ...config,
    };
    this.state = {
      messages: [],
      loadedSkills: [],
      isProcessing: false,
    };
  }

  async processInput(input: string): Promise<Message> {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    this.state.messages.push(userMessage);

    this.state.isProcessing = true;

    // Try to find and execute matching skill
    const response = await this.generateResponse(input);

    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    this.state.messages.push(assistantMessage);

    this.state.isProcessing = false;
    return assistantMessage;
  }

  private async generateResponse(input: string): Promise<string> {
    // Search for matching skills
    const searchResults = this.registry.search(input);

    if (searchResults.length > 0) {
      const topSkill = searchResults[0];
      return `I found a skill that might help: **${topSkill.skill.name}**

${topSkill.skill.description}

**Capabilities:**
${topSkill.skill.capabilities.map(c => `- ${c}`).join('\n')}

Would you like me to execute this skill?`;
    }

    // Default response
    return `I understand you're asking about: "${input}"

I can help you with:
- **File Operations**: Read, write, and manage files
- **Web Browsing**: Search and browse the web
- **Code Generation**: Generate code in various languages
- **Data Analysis**: Analyze and visualize data

Try asking me to "read a file" or "search the web" to get started!`;
  }

  async executeSkill(skillName: string, input: Record<string, unknown> = {}): Promise<ExecutionResult> {
    return this.loader.executeSkill(skillName, input);
  }

  getMessages(): Message[] {
    return [...this.state.messages];
  }

  getState(): UIState {
    return { ...this.state };
  }

  getLoadedSkills(): ParsedSkill[] {
    return this.loader.getLoadedSkills();
  }

  searchSkills(query: string): ParsedSkill[] {
    return this.loader.searchSkills(query);
  }

  clearHistory(): void {
    this.state.messages = [];
  }

  getConfig(): UIConfig {
    return { ...this.config };
  }
}
