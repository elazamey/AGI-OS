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
    // Unicode property escape: covers every pictographic emoji block without
    // enumerating code-point ranges (which silently rot as Unicode evolves).
    const emojiRegex = /\p{Extended_Pictographic}/u;
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
