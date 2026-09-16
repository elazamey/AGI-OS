import { describe, it, expect, beforeEach } from 'vitest';
import { VisualGroundingEngine } from '../src/index.js';

describe('VisualGroundingEngine', () => {
  let engine: VisualGroundingEngine;

  beforeEach(() => {
    engine = new VisualGroundingEngine();
  });

  it('should create engine', () => {
    expect(engine).toBeDefined();
  });

  it('should analyze screen', () => {
    const analysis = engine.analyzeScreen('screenshot.png', { width: 1920, height: 1080 });
    expect(analysis.width).toBe(1920);
    expect(analysis.elements.length).toBeGreaterThan(0);
    expect(analysis.interactive_elements.length).toBeGreaterThan(0);
  });

  it('should find click target by description', () => {
    engine.analyzeScreen('screenshot.png');
    const target = engine.findClickTarget('Submit');
    expect(target).not.toBeNull();
    expect(target!.element.label).toBe('Submit');
    expect(target!.coordinates.x).toBeGreaterThan(0);
  });

  it('should return null for non-existent target', () => {
    engine.analyzeScreen('screenshot.png');
    const target = engine.findClickTarget('nonexistent');
    expect(target).toBeNull();
  });

  it('should find elements by type', () => {
    engine.analyzeScreen('screenshot.png');
    const buttons = engine.findElementsByType('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].type).toBe('button');
  });

  it('should find elements by confidence', () => {
    engine.analyzeScreen('screenshot.png');
    const highConf = engine.findElementsByConfidence(0.9);
    expect(highConf.length).toBeGreaterThan(0);
    highConf.forEach(e => expect(e.confidence).toBeGreaterThanOrEqual(0.9));
  });

  it('should track analysis history', () => {
    engine.analyzeScreen('s1.png');
    engine.analyzeScreen('s2.png');
    expect(engine.getAnalysisHistory().length).toBe(2);
  });

  it('should compare screens', () => {
    engine.analyzeScreen('s1.png');
    engine.analyzeScreen('s2.png');
    const diff = engine.compareScreens(0, 1);
    expect(diff).toBeDefined();
    expect(Array.isArray(diff.added)).toBe(true);
  });

  it('should detect interactive elements', () => {
    const analysis = engine.analyzeScreen('screenshot.png');
    analysis.interactive_elements.forEach(e => {
      expect(e.interactive).toBe(true);
    });
  });
});
