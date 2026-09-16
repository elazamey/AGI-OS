import { generateId } from '@agi-os/kernel';

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
  proxy?: { server: string; username?: string; password?: string };
}

export interface BrowserSessionState {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  screenshot?: string;
}

export class BrowserSession {
  private id: string;
  private config: BrowserConfig;
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private state: BrowserSessionState;

  constructor(config: BrowserConfig = {}) {
    this.id = generateId();
    this.config = {
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      ...config,
    };
    this.state = {
      id: this.id,
      url: '',
      title: '',
      timestamp: Date.now(),
    };
  }

  async launch(): Promise<void> {
    const playwright = await import('playwright');
    const browserType = this.config.headless ? playwright.chromium : playwright.chromium;

    this.browser = await browserType.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      proxy: this.config.proxy,
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout!);
  }

  async navigate(url: string): Promise<BrowserSessionState> {
    if (!this.page) throw new Error('Browser not launched. Call launch() first.');

    await this.page.goto(url, { waitUntil: 'networkidle' });
    this.state.url = this.page.url();
    this.state.title = await this.page.title();
    this.state.timestamp = Date.now();

    return { ...this.state };
  }

  async getState(): Promise<BrowserSessionState> {
    if (this.page) {
      this.state.url = this.page.url();
      this.state.title = await this.page.title();
      this.state.timestamp = Date.now();
    }
    return { ...this.state };
  }

  async getPage(): Promise<any> {
    return this.page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  getId(): string {
    return this.id;
  }

  isActive(): boolean {
    return this.browser !== null && this.page !== null;
  }
}
