// Ephemeral runtime store of per-unit status, latest reading, and rolling
// sensor histories for sparklines. Rebuilt from the data source on app start.
// NOT persisted — config and alert history live in their own MMKV-backed stores.

import { create } from 'zustand';
import type { Reading, SensorKey } from '../datasource/types';
import type { DetectionResult } from '../detection/engine';

type UnitSnapshot = {
  unitId: string;
  latest: Reading | null;
  detection: DetectionResult | null;
  // Per-sensor rolling values for sparklines. Plain numbers (skip nulls).
  history: Record<SensorKey, { ts: number; value: number }[]>;
  // Updated timestamp (wall clock) so UIs can show "x sec ago" if useful.
  updatedAtWall: number;
};

const HISTORY_LEN = 60; // ~5 hours sim time of 5-min ticks

type FleetState = {
  units: Record<string, UnitSnapshot>;
  unitOrder: string[]; // insertion order for stable rendering
  simTime: number | null;
  upsert: (reading: Reading, result: DetectionResult, simTime: number | null) => void;
  reset: () => void;
};

const empty: Record<SensorKey, { ts: number; value: number }[]> = {
  temp: [], pressure: [], airflow: [], vibration: [], power: [],
};

export const useFleetStore = create<FleetState>((set) => ({
  units: {},
  unitOrder: [],
  simTime: null,
  upsert: (reading, result, simTime) =>
    set((s) => {
      const existing = s.units[reading.unitId];
      const history = existing
        ? { ...existing.history }
        : { temp: [], pressure: [], airflow: [], vibration: [], power: [] };
      // Append non-null sensor values; trim to HISTORY_LEN.
      for (const key of ['temp', 'pressure', 'airflow', 'vibration', 'power'] as SensorKey[]) {
        const v = reading[key];
        if (v === null || !Number.isFinite(v as number)) continue;
        const arr = [...history[key], { ts: reading.ts, value: v as number }];
        if (arr.length > HISTORY_LEN) arr.shift();
        history[key] = arr;
      }
      const snap: UnitSnapshot = {
        unitId: reading.unitId,
        latest: reading,
        detection: result,
        history,
        updatedAtWall: Date.now(),
      };
      const units = { ...s.units, [reading.unitId]: snap };
      const unitOrder = existing ? s.unitOrder : [...s.unitOrder, reading.unitId];
      return { units, unitOrder, simTime: simTime ?? s.simTime };
    }),
  reset: () => set({ units: {}, unitOrder: [], simTime: null }),
}));

// Convenience selectors

export const selectUnitsSortedBySeverity = (s: FleetState) => {
  const order: Record<string, number> = { ACT: 0, WATCH: 1, UNKNOWN: 2, OK: 3 };
  const list = s.unitOrder.map((id) => s.units[id]).filter(Boolean);
  return list.sort((a, b) => {
    const sa = a.detection?.status ?? 'UNKNOWN';
    const sb = b.detection?.status ?? 'UNKNOWN';
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    // Tie-break: higher confidence first within same status.
    return (b.detection?.confidence ?? 0) - (a.detection?.confidence ?? 0);
  });
};

export const selectFleetSummary = (s: FleetState) => {
  const counts = { OK: 0, WATCH: 0, ACT: 0, UNKNOWN: 0 };
  for (const id of s.unitOrder) {
    const status = s.units[id]?.detection?.status ?? 'UNKNOWN';
    counts[status]++;
  }
  return counts;
};
