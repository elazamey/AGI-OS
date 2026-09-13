import { describe, it, expect, beforeEach } from 'vitest';
import { TabManager } from '../src/tab-manager.js';

describe('TabManager', () => {
  let mgr: TabManager;
  beforeEach(() => { mgr = new TabManager(); });

  it('opens tab', () => {
    const tab = mgr.openTab('https://example.com');
    expect(tab.url).toBe('https://example.com');
    expect(mgr.getTabCount()).toBe(1);
  });

  it('switches tab', () => {
    const t1 = mgr.openTab('https://a.com');
    mgr.openTab('https://b.com');
    expect(mgr.switchTab(t1.id)).toBe(true);
    expect(mgr.getActiveTab()?.url).toBe('https://a.com');
  });

  it('closes tab', () => {
    const t1 = mgr.openTab('https://a.com');
    mgr.openTab('https://b.com');
    expect(mgr.closeTab(t1.id)).toBe(true);
    expect(mgr.getTabCount()).toBe(1);
  });

  it('fails closing nonexistent tab', () => {
    expect(mgr.closeTab('nonexistent')).toBe(false);
  });

  it('gets active tab', () => {
    mgr.openTab('https://a.com');
    expect(mgr.getActiveTab()).toBeDefined();
  });
});
