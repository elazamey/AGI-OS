import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserSession } from '../src/BrowserSession.js';

describe('BrowserSession', () => {
  let session: BrowserSession;

  beforeEach(() => {
    session = new BrowserSession();
  });

  it('should create with default config', () => {
    expect(session).toBeDefined();
    expect(session.getId()).toBeDefined();
  });

  it('should create with custom config', () => {
    const customSession = new BrowserSession({
      headless: false,
      timeout: 5000,
      viewport: { width: 1920, height: 1080 },
    });
    expect(customSession).toBeDefined();
  });

  it('should have unique ID', () => {
    const session1 = new BrowserSession();
    const session2 = new BrowserSession();
    expect(session1.getId()).not.toBe(session2.getId());
  });

  it('should not be active before launch', () => {
    expect(session.isActive()).toBe(false);
  });

  it('should get initial state', async () => {
    const state = await session.getState();
    expect(state.id).toBeDefined();
    expect(state.url).toBe('');
    expect(state.title).toBe('');
    expect(state.timestamp).toBeDefined();
  });
});

describe('BrowserSession launch', () => {
  it('should launch browser', async () => {
    const session = new BrowserSession({ headless: true });
    
    // Mock playwright
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue({
          newContext: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setDefaultTimeout: vi.fn(),
              url: vi.fn().mockReturnValue(''),
              title: vi.fn().mockReturnValue(''),
            }),
          }),
          close: vi.fn(),
        }),
      },
    }));

    await session.launch();
    expect(session.isActive()).toBe(true);
    await session.close();
  });

  it('should close browser', async () => {
    const session = new BrowserSession({ headless: true });
    
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue({
          newContext: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setDefaultTimeout: vi.fn(),
              url: vi.fn().mockReturnValue(''),
              title: vi.fn().mockReturnValue(''),
            }),
          }),
          close: vi.fn(),
        }),
      },
    }));

    await session.launch();
    expect(session.isActive()).toBe(true);
    
    await session.close();
    expect(session.isActive()).toBe(false);
  });
});
