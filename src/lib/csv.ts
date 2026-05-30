import Papa from 'papaparse';
import type { Reading } from '../datasource/types';

type CsvRow = {
  timestamp: string;
  unit_id: string;
  temp: string;
  pressure: string;
  airflow: string;
  vibration: string;
  power: string;
};

function parseOptionalNum(s: string | undefined | null): number | null {
  if (s === undefined || s === null || s === '') return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function parseTs(s: string): number {
  // CSV timestamps look like "2026-01-01 04:10:00". Treat as UTC for stability.
  return new Date(s.replace(' ', 'T') + 'Z').getTime();
}

export function parseCsv(text: string): Reading[] {
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
  const out: Reading[] = [];
  for (const row of parsed.data) {
    if (!row.unit_id) continue;
    const pressure = parseOptionalNum(row.pressure);
    const vibration = parseOptionalNum(row.vibration);
    const power = parseOptionalNum(row.power);
    // We treat pressure/vibration/power as required (the dataset has no nulls
    // for these). If they're missing in real data, the engine will surface
    // UNKNOWN via the >=3 missing sensors rule.
    out.push({
      ts: parseTs(row.timestamp),
      unitId: row.unit_id,
      temp: parseOptionalNum(row.temp),
      pressure: (pressure ?? Number.NaN) as number,
      airflow: parseOptionalNum(row.airflow),
      vibration: (vibration ?? Number.NaN) as number,
      power: (power ?? Number.NaN) as number,
    });
  }
  return out;
}
