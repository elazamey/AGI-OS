import type { ExtractedContent } from './types.js';

export class PageInspector {
  inspect(pageContent: string): ExtractedContent {
    return {
      text: this.extractText(pageContent),
      links: this.extractLinks(pageContent),
      images: this.extractImages(pageContent),
      tables: this.extractTables(pageContent),
      forms: this.extractForms(pageContent),
    };
  }

  private extractText(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractLinks(html: string): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      links.push({ href: match[1], text: match[2].replace(/<[^>]+>/g, '') });
    }
    return links;
  }

  private extractImages(html: string): Array<{ alt: string; src: string }> {
    const images: Array<{ alt: string; src: string }> = [];
    const regex = /<img[^>]+>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const tag = match[0];
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        images.push({ alt: altMatch?.[1] || '', src: srcMatch[1] });
      }
    }
    return images;
  }

  private extractTables(html: string): Array<{ headers: string[]; rows: string[][] }> {
    const tables: Array<{ headers: string[]; rows: string[][] }> = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const headers: string[] = [];
      const rows: string[][] = [];
      const headerRegex = /<th[^>]*>(.*?)<\/th>/gi;
      let h;
      while ((h = headerRegex.exec(tableMatch[1])) !== null) {
        headers.push(h[1].replace(/<[^>]+>/g, ''));
      }
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let r;
      while ((r = rowRegex.exec(tableMatch[1])) !== null) {
        const cells: string[] = [];
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gi;
        let c;
        while ((c = cellRegex.exec(r[1])) !== null) {
          cells.push(c[1].replace(/<[^>]+>/g, ''));
        }
        if (cells.length > 0) rows.push(cells);
      }
      tables.push({ headers, rows });
    }
    return tables;
  }

  private extractForms(html: string): Array<{ action: string; fields: Array<{ name: string; type: string; value?: string }> }> {
    const forms: Array<{ action: string; fields: Array<{ name: string; type: string; value?: string }> }> = [];
    const formRegex = /<form[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi;
    let f;
    while ((f = formRegex.exec(html)) !== null) {
      const fields: Array<{ name: string; type: string; value?: string }> = [];
      const inputRegex = /<input[^>]*name=["']([^"']*)["'][^>]*(?:type=["']([^"']*)["'])?[^>]*(?:value=["']([^"']*)["'])?[^>]*>/gi;
      let i;
      while ((i = inputRegex.exec(f[2])) !== null) {
        fields.push({ name: i[1], type: i[2] || 'text', value: i[3] });
      }
      forms.push({ action: f[1], fields });
    }
    return forms;
  }

  findElement(html: string, selector: string): { found: boolean; text?: string } {
    const textOnly = html.replace(/<[^>]+>/g, ' ').toLowerCase();
    const search = selector.toLowerCase();
    return { found: textOnly.includes(search), text: textOnly.substring(0, 200) };
  }
}
