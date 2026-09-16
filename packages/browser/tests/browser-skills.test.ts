import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserSkills } from '../src/BrowserSkills.js';
import { BrowserSession } from '../src/BrowserSession.js';

describe('BrowserSkills', () => {
  let session: BrowserSession;
  let skills: BrowserSkills;

  beforeEach(() => {
    session = new BrowserSession();
    skills = new BrowserSkills(session);
  });

  it('should create with session', () => {
    expect(skills).toBeDefined();
  });

  it('should return error if browser not launched for navigate', async () => {
    const result = await skills.navigate('http://example.com');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for click', async () => {
    const result = await skills.click('button');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for fill', async () => {
    const result = await skills.fill('input', 'test');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for screenshot', async () => {
    const result = await skills.screenshot();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for extractText', async () => {
    const result = await skills.extractText('div');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for extractAllText', async () => {
    const result = await skills.extractAllText('div');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for extractAttribute', async () => {
    const result = await skills.extractAttribute('a', 'href');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for evaluate', async () => {
    const result = await skills.evaluate('return 1');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for waitForElement', async () => {
    const result = await skills.waitForElement('div');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error if browser not launched for selectOption', async () => {
    const result = await skills.selectOption('select', 'option');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should get page state', async () => {
    const result = await skills.getPageState();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

describe('BrowserSkills with mocked session', () => {
  let session: BrowserSession;
  let skills: BrowserSkills;
  let mockPage: any;

  beforeEach(() => {
    session = new BrowserSession();
    skills = new BrowserSkills(session);
    
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('http://example.com'),
      title: vi.fn().mockReturnValue('Example'),
      click: vi.fn(),
      fill: vi.fn(),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
      textContent: vi.fn().mockResolvedValue('text content'),
      getAttribute: vi.fn().mockReturnValue('attr-value'),
      $$eval: vi.fn().mockResolvedValue(['item1', 'item2']),
      evaluate: vi.fn().mockResolvedValue({ result: 'success' }),
      waitForSelector: vi.fn(),
      selectOption: vi.fn(),
    };
  });

  it('should navigate successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    (session as unknown as Record<string, unknown>)['browser'] = {};
    
    const result = await skills.navigate('http://example.com');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(mockPage.goto).toHaveBeenCalled();
  });

  it('should click successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.click('button.submit');
    expect(result.success).toBe(true);
    expect(mockPage.click).toHaveBeenCalled();
  });

  it('should fill successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.fill('input#name', 'John Doe');
    expect(result.success).toBe(true);
    expect(mockPage.fill).toHaveBeenCalled();
  });

  it('should take screenshot successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.screenshot();
    expect(result.success).toBe(true);
    expect(result.data).toBe(Buffer.from('screenshot').toString('base64'));
  });

  it('should extract text successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.extractText('p.content');
    expect(result.success).toBe(true);
    expect(result.data).toBe('text content');
  });

  it('should extract all text successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.extractAllText('li');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(['item1', 'item2']);
  });

  it('should extract attribute successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.extractAttribute('a', 'href');
    expect(result.success).toBe(true);
    expect(result.data).toBe('attr-value');
  });

  it('should evaluate script successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.evaluate('return { result: "success" }');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ result: 'success' });
  });

  it('should wait for element successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.waitForElement('div.loaded', 5000);
    expect(result.success).toBe(true);
    expect(mockPage.waitForSelector).toHaveBeenCalled();
  });

  it('should select option successfully', async () => {
    (session as unknown as Record<string, unknown>)['page'] = mockPage;
    
    const result = await skills.selectOption('select#country', 'US');
    expect(result.success).toBe(true);
    expect(mockPage.selectOption).toHaveBeenCalled();
  });
});
