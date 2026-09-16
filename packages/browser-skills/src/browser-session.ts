import { generateId, now } from '@agi-os/kernel';
import type { BrowserPage, BrowserAction, BrowserResult } from './types.js';

export class BrowserSession {
  private pages: BrowserPage[] = [];
  private history: BrowserAction[] = [];
  private currentIndex: number = -1;

  navigate(url: string): BrowserResult {
    const start = Date.now();
    const action: BrowserAction = { id: generateId(), type: 'navigate', target: url, timestamp: now().toISOString() };
    this.history.push(action);

    const page: BrowserPage = {
      id: generateId(),
      url,
      title: this.extractTitle(url),
      createdAt: now().toISOString(),
    };
    this.pages.push(page);
    this.currentIndex = this.pages.length - 1;

    return { success: true, action, output: { url, title: page.title }, page, duration: Date.now() - start };
  }

  getCurrentPage(): BrowserPage | undefined {
    return this.pages[this.currentIndex];
  }

  goBack(): BrowserResult {
    const action: BrowserAction = { id: generateId(), type: 'back', timestamp: now().toISOString() };
    this.history.push(action);
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return { success: true, action, output: this.pages[this.currentIndex], page: this.pages[this.currentIndex], duration: 0 };
    }
    return { success: false, action, output: null, error: 'No previous page', duration: 0 };
  }

  goForward(): BrowserResult {
    const action: BrowserAction = { id: generateId(), type: 'forward', timestamp: now().toISOString() };
    this.history.push(action);
    if (this.currentIndex < this.pages.length - 1) {
      this.currentIndex++;
      return { success: true, action, output: this.pages[this.currentIndex], page: this.pages[this.currentIndex], duration: 0 };
    }
    return { success: false, action, output: null, error: 'No next page', duration: 0 };
  }

  close(): void {
    this.pages = [];
    this.history = [];
    this.currentIndex = -1;
  }

  getHistory(): BrowserAction[] { return [...this.history]; }
  getPages(): BrowserPage[] { return [...this.pages]; }

  private extractTitle(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
  }
}
