import type { SensorKey } from '../datasource/types';

export type Sensitivity = 'low' | 'med' | 'high';
export type NotifLevel = 'off' | 'act' | 'watch+act';

export type DetectionConfig = {
  coldStartReadings: number;
  windowReadings: number;
  persistenceReadings: number; // readings of sustained anomaly needed for max persistence_factor
  weights: {
    severityAvg: number;
    peerSeverityAvg: number;
    correlationBoost: number;
    persistence: number;
  };
  thresholds: { watch: number; act: number };
  floorStd: Record<SensorKey, number>;
  hardOverride: {
    sensorsRequired: number; // ≥ this many sensors simultaneously > σTrip → ACT
    sigmaTrip: number;       // peer-z absolute magnitude threshold
  };
};

export type NotificationsConfig = {
  level: NotifLevel;
  quietHours: [string, string]; // wall-clock "HH:mm"
  cooldownMin: number;          // sim-time minutes
  perUnit: Record<string, { level?: NotifLevel; sensitivity?: Sensitivity }>;
};

export type AppConfig = {
  detection: DetectionConfig;
  notifications: NotificationsConfig;
  sensitivity: Sensitivity;
};

// Sensitivity adjusts thresholds, not weights — easier to reason about.
export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, { watch: number; act: number }> = {
  low: { watch: 0.65, act: 0.88 },
  med: { watch: 0.55, act: 0.80 },
  high: { watch: 0.45, act: 0.72 },
};

// Mandatory minimum stds. Without these, a quiet sensor produces ∞ z-scores
// on tiny fluctuations and the system fires false alarms on noise. These also
// guard against the "peer MAD collapses to 0" case when 3 of 4 peers are
// identical and one is an outlier.
//
// Values calibrated from the dataset's healthy units (HVAC_3/4/5) with a
// safety margin — floor must be >= the actual healthy intra-unit std plus a
// margin, OR z-scores will saturate on noise.
export const DEFAULT_FLOOR_STD: Record<SensorKey, number> = {
  temp: 0.5,
  pressure: 0.07,
  airflow: 8,
  vibration: 0.008,
  power: 0.3,
};

export const DEFAULT_CONFIG: AppConfig = {
  detection: {
    coldStartReadings: 24,
    windowReadings: 60,
    persistenceReadings: 5,
    weights: {
      severityAvg: 0.35,
      peerSeverityAvg: 0.35,
      correlationBoost: 0.20,
      persistence: 0.10,
    },
    thresholds: SENSITIVITY_THRESHOLDS.med,
    floorStd: DEFAULT_FLOOR_STD,
    hardOverride: { sensorsRequired: 2, sigmaTrip: 4.0 },
  },
  notifications: {
    level: 'act',
    quietHours: ['22:00', '06:00'],
    cooldownMin: 30,
    perUnit: {},
  },
  sensitivity: 'med',
};
