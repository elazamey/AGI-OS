import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserActions } from '../src/BrowserActions.js';
import { BrowserSession } from '../src/BrowserSession.js';

describe('BrowserActions', () => {
  let session: BrowserSession;
  let actions: BrowserActions;

  beforeEach(() => {
    session = new BrowserSession();
    actions = new BrowserActions(session);
  });

  it('should create with session', () => {
    expect(actions).toBeDefined();
  });

  it('should throw error if browser not launched', async () => {
    await expect(actions.click({ selector: 'button' })).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for fill', async () => {
    await expect(actions.fill({ selector: 'input', value: 'test' })).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for screenshot', async () => {
    await expect(actions.screenshot()).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for extract', async () => {
    await expect(actions.extract({ selector: 'div' })).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for extractAll', async () => {
    await expect(actions.extractAll('div')).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for evaluate', async () => {
    await expect(actions.evaluate({ script: 'return 1' })).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for waitForSelector', async () => {
    await expect(actions.waitForSelector({ selector: 'div' })).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for selectOption', async () => {
    await expect(actions.selectOption('select', 'option')).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for hover', async () => {
    await expect(actions.hover('button')).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for focus', async () => {
    await expect(actions.focus('input')).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for press', async () => {
    await expect(actions.press('Enter')).rejects.toThrow('Browser not launched');
  });

  it('should throw error if browser not launched for type', async () => {
    await expect(actions.type('hello')).rejects.toThrow('Browser not launched');
  });
});

describe('BrowserActions with mocked page', () => {
  let session: BrowserSession;
  let actions: BrowserActions;
  let mockPage: any;

  beforeEach(() => {
    session = new BrowserSession();
    actions = new BrowserActions(session);
    
    mockPage = {
      click: vi.fn(),
      fill: vi.fn(),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
      textContent: vi.fn().mockResolvedValue('text'),
      getAttribute: vi.fn().mockResolvedValue('attr'),
      $$eval: vi.fn().mockResolvedValue(['text1', 'text2']),
      evaluate: vi.fn().mockResolvedValue(42),
      waitForSelector: vi.fn(),
      selectOption: vi.fn(),
      hover: vi.fn(),
      focus: vi.fn(),
      keyboard: {
        press: vi.fn(),
        type: vi.fn(),
      },
    };
  });

  it('should click element', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.click({ selector: 'button' });
    expect(mockPage.click).toHaveBeenCalledWith('button', {
      button: 'left',
      clickCount: 1,
      delay: undefined,
    });
  });

  it('should fill input', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.fill({ selector: 'input', value: 'test' });
    expect(mockPage.fill).toHaveBeenCalledWith('input', 'test', { delay: undefined });
  });

  it('should take screenshot', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    const result = await actions.screenshot();
    expect(result).toBe(Buffer.from('screenshot').toString('base64'));
    expect(mockPage.screenshot).toHaveBeenCalled();
  });

  it('should extract text', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    const result = await actions.extract({ selector: 'div' });
    expect(result).toBe('text');
    expect(mockPage.textContent).toHaveBeenCalledWith('div');
  });

  it('should extract attribute', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    const result = await actions.extract({ selector: 'a', attribute: 'href' });
    expect(result).toBe('attr');
    expect(mockPage.getAttribute).toHaveBeenCalledWith('a', 'href');
  });

  it('should extract all text', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    const result = await actions.extractAll('div');
    expect(result).toEqual(['text1', 'text2']);
    expect(mockPage.$$eval).toHaveBeenCalled();
  });

  it('should evaluate script', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    const result = await actions.evaluate({ script: 'return 42' });
    expect(result).toBe(42);
    expect(mockPage.evaluate).toHaveBeenCalledWith('return 42');
  });

  it('should wait for selector', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.waitForSelector({ selector: 'div', timeout: 5000 });
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('div', {
      state: 'visible',
      timeout: 5000,
    });
  });

  it('should select option', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.selectOption('select', 'option1');
    expect(mockPage.selectOption).toHaveBeenCalledWith('select', 'option1');
  });

  it('should hover element', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.hover('button');
    expect(mockPage.hover).toHaveBeenCalledWith('button');
  });

  it('should focus element', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.focus('input');
    expect(mockPage.focus).toHaveBeenCalledWith('input');
  });

  it('should press key', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.press('Enter');
    expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('should type text', async () => {
    // @ts-ignore
    session['page'] = mockPage;
    
    await actions.type('hello', 100);
    expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello', { delay: 100 });
  });
});
