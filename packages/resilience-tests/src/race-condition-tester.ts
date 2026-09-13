import { now } from '@agi-os/kernel';
import type { RaceCondition, RaceTestResult } from './types.js';

export class RaceConditionTester {
  private races: RaceCondition[] = [
    {
      id: 'race-01',
      name: 'Concurrent file writes',
      description: 'Two agents writing to the same file simultaneously',
      operations: [
        async () => { return 'write-A'; },
        async () => { return 'write-B'; },
      ],
      expectedBehavior: 'last-write-wins',
    },
    {
      id: 'race-02',
      name: 'Concurrent approvals',
      description: 'Two approval requests for the same action',
      operations: [
        async () => { return 'approve-1'; },
        async () => { return 'approve-2'; },
      ],
      expectedBehavior: 'reject',
    },
    {
      id: 'race-03',
      name: 'Memory read during write',
      description: 'Reading memory while another agent is writing',
      operations: [
        async () => { return { key: 'value-v1' }; },
        async () => { return { key: 'value-v2' }; },
      ],
      expectedBehavior: 'last-write-wins',
    },
    {
      id: 'race-04',
      name: 'Skill registry concurrent register',
      description: 'Two skills registering with the same ID',
      operations: [
        async () => { return 'registered-A'; },
        async () => { return 'registered-B'; },
      ],
      expectedBehavior: 'reject',
    },
  ];

  addRace(race: RaceCondition): void {
    this.races.push(race);
  }

  async runRace(race: RaceCondition): Promise<RaceTestResult> {
    const start = Date.now();
    const results = await Promise.allSettled(race.operations.map(op => op()));
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const conflicts = race.operations.length - succeeded;

    let actualBehavior: string;
    if (conflicts === race.operations.length - 1) {
      actualBehavior = 'reject';
    } else if (succeeded === race.operations.length) {
      actualBehavior = 'last-write-wins';
    } else {
      actualBehavior = 'partial';
    }

    return {
      race,
      actualBehavior,
      passed: actualBehavior === race.expectedBehavior,
      conflicts,
      durationMs: Date.now() - start,
    };
  }

  async runAll(): Promise<RaceTestResult[]> {
    const results: RaceTestResult[] = [];
    for (const race of this.races) {
      results.push(await this.runRace(race));
    }
    return results;
  }

  getPassRate(): Promise<number> {
    return this.runAll().then(results => {
      if (results.length === 0) return 1;
      return results.filter(r => r.passed).length / results.length;
    });
  }

  getRaces(): RaceCondition[] {
    return [...this.races];
  }
}
