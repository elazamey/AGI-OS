export interface BrowserPage {
  id: string;
  url: string;
  title: string;
  content?: string;
  screenshot?: string;
  createdAt: string;
}

export interface BrowserAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot' | 'extract' | 'fill' | 'select' | 'back' | 'forward' | 'reload' | 'close_tab' | 'new_tab';
  target?: string;
  value?: string;
  selector?: string;
  timestamp: string;
}

export interface BrowserResult {
  success: boolean;
  action: BrowserAction;
  output: unknown;
  page?: BrowserPage;
  error?: string;
  duration: number;
}

export interface ExtractedContent {
  text: string;
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
  forms: Array<{ action: string; fields: Array<{ name: string; type: string; value?: string }> }>;
}
