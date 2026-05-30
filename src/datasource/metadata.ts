import type { UnitMetadata } from './types';

// JSON imports in React Native are parsed inline by Metro — no expo-asset
// detour needed. `require('./foo.json')` returns the parsed value directly.
// We accept the already-parsed array straight from the caller.
let cache: Record<string, UnitMetadata> | null = null;

export function setUnitMetadata(arr: UnitMetadata[]): Record<string, UnitMetadata> {
  cache = {};
  for (const m of arr) cache[m.unitId] = m;
  return cache;
}

export function getCachedMetadata(): Record<string, UnitMetadata> {
  return cache ?? {};
}
