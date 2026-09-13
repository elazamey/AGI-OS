export class RateLimiter {
  private counters: Map<string, { count: number; windowStart: number }> = new Map();

  check(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const counter = this.counters.get(key);

    if (!counter || now - counter.windowStart > windowMs) {
      this.counters.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetIn: windowMs };
    }

    if (counter.count >= limit) {
      return { allowed: false, remaining: 0, resetIn: windowMs - (now - counter.windowStart) };
    }

    counter.count++;
    return { allowed: true, remaining: limit - counter.count, resetIn: windowMs - (now - counter.windowStart) };
  }

  reset(key: string): void {
    this.counters.delete(key);
  }

  getCounts(): Map<string, { count: number; windowStart: number }> {
    return new Map(this.counters);
  }
}