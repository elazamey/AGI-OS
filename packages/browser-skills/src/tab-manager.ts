import { generateId, now } from '@agi-os/kernel';
import type { BrowserPage } from './types.js';

export class TabManager {
  private tabs: BrowserPage[] = [];
  private activeTabId: string | null = null;

  openTab(url: string): BrowserPage {
    const tab: BrowserPage = { id: generateId(), url, title: url, createdAt: now().toISOString() };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    return tab;
  }

  closeTab(tabId: string): boolean {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return false;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
    }
    return true;
  }

  switchTab(tabId: string): boolean {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;
    this.activeTabId = tabId;
    return true;
  }

  getActiveTab(): BrowserPage | undefined {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  getTabs(): BrowserPage[] { return [...this.tabs]; }
  getTabCount(): number { return this.tabs.length; }
}
