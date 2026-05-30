// Replays the bundled CSV as if it were a live sensor stream, on a configurable
// tick interval. Default 200 ms per simulated 5-min step ≈ 1500× real time, so
// the full 16-hour dataset replays in ~32 seconds and the technician's
// experience of two distinct anomalies (HVAC_1 gradual, HVAC_2 acute) fits a
// 60-second demo.

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { DataSource, DataSourceState, Reading } from './types';
import { parseCsv } from '../lib/csv';

export type CsvReplayOptions = {
  csvModule: number;          // require('../../assets/hvac_sensor_data.csv') -> module id
  tickMs?: number;            // simulated 5-min step in wall ms (default 200)
  startTs?: number;           // start simulation at this ts (epoch ms)
};

export class CsvReplayDataSource implements DataSource {
  readonly id = 'csv-replay';
  state: DataSourceState = 'idle';

  private readonly opts: Required<Pick<CsvReplayOptions, 'tickMs'>> & CsvReplayOptions;
  private readings: Reading[] = [];
  private cursor = 0; // next index to emit
  private simTs: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(r: Reading) => void>();
  private loaded = false;

  constructor(opts: CsvReplayOptions) {
    this.opts = { tickMs: 200, ...opts };
  }

  async start(): Promise<void> {
    if (!this.loaded) await this.load();
    if (this.opts.startTs !== undefined) {
      // Skip ahead to first reading at-or-after startTs.
      while (this.cursor < this.readings.length && this.readings[this.cursor].ts < this.opts.startTs) {
        this.cursor++;
      }
      this.simTs = this.opts.startTs;
    } else if (this.readings.length > 0) {
      this.simTs = this.readings[0].ts - 5 * 60_000; // start just before first reading
    }
    this.state = 'running';
    this.tick(); // emit immediately so screens aren't blank
    this.timer = setInterval(() => this.tick(), this.opts.tickMs);
  }

  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.state === 'running') this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.timer = setInterval(() => this.tick(), this.opts.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.cursor = 0;
    this.simTs = null;
    this.state = 'idle';
  }

  subscribe(listener: (r: Reading) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSpeed(tickMs: number): void {
    this.opts.tickMs = Math.max(20, tickMs);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), this.opts.tickMs);
    }
  }

  seekTo(ts: number): void {
    this.cursor = 0;
    while (this.cursor < this.readings.length && this.readings[this.cursor].ts < ts) {
      this.cursor++;
    }
    this.simTs = ts;
  }

  getSimTime(): number | null {
    return this.simTs;
  }

  getTickMs(): number {
    return this.opts.tickMs;
  }

  private async load(): Promise<void> {
    try {
      const asset = Asset.fromModule(this.opts.csvModule);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      // expo-file-system v56 dropped the function-based readAsStringAsync in
      // favor of a File class. Two fallbacks for safety:
      //   1. File.text() — the canonical new API
      //   2. fetch(uri).text() — works on any file:// URI on Android, useful
      //      if the File class chokes on the bundle:// scheme some assets use
      let text: string;
      try {
        text = await new File(uri).text();
      } catch (e1) {
        try {
          const res = await fetch(uri);
          text = await res.text();
        } catch (e2) {
          // Surface both so the caller can diagnose.
          throw new Error(`Failed to read CSV at ${uri}: File.text() → ${e1}; fetch → ${e2}`);
        }
      }
      const all = parseCsv(text);
      all.sort((a, b) => a.ts - b.ts);
      this.readings = all;
      this.loaded = true;
    } catch (e) {
      this.state = 'error';
      throw e;
    }
  }

  private tick(): void {
    if (this.readings.length === 0) return;
    // Advance sim clock by 5 minutes. Emit all readings up to the new simTs.
    if (this.simTs === null) this.simTs = this.readings[0].ts;
    else this.simTs += 5 * 60_000;

    while (this.cursor < this.readings.length && this.readings[this.cursor].ts <= this.simTs) {
      const r = this.readings[this.cursor];
      for (const l of this.listeners) {
        try { l(r); } catch { /* never let one listener kill the loop */ }
      }
      this.cursor++;
    }

    if (this.cursor >= this.readings.length) {
      this.state = 'ended';
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }
}
