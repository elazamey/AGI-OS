import { BrowserSession } from './BrowserSession.js';
import { BrowserActions } from './BrowserActions.js';

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class BrowserSkills {
  private session: BrowserSession;
  private actions: BrowserActions;

  constructor(session: BrowserSession) {
    this.session = session;
    this.actions = new BrowserActions(session);
  }

  async navigate(url: string): Promise<SkillResult> {
    try {
      const state = await this.session.navigate(url);
      return {
        success: true,
        data: state,
        metadata: {
          url: state.url,
          title: state.title,
          timestamp: state.timestamp,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async click(selector: string): Promise<SkillResult> {
    try {
      await this.actions.click({ selector });
      return {
        success: true,
        metadata: { selector },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async fill(selector: string, value: string): Promise<SkillResult> {
    try {
      await this.actions.fill({ selector, value });
      return {
        success: true,
        metadata: { selector, valueLength: value.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async screenshot(fullPage: boolean = false): Promise<SkillResult> {
    try {
      const base64 = await this.actions.screenshot({ fullPage });
      return {
        success: true,
        data: base64,
        metadata: { format: 'base64', fullPage },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async extractText(selector: string): Promise<SkillResult> {
    try {
      const text = await this.actions.extract({ selector });
      return {
        success: true,
        data: text,
        metadata: { selector },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async extractAllText(selector: string): Promise<SkillResult> {
    try {
      const texts = await this.actions.extractAll(selector);
      return {
        success: true,
        data: texts,
        metadata: { selector, count: texts.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async extractAttribute(selector: string, attribute: string): Promise<SkillResult> {
    try {
      const value = await this.actions.extract({ selector, attribute });
      return {
        success: true,
        data: value,
        metadata: { selector, attribute },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async evaluate(script: string): Promise<SkillResult> {
    try {
      const result = await this.actions.evaluate({ script });
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async waitForElement(selector: string, timeout: number = 30000): Promise<SkillResult> {
    try {
      await this.actions.waitForSelector({ selector, timeout });
      return {
        success: true,
        metadata: { selector, timeout },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async selectOption(selector: string, values: string | string[]): Promise<SkillResult> {
    try {
      await this.actions.selectOption(selector, values);
      return {
        success: true,
        metadata: { selector },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPageState(): Promise<SkillResult> {
    try {
      const state = await this.session.getState();
      return {
        success: true,
        data: state,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
