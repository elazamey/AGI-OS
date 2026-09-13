export class UnicodeTester {
  testEncoding(text: string): { preserved: boolean; length: number } {
    const encoded = encodeURIComponent(text);
    const decoded = decodeURIComponent(encoded);
    return {
      preserved: decoded === text,
      length: text.length,
    };
  }

  testMixedContent(arabic: string, english: string, symbols: string): { combined: string; valid: boolean } {
    const combined = `${arabic} ${english} ${symbols}`;
    const valid = this.is(combined);
    return { combined, valid };
  }

  testEmoji(text: string): boolean {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
    const matches = text.match(emojiRegex);
    return matches !== null && matches.length > 0;
  }

  private is(text: string): boolean {
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(bytes);
      return decoded === text;
    } catch {
      return false;
    }
  }
}
