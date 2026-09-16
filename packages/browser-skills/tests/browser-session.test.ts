import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserSession } from '../src/browser-session.js';

describe('BrowserSession', () => {
  let session: BrowserSession;
  beforeEach(() => { session = new BrowserSession(); });

  it('navigates to URL', () => {
    const result = session.navigate('https://example.com');
    expect(result.success).toBe(true);
    expect(result.page?.url).toBe('https://example.com');
  });

  it('tracks history', () => {
    session.navigate('https://a.com');
    session.navigate('https://b.com');
    expect(session.getHistory().length).toBe(2);
  });

  it('goes back', () => {
    session.navigate('https://a.com');
    session.navigate('https://b.com');
    const result = session.goBack();
    expect(result.success).toBe(true);
    expect(session.getCurrentPage()?.url).toBe('https://a.com');
  });

  it('goes forward', () => {
    session.navigate('https://a.com');
    session.navigate('https://b.com');
    session.goBack();
    const result = session.goForward();
    expect(result.success).toBe(true);
    expect(session.getCurrentPage()?.url).toBe('https://b.com');
  });

  it('fails going back at start', () => {
    const result = session.goBack();
    expect(result.success).toBe(false);
  });

  it('closes session', () => {
    session.navigate('https://a.com');
    session.close();
    expect(session.getPages().length).toBe(0);
  });
});
