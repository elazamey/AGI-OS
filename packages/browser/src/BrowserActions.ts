import { BrowserSession } from './BrowserSession.js';

export interface ClickOptions {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface FillOptions {
  selector: string;
  value: string;
  delay?: number;
}

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  selector?: string;
}

export interface ExtractOptions {
  selector: string;
  attribute?: string;
}

export interface EvaluateOptions {
  script: string;
  args?: unknown[];
}

export interface WaitForSelectorOptions {
  selector: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
}

export class BrowserActions {
  private session: BrowserSession;

  constructor(session: BrowserSession) {
    this.session = session;
  }

  async click(options: ClickOptions): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.click(options.selector, {
      button: options.button || 'left',
      clickCount: options.clickCount || 1,
      delay: options.delay,
    });
  }

  async fill(options: FillOptions): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.fill(options.selector, options.value, {
      delay: options.delay,
    });
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    const buffer = await page.screenshot({
      path: options.path,
      fullPage: options.fullPage || false,
      clip: options.selector ? undefined : undefined,
    });

    return buffer.toString('base64');
  }

  async extract(options: ExtractOptions): Promise<string | null> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    if (options.attribute) {
      return await page.getAttribute(options.selector, options.attribute);
    }

    return await page.textContent(options.selector);
  }

  async extractAll(selector: string): Promise<string[]> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    return await page.$$eval(selector, (elements: Element[]) =>
      elements.map(el => el.textContent || '')
    );
  }

  async evaluate(options: EvaluateOptions): Promise<unknown> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    return await page.evaluate(options.script, ...(options.args || []));
  }

  async waitForSelector(options: WaitForSelectorOptions): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.waitForSelector(options.selector, {
      state: options.state || 'visible',
      timeout: options.timeout || 30000,
    });
  }

  async selectOption(selector: string, values: string | string[]): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.selectOption(selector, values);
  }

  async hover(selector: string): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.hover(selector);
  }

  async focus(selector: string): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.focus(selector);
  }

  async press(key: string): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.keyboard.press(key);
  }

  async type(text: string, delay?: number): Promise<void> {
    const page = await this.session.getPage();
    if (!page) throw new Error('Browser not launched');

    await page.keyboard.type(text, { delay });
  }
}
