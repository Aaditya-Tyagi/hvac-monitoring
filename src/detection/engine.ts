// Two-track anomaly classifier for HVAC sensor readings.
//
// Why two tracks (gradual + acute)? The dataset contains two distinct failure
// modes that a single approach would miss:
//
//   1. HVAC_1: vibration drifts gradually from 0.020 to 0.129 over hours.
//      A purely "current reading" classifier sees each individual reading as
//      only mildly elevated and never fires. Persistence + correlation across
//      multiple sensors over multiple readings catches it.
//
//   2. HVAC_2 (row 51): a single reading shows temp 37°C, airflow 120, vibration
//      0.22 — all three wildly off — and the very next reading is normal again.
//      A persistence-based classifier filters it out as noise. We MUST fire on
//      one reading if multiple sensors are simultaneously extreme.
//
// So the final confidence = max(gradual_track, acute_track), and an explicit
// "hard override" forces ACT when ≥ N sensors exceed σTrip on peer-z in the
// same reading. Both protections layered.
//
// The engine is pure: same input → same output, no RN imports, no globals.
// State (ring buffers, persistence counters, cold-start baselines) is passed
// in / returned out.

import type { Reading, SensorKey, UnitMetadata } from '../datasource/types';
import { SENSOR_KEYS } from '../datasource/types';
import type { DetectionConfig } from '../config/defaults';
import { clamp, clamp01, mad, mean, median, safeZ, std } from './stats';

export type Status = 'OK' | 'WATCH' | 'ACT' | 'UNKNOWN';

export type ContributingSensor = {
  sensor: SensorKey;
  value: number;
  baselineZ: number;
  peerZ: number;
  score: number; // 0..1
};

export type DetectionResult = {
  unitId: string;
  ts: number;
  status: Status;
  confidence: number; // 0..1
  // Track contributions, in descending |score|. Engine consumers can show
  // these directly (UnitDetail) or summarise them (reasons.ts).
  contributing: ContributingSensor[];
  // For UI explanation:
  reasonCodes: ReasonCode[];
  // Diagnostic — useful when explaining what fired:
  gradualConfidence: number;
  acuteConfidence: number;
  hardOverride: boolean;
  persistenceFactor: number;
  missingSensors: SensorKey[];
};

export type ReasonCode =
  | 'cold_start'
  | 'missing_data'
  | 'hard_override'
  | 'multi_signal_correlation'
  | 'sustained_drift'
  | 'peer_deviation'
  | 'baseline_deviation'
  | 'service_overdue_prior';

// Per-unit baseline (frozen after cold-start) and short-term scoring history.
export type UnitState = {
  // baseline established from the first N readings; null per-sensor if all
  // cold-start readings were missing.
  baseline: Record<SensorKey, { mean: number; std: number } | null>;
  baselineReady: boolean;          // true after `coldStartReadings` accumulated
  coldStartCount: number;
  // last-K severity samples so gradual confidence sees a smoothed signal
  severityHistory: number[];
  peerSeverityHistory: number[];
  // count of consecutive readings with severity > 0.4
  consecutiveAnomalous: number;
  // Per-sensor recent-hot ring — captures which sensors were hot (sensor_score
  // > 0.5) in the last N readings. A real system fault touches MULTIPLE
  // sensors over a window; a sustained single-sensor anomaly is a sensor
  // problem, not a system fault, and should NOT escalate to WATCH/ACT alone.
  recentHotPerSensor: Record<SensorKey, number>; // count over last HOT_WINDOW readings
  recentHotRing: SensorKey[][]; // last HOT_WINDOW entries, each = sensors hot this reading
};

const HOT_WINDOW = 10;

export function makeUnitState(): UnitState {
  const emptyBaseline: Record<SensorKey, null> = {
    temp: null, pressure: null, airflow: null, vibration: null, power: null,
  };
  const emptyHot: Record<SensorKey, number> = {
    temp: 0, pressure: 0, airflow: 0, vibration: 0, power: 0,
  };
  return {
    baseline: { ...emptyBaseline },
    baselineReady: false,
    coldStartCount: 0,
    severityHistory: [],
    peerSeverityHistory: [],
    consecutiveAnomalous: 0,
    recentHotPerSensor: { ...emptyHot },
    recentHotRing: [],
  };
}

