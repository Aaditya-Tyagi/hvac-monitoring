// A single sensor reading from one unit at one timestamp.
// `null` for a sensor means the value is missing in this reading; the engine
// must exclude it from scoring (not treat it as zero, not treat it as anomalous).
export type Reading = {
  ts: number; // epoch milliseconds
  unitId: string;
  temp: number | null;
  pressure: number;
  airflow: number | null;
  vibration: number;
  power: number;
};

export type SensorKey = 'temp' | 'pressure' | 'airflow' | 'vibration' | 'power';
export const SENSOR_KEYS: readonly SensorKey[] = ['temp', 'pressure', 'airflow', 'vibration', 'power'] as const;

export type DataSourceState = 'idle' | 'running' | 'paused' | 'ended' | 'error';

export interface DataSource {
  readonly id: string;
  readonly state: DataSourceState;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  // Returns unsubscribe fn.
  subscribe(listener: (r: Reading) => void): () => void;
  // Optional, for replay only:
  setSpeed?(tickMs: number): void;
  seekTo?(ts: number): void;
  // Optional, for replay only — what the simulation's current timestamp is.
  getSimTime?(): number | null;
}

// Per-unit static information used as priors in detection scoring.
// Demo bundles this in unit_metadata.json; production reads from server.
export type Area = 'cleanroom' | 'warehouse' | 'production_floor' | 'rooftop';

export type UnitMetadata = {
  unitId: string;
  installDate: string; // ISO date
  area: Area;
  lastServiceDate: string; // ISO date
  serviceIntervalDays: number;
  nominalCapacity: number;
};
