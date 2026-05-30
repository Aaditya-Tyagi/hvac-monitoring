import type { Reading } from '../datasource/types';

// Per-unit bounded buffer of last N readings. We retain insertion order and
// allow read of last K. Simple array with a max size — no perf concern at
// our cadence (one reading per unit per 5 min sim time).
export class RingBuffer {
  private readonly capacity: number;
  private readonly map = new Map<string, Reading[]>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  push(r: Reading): void {
    let arr = this.map.get(r.unitId);
    if (!arr) {
      arr = [];
      this.map.set(r.unitId, arr);
    }
    arr.push(r);
    if (arr.length > this.capacity) arr.shift();
  }

  // Read-only access to the last N readings for a unit (chronological).
  windowFor(unitId: string, n?: number): readonly Reading[] {
    const arr = this.map.get(unitId);
    if (!arr || arr.length === 0) return [];
    if (n === undefined || n >= arr.length) return arr;
    return arr.slice(arr.length - n);
  }

  latestFor(unitId: string): Reading | undefined {
    const arr = this.map.get(unitId);
    return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
  }

  // Returns the latest reading for every OTHER unit (excludes `exceptUnitId`).
  // Used to compute the peer snapshot for detection.
  latestPeers(exceptUnitId: string): Reading[] {
    const out: Reading[] = [];
    for (const [unit, arr] of this.map) {
      if (unit === exceptUnitId) continue;
      if (arr.length > 0) out.push(arr[arr.length - 1]);
    }
    return out;
  }

  unitIds(): string[] {
    return [...this.map.keys()];
  }

  reset(unitId?: string): void {
    if (unitId) this.map.delete(unitId);
    else this.map.clear();
  }
}
