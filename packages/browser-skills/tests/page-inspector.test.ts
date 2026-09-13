import { describe, it, expect } from 'vitest';
import { PageInspector } from '../src/page-inspector.js';

describe('PageInspector', () => {
  const inspector = new PageInspector();

  it('extracts text', () => {
    const result = inspector.inspect('<p>Hello World</p>');
    expect(result.text).toContain('Hello World');
  });

  it('extracts links', () => {
    const result = inspector.inspect('<a href="https://example.com">Click</a>');
    expect(result.links.length).toBe(1);
    expect(result.links[0].href).toBe('https://example.com');
  });

  it('extracts images', () => {
    const result = inspector.inspect('<img alt="Photo" src="img.png">');
    expect(result.images.length).toBe(1);
    expect(result.images[0].alt).toBe('Photo');
  });

  it('extracts tables', () => {
    const html = '<table><tr><th>Name</th></tr><tr><td>John</td></tr></table>';
    const result = inspector.inspect(html);
    expect(result.tables.length).toBe(1);
    expect(result.tables[0].headers[0]).toBe('Name');
  });

  it('finds element', () => {
    const result = inspector.findElement('<p>Hello World</p>', 'Hello');
    expect(result.found).toBe(true);
  });
});
