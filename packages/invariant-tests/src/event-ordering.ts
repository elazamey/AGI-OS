import { EventOrder } from "./types.js";

export class EventOrderingTester {
  validateOrder(
    events: { id: string; timestamp: number; type: string }[]
  ): { ordered: boolean; violations: string[] } {
    const violations: string[] = [];

    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp < events[i - 1].timestamp) {
        violations.push(
          `Event ${events[i].id} has earlier timestamp than ${events[i - 1].id}`
        );
      }
      if (events[i].timestamp === events[i - 1].timestamp) {
        violations.push(
          `Events ${events[i - 1].id} and ${events[i].id} have same timestamp`
        );
      }
    }

    return { ordered: violations.length === 0, violations };
  }

  detectDuplicates(
    events: { id: string }[]
  ): { duplicates: string[]; uniqueCount: number } {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const e of events) {
      if (seen.has(e.id)) {
        duplicates.push(e.id);
      }
      seen.add(e.id);
    }

    return { duplicates, uniqueCount: seen.size };
  }

  detectStaleEvents(
    events: { id: string; timestamp: number; maxAge: number }[]
  ): { stale: string[]; fresh: string[] } {
    const now = Date.now();
    const stale: string[] = [];
    const fresh: string[] = [];

    for (const e of events) {
      if (now - e.timestamp > e.maxAge) {
        stale.push(e.id);
      } else {
        fresh.push(e.id);
      }
    }

    return { stale, fresh };
  }
}
