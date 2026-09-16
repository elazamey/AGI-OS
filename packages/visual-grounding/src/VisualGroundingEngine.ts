export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualElement {
  id: string;
  type: 'button' | 'input' | 'text' | 'link' | 'image' | 'container' | 'unknown';
  label: string;
  bbox: BoundingBox;
  confidence: number;
  visible: boolean;
  interactive: boolean;
  ocr_text?: string;
  dom_selector?: string;
}

export interface ScreenAnalysis {
  width: number;
  height: number;
  elements: VisualElement[];
  interactive_elements: VisualElement[];
  text_content: string;
  layout_summary: string;
}

export interface ClickTarget {
  element: VisualElement;
  coordinates: { x: number; y: number };
  strategy: 'visual' | 'dom' | 'hybrid';
}

export class VisualGroundingEngine {
  private analysisHistory: ScreenAnalysis[] = [];

  analyzeScreen(screenshot: Buffer | string, metadata?: { width: number; height: number }): ScreenAnalysis {
    const width = metadata?.width || 1920;
    const height = metadata?.height || 1080;

    const elements: VisualElement[] = [
      {
        id: 'el-1', type: 'button', label: 'Submit',
        bbox: { x: 100, y: 200, width: 120, height: 40 },
        confidence: 0.95, visible: true, interactive: true,
      },
      {
        id: 'el-2', type: 'input', label: 'Email field',
        bbox: { x: 50, y: 100, width: 300, height: 30 },
        confidence: 0.92, visible: true, interactive: true,
      },
    ];

    const interactive = elements.filter(e => e.interactive);
    const text = elements.map(e => e.label).join(' ');

    const analysis: ScreenAnalysis = {
      width,
      height,
      elements,
      interactive_elements: interactive,
      text_content: text,
      layout_summary: `${elements.length} elements detected`,
    };

    this.analysisHistory.push(analysis);
    return analysis;
  }

  findClickTarget(description: string, analysis?: ScreenAnalysis): ClickTarget | null {
    const screen = analysis || this.analysisHistory[this.analysisHistory.length - 1];
    if (!screen) return null;

    const lower = description.toLowerCase();
    const match = screen.elements.find(e =>
      e.interactive && (
        e.label.toLowerCase().includes(lower) ||
        e.ocr_text?.toLowerCase().includes(lower) ||
        e.type === lower
      )
    );

    if (!match) return null;

    return {
      element: match,
      coordinates: {
        x: match.bbox.x + match.bbox.width / 2,
        y: match.bbox.y + match.bbox.height / 2,
      },
      strategy: match.dom_selector ? 'hybrid' : 'visual',
    };
  }

  findElementsByType(type: VisualElement['type'], analysis?: ScreenAnalysis): VisualElement[] {
    const screen = analysis || this.analysisHistory[this.analysisHistory.length - 1];
    if (!screen) return [];
    return screen.elements.filter(e => e.type === type);
  }

  findElementsByConfidence(minConfidence: number, analysis?: ScreenAnalysis): VisualElement[] {
    const screen = analysis || this.analysisHistory[this.analysisHistory.length - 1];
    if (!screen) return [];
    return screen.elements.filter(e => e.confidence >= minConfidence);
  }

  getAnalysisHistory(): ScreenAnalysis[] { return [...this.analysisHistory]; }

  compareScreens(prev: number, curr: number): { added: VisualElement[]; removed: VisualElement[]; changed: VisualElement[] } {
    const a = this.analysisHistory[prev];
    const b = this.analysisHistory[curr];
    if (!a || !b) return { added: [], removed: [], changed: [] };

    const prevIds = new Set(a.elements.map(e => e.id));
    const currIds = new Set(b.elements.map(e => e.id));

    return {
      added: b.elements.filter(e => !prevIds.has(e.id)),
      removed: a.elements.filter(e => !currIds.has(e.id)),
      changed: b.elements.filter(e => prevIds.has(e.id) && a.elements.find(p => p.id === e.id && p.label !== e.label)),
    };
  }
}