// Get the value of a sensor on a reading (may be null).
function getSensor(r: Reading, s: SensorKey): number | null {
  return r[s] as number | null;
}

// Build (or finish building) a per-unit cold-start baseline from the window so
// far. We freeze the baseline as soon as we have `coldStartReadings`
// non-null observations per sensor. While building, the unit's status is UNKNOWN.
function updateBaseline(
  state: UnitState,
  window: readonly Reading[],
  cfg: DetectionConfig,
): void {
  state.coldStartCount = Math.min(window.length, cfg.coldStartReadings);
  if (state.baselineReady) return;
  if (window.length < cfg.coldStartReadings) return;

  const cs = window.slice(0, cfg.coldStartReadings);
  for (const s of SENSOR_KEYS) {
    const xs: number[] = [];
    for (const r of cs) {
      const v = getSensor(r, s);
      if (v !== null && Number.isFinite(v)) xs.push(v);
    }
    if (xs.length >= 5) {
      const m = mean(xs);
      const sd = std(xs, m);
      state.baseline[s] = { mean: m, std: sd };
    } else {
      state.baseline[s] = null; // too many NAs during cold start
    }
  }
  state.baselineReady = true;
}

// Compute robust peer center & spread for a sensor from the latest peer reading
// of each OTHER unit, ignoring NA. Returns null if too few peers.
function peerCenterSpread(
  peers: readonly Reading[],
  s: SensorKey,
): { center: number; spread: number } | null {
  const xs: number[] = [];
  for (const r of peers) {
    const v = getSensor(r, s);
    if (v !== null && Number.isFinite(v)) xs.push(v);
  }
  if (xs.length < 2) return null;
  return { center: median(xs), spread: mad(xs) };
}

// Days since lastServiceDate. If metadata absent, returns 0.
function daysSinceService(meta: UnitMetadata | undefined, nowMs: number): number {
  if (!meta?.lastServiceDate) return 0;
  const ms = nowMs - new Date(meta.lastServiceDate).getTime();
  return ms / 86400000;
}

// Area-specific floor_std override. Production floor lives near machinery — its
// baseline vibration is genuinely higher, so we relax the floor to avoid false
// positives.
function effectiveFloorStd(
  s: SensorKey,
  meta: UnitMetadata | undefined,
  cfg: DetectionConfig,
): number {
  const base = cfg.floorStd[s];
  if (!meta) return base;
  if (s === 'vibration' && meta.area === 'production_floor') return Math.max(base, 0.010);
  if (s === 'temp' && meta.area === 'rooftop') return Math.max(base, 0.5); // outdoor swings
  return base;
}

export type EvaluateInput = {
  unitId: string;
  window: readonly Reading[];     // chronological, last N readings INCLUDING current
  peers: readonly Reading[];       // latest reading for each OTHER unit
  metadata?: UnitMetadata;
  config: DetectionConfig;
  state: UnitState;                // mutated in place
};

const HISTORY_DEPTH = 5;

