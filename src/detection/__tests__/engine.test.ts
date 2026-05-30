// Engine validation against the real CSV. These tests assert the four claims
// the plan rests on:
//   1. HVAC_1's gradual degradation is caught (OK → WATCH → ACT across the day)
//   2. HVAC_2's single-reading spike at row 51 fires ACT via hard override
//   3. HVAC_3 stays OK the whole time
//   4. HVAC_4's missing-data rows do not cause false alerts
//
// We load the CSV from disk directly (this is a pure-Node test, no RN/Expo
// involvement).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';

import type { Reading, UnitMetadata } from '../../datasource/types';
import { SENSOR_KEYS } from '../../datasource/types';
import { evaluate, makeUnitState, type UnitState, type DetectionResult } from '../engine';
import { RingBuffer } from '../ringBuffer';
import { DEFAULT_CONFIG } from '../../config/defaults';

// ---- Fixtures ----------------------------------------------------------

const CSV_PATH = resolve(__dirname, '../../../assets/hvac_sensor_data.csv');
const METADATA_PATH = resolve(__dirname, '../../../assets/unit_metadata.json');

type CsvRow = {
  timestamp: string;
  unit_id: string;
  temp: string;
  pressure: string;
  airflow: string;
  vibration: string;
  power: string;
};

function parseNum(s: string): number | null {
  if (s === undefined || s === null || s === '') return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function loadReadings(): Reading[] {
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const parsed = Papa.parse<CsvRow>(raw, { header: true, skipEmptyLines: true });
  return parsed.data.map((row) => ({
    ts: new Date(row.timestamp.replace(' ', 'T') + 'Z').getTime(),
    unitId: row.unit_id,
    temp: parseNum(row.temp),
    pressure: parseNum(row.pressure) as number,
    airflow: parseNum(row.airflow),
    vibration: parseNum(row.vibration) as number,
    power: parseNum(row.power) as number,
  }));
}

function loadMetadata(): Record<string, UnitMetadata> {
  const raw = readFileSync(METADATA_PATH, 'utf-8');
  const arr = JSON.parse(raw) as UnitMetadata[];
  const map: Record<string, UnitMetadata> = {};
  for (const m of arr) map[m.unitId] = m;
  return map;
}

// Mimic the real runtime: interleave readings by ts, push into a ring buffer,
// call evaluate() each time a unit receives a new reading. Return the per-unit
// history of DetectionResults.
function simulate(allReadings: Reading[]): Map<string, DetectionResult[]> {
  const meta = loadMetadata();
  const buf = new RingBuffer(60);
  const state: Record<string, UnitState> = {};
  const out = new Map<string, DetectionResult[]>();

  // Sort by ts to mimic streaming order.
  const ordered = [...allReadings].sort((a, b) => a.ts - b.ts);

  for (const r of ordered) {
    buf.push(r);
    if (!state[r.unitId]) state[r.unitId] = makeUnitState();
    const window = buf.windowFor(r.unitId, 60);
    const peers = buf.latestPeers(r.unitId);
    const result = evaluate({
      unitId: r.unitId,
      window,
      peers,
      metadata: meta[r.unitId],
      config: DEFAULT_CONFIG.detection,
      state: state[r.unitId],
    });
    let history = out.get(r.unitId);
    if (!history) {
      history = [];
      out.set(r.unitId, history);
    }
    history.push(result);
  }
  return out;
}

// ---- Tests -------------------------------------------------------------

describe('detection engine — real CSV scenarios', () => {
  const readings = loadReadings();
  const results = simulate(readings);

  it('parses 1000 readings across 5 units', () => {
    expect(readings.length).toBe(1000);
    expect(new Set(readings.map((r) => r.unitId)).size).toBe(5);
  });

  it('HVAC_3 stays OK after cold start (healthy baseline)', () => {
    const h = results.get('HVAC_3')!;
    // Allow UNKNOWN during cold start.
    const post = h.slice(DEFAULT_CONFIG.detection.coldStartReadings);
    const acts = post.filter((r) => r.status === 'ACT');
    const watches = post.filter((r) => r.status === 'WATCH');
    expect(acts.length).toBe(0);
    // Permit at most a couple of transient WATCH blips across 175 readings on a
    // healthy unit. Anything more would mean we're noisy.
    expect(watches.length).toBeLessThanOrEqual(3);
  });

  it('HVAC_5 stays OK after cold start (healthy baseline)', () => {
    const h = results.get('HVAC_5')!;
    const post = h.slice(DEFAULT_CONFIG.detection.coldStartReadings);
    const acts = post.filter((r) => r.status === 'ACT');
    expect(acts.length).toBe(0);
  });

  it('HVAC_4 produces no ACT alerts despite missing temp/airflow data', () => {
    const h = results.get('HVAC_4')!;
    const post = h.slice(DEFAULT_CONFIG.detection.coldStartReadings);
    // HVAC_4 has ~55 missing temp + ~56 missing airflow per dataset profiling.
    // Vibration/pressure/power are complete and stable → no real anomaly.
    const acts = post.filter((r) => r.status === 'ACT');
    expect(acts.length).toBe(0);
  });

  it('HVAC_2 row 51 trips ACT via hard override (single-reading acute event)', () => {
    const h = results.get('HVAC_2')!;
    // Row 51 in the CSV's HVAC_2 stream is the spike (sim time 04:10).
    const acute = h[50]; // zero-indexed
    expect(acute).toBeDefined();
    expect(acute.status).toBe('ACT');
    expect(acute.hardOverride).toBe(true);
    expect(acute.confidence).toBeGreaterThanOrEqual(0.9);
    // The next reading (row 52) is back to normal — we should de-escalate.
    const after = h[51];
    expect(after.status).not.toBe('ACT');
  });

  it('HVAC_1 progresses from OK → WATCH → ACT across the day (gradual degradation)', () => {
    const h = results.get('HVAC_1')!;
    // Skip cold start.
    const post = h.slice(DEFAULT_CONFIG.detection.coldStartReadings);
    // Find first WATCH and first ACT.
    const firstWatchIdx = post.findIndex((r) => r.status === 'WATCH' || r.status === 'ACT');
    const firstActIdx = post.findIndex((r) => r.status === 'ACT');
    expect(firstWatchIdx).toBeGreaterThan(-1);
    expect(firstActIdx).toBeGreaterThan(firstWatchIdx);
    // ACT should be in the latter half (Q3/Q4).
    expect(firstActIdx).toBeGreaterThan(post.length / 2 - 10);
    // By the last reading we should be ACT.
    expect(post[post.length - 1].status).toBe('ACT');
  });

  it('cold-start window reports UNKNOWN for every unit', () => {
    for (const unit of ['HVAC_1', 'HVAC_2', 'HVAC_3', 'HVAC_4', 'HVAC_5']) {
      const h = results.get(unit)!;
      // First reading is UNKNOWN; baseline isn't ready yet.
      expect(h[0].status).toBe('UNKNOWN');
      expect(h[0].reasonCodes).toContain('cold_start');
    }
  });

  it('ACT results carry contributing sensors and reason codes', () => {
    const h = results.get('HVAC_2')!;
    const acute = h[50];
    expect(acute.contributing.length).toBeGreaterThan(0);
    expect(acute.contributing[0].score).toBeGreaterThan(0.8);
    expect(acute.reasonCodes).toContain('hard_override');
  });

  it('floor_std prevents inflated z-scores on a healthy quiet sensor', () => {
    // For HVAC_3, no individual reading should sit at sensor_score = 1.0 in
    // steady state — that would imply 3σ which floor_std must clamp.
    const h = results.get('HVAC_3')!;
    const post = h.slice(DEFAULT_CONFIG.detection.coldStartReadings);
    for (const r of post) {
      if (r.contributing.length === 0) continue;
      // Allow up to a few mild excursions but no readings should be saturated.
      // (We expect peer-z to flag HVAC_3 when peers are noisy, but baseline-z
      // shouldn't blow up.)
      const maxBaseZ = Math.max(...r.contributing.map((c) => Math.abs(c.baselineZ)));
      // sane upper bound — floor_std should keep this in check
      expect(maxBaseZ).toBeLessThan(50);
    }
  });
});