export function evaluate(input: EvaluateInput): DetectionResult {
  const { unitId, window, peers, metadata, config, state } = input;

  const empty: DetectionResult = {
    unitId,
    ts: 0,
    status: 'UNKNOWN',
    confidence: 0,
    contributing: [],
    reasonCodes: [],
    gradualConfidence: 0,
    acuteConfidence: 0,
    hardOverride: false,
    persistenceFactor: 0,
    missingSensors: [],
  };
  if (window.length === 0) return empty;

  const current = window[window.length - 1];
  empty.ts = current.ts;

  // Cold-start: keep returning UNKNOWN until we've established a baseline.
  updateBaseline(state, window, config);
  if (!state.baselineReady) {
    return { ...empty, reasonCodes: ['cold_start'] };
  }

  // Score each sensor present in the current reading.
  const missing: SensorKey[] = [];
  const contributing: ContributingSensor[] = [];
  let hotSignals = 0;
  let severity = 0;
  const sigmaTripHits: SensorKey[] = [];
  const hotSensorsThisReading: SensorKey[] = [];

  for (const s of SENSOR_KEYS) {
    const v = getSensor(current, s);
    if (v === null || !Number.isFinite(v)) {
      missing.push(s);
      continue;
    }
    const baseline = state.baseline[s];
    const floor = effectiveFloorStd(s, metadata, config);

    const bz = baseline
      ? safeZ(v, baseline.mean, baseline.std, floor)
      : 0;

    const peer = peerCenterSpread(peers, s);
    const pz = peer ? safeZ(v, peer.center, peer.spread, floor) : 0;

    // sensor_score uses absolute magnitude, divided by 5 so:
    //   z=2 → 0.40 (mildly anomalous)
    //   z=3 → 0.60 (anomalous)
    //   z=4 → 0.80 (very anomalous; also hard-override territory)
    //   z=5+ → 1.00 (saturated)
    // /3.0 saturates too aggressively — a single noisy reading at z=3 would
    // already push severity to 1.0 and trip ACT on its own.
    const sz = clamp01(Math.max(Math.abs(bz), Math.abs(pz)) / 5.0);

    contributing.push({ sensor: s, value: v, baselineZ: bz, peerZ: pz, score: sz });

    if (sz > severity) severity = sz;
    if (sz > 0.5) {
      hotSignals++;
      hotSensorsThisReading.push(s);
    }

    if (Math.abs(pz) >= config.hardOverride.sigmaTrip) sigmaTripHits.push(s);
  }

  // Update sensor-diversity ring. We track which sensors have been "hot" over
  // the last HOT_WINDOW readings; needed below to gate WATCH escalation on
  // multi-sensor involvement.
  state.recentHotRing.push(hotSensorsThisReading);
  if (state.recentHotRing.length > HOT_WINDOW) {
    const dropped = state.recentHotRing.shift()!;
    for (const s of dropped) state.recentHotPerSensor[s]--;
  }
  for (const s of hotSensorsThisReading) state.recentHotPerSensor[s]++;
  // Diversity = how many distinct sensors have been hot at any point recently.
  let hotSensorDiversity = 0;
  for (const k of SENSOR_KEYS) if (state.recentHotPerSensor[k] > 0) hotSensorDiversity++;

  // Sort contributing sensors loud-first; UI consumes this top-down.
  contributing.sort((a, b) => b.score - a.score);

  // If too few sensors are scorable, surface UNKNOWN.
  const scored = SENSOR_KEYS.length - missing.length;
  if (scored < 3) {
    return {
      ...empty,
      status: 'UNKNOWN',
      missingSensors: missing,
      reasonCodes: ['missing_data'],
    };
  }

  // Correlation boost: a single sensor screaming is suspicious; two or three at
  // once is a story. This is what separates real failure patterns from noise.
  let correlationBoost = 0;
  if (hotSignals >= 3) correlationBoost = 0.30;
  else if (hotSignals === 2) correlationBoost = 0.15;

  // Persistence: track consecutive anomalous readings (severity > 0.4) so a
  // single mild blip doesn't escalate. Resets when calm.
  if (severity > 0.4) state.consecutiveAnomalous += 1;
  else if (severity < 0.3) state.consecutiveAnomalous = 0;

  const persistenceFactor = clamp01(
    state.consecutiveAnomalous / config.persistenceReadings,
  );

  // Maintain short severity history for smoothed gradual track.
  state.severityHistory.push(severity);
  if (state.severityHistory.length > HISTORY_DEPTH) state.severityHistory.shift();
  const severityAvg = mean(state.severityHistory);

  // peerSeverity isolates the "deviation from peers" signal so we don't
  // double-count baseline contributions in the smoothed average.
  let peerSeverityNow = 0;
  for (const c of contributing) {
    const p = clamp01(Math.abs(c.peerZ) / 5.0);
    if (p > peerSeverityNow) peerSeverityNow = p;
  }
  state.peerSeverityHistory.push(peerSeverityNow);
  if (state.peerSeverityHistory.length > HISTORY_DEPTH) state.peerSeverityHistory.shift();
  const peerSeverityAvg = mean(state.peerSeverityHistory);

  // GRADUAL TRACK — weighted sum, with correlation_boost added directly (it's
  // already a small additive bump 0..0.30, not a 0..1 signal).
  const w = config.weights;
  let gradualConfidence = clamp01(
    w.severityAvg * severityAvg
      + w.peerSeverityAvg * peerSeverityAvg
      + correlationBoost
      + w.persistence * persistenceFactor,
  );

  // Metadata prior: a unit overdue for service gets up to +0.10 bump on the
  // gradual track. Never enough to trip ACT on its own.
  if (metadata) {
    const dss = daysSinceService(metadata, current.ts);
    const overdueFactor = clamp((dss - metadata.serviceIntervalDays) / 30, 0, 1);
    if (overdueFactor > 0) {
      gradualConfidence = clamp01(gradualConfidence + 0.10 * overdueFactor);
    }
  }

  // HARD OVERRIDE: if multiple sensors are simultaneously > σTrip from peer
  // median, this is the HVAC_2 case. Force ACT regardless of persistence.
  // Computed early so it can bypass acute-track dampening below.
  const hardOverride = sigmaTripHits.length >= config.hardOverride.sensorsRequired;

  // ACUTE TRACK: respond to a single reading where MULTIPLE sensors are
  // extreme simultaneously. A single sensor at z=4 alone is suspicious but
  // ambiguous (sensor glitch? real fault? noise?) → cap at WATCH-grade.
  //
  // The 0.75 multiplier means a saturated single-sensor anomaly tops out at
  // 0.75 (WATCH territory); only correlation across signals pushes into ACT.
  //
  // Additionally we damp the FIRST reading of any anomaly run: a one-off
  // outlier (sensor glitch, deceptive noise from the brief) shouldn't even
  // trigger WATCH on its own. We require the next reading to confirm.
  // Hard override bypasses dampening — a genuine 2+ sensor extreme event
  // (HVAC_2 row 51) deserves immediate ACT.
  const acuteRaw = 0.75 * severity + correlationBoost;
  const needsConfirmation = !hardOverride && state.consecutiveAnomalous < 2;
  const acuteConfidence = clamp01(needsConfirmation ? acuteRaw * 0.55 : acuteRaw);

  const confidence = clamp01(Math.max(gradualConfidence, acuteConfidence));

  // System-fault discipline: a real HVAC fault touches MULTIPLE sensors over
  // its lifetime. A sustained single-sensor drift (HVAC_3's pressure
  // transducer in the test data) is a SENSOR anomaly, not a system anomaly,
  // and shouldn't escalate to WATCH/ACT on its own. Hard override always
  // overrides this — a 2+ sensor extreme event is multi-sensor by definition.
  const singleSensorOnly = hotSensorDiversity <= 1 && !hardOverride;

  let status: Status;
  if (hardOverride) status = 'ACT';
  else if (singleSensorOnly) status = 'OK';
  else if (confidence >= config.thresholds.act) status = 'ACT';
  else if (confidence >= config.thresholds.watch) status = 'WATCH';
  else status = 'OK';

  // Reason codes, in priority order. UI may render the first 1–3.
  const reasonCodes: ReasonCode[] = [];
  if (hardOverride) reasonCodes.push('hard_override');
  if (correlationBoost > 0) reasonCodes.push('multi_signal_correlation');
  if (persistenceFactor >= 0.6) reasonCodes.push('sustained_drift');
  if (peerSeverityNow >= 0.7) reasonCodes.push('peer_deviation');
  const topBaselineZ = contributing.length > 0 ? Math.abs(contributing[0].baselineZ) : 0;
  if (topBaselineZ >= 2.5) reasonCodes.push('baseline_deviation');
  if (missing.length > 0) reasonCodes.push('missing_data');
  if (metadata) {
    const dss = daysSinceService(metadata, current.ts);
    if (dss > metadata.serviceIntervalDays + 30) reasonCodes.push('service_overdue_prior');
  }

  return {
    unitId,
    ts: current.ts,
    status,
    confidence,
    contributing,
    reasonCodes,
    gradualConfidence,
    acuteConfidence,
    hardOverride,
    persistenceFactor,
    missingSensors: missing,
  };
}
