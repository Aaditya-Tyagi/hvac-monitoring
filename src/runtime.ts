// Boots and owns the data-flow pipeline:
//   DataSource ─▶ RingBuffer ─▶ evaluate() ─▶ FleetStore + AlertsStore + NotificationService
//
// The runtime is a singleton — app-wide. UI components subscribe to stores; they
// never talk to the engine directly. This is the seam where on-device runtime
// can be swapped for server-side detection (replace DataSource with a stream of
// pre-classified DetectionResults; the rest of the pipeline collapses).

import type { Reading, UnitMetadata } from './datasource/types';
import type { DataSource } from './datasource/types';
import { RingBuffer } from './detection/ringBuffer';
import { evaluate, makeUnitState, type DetectionResult, type UnitState } from './detection/engine';
import { useFleetStore } from './store/fleetStore';
import { useAlertsStore, type Alert } from './store/alertsStore';
import { useConfigStore, getEffectiveSensitivity } from './store/configStore';
import { SENSITIVITY_THRESHOLDS } from './config/defaults';
import { headline, bullets } from './detection/reasons';
import { notificationService } from './notifications/service';

const ringBuffer = new RingBuffer(60);
const states: Record<string, UnitState> = {};
let metadataMap: Record<string, UnitMetadata> = {};
let currentDataSource: DataSource | null = null;
let unsubscribe: (() => void) | null = null;

export function setMetadata(map: Record<string, UnitMetadata>): void {
  metadataMap = map;
}

export function attachDataSource(ds: DataSource): void {
  detachDataSource();
  currentDataSource = ds;
  unsubscribe = ds.subscribe(handleReading);
}

export function detachDataSource(): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  currentDataSource = null;
}

export function resetRuntimeState(): void {
  ringBuffer.reset();
  for (const k of Object.keys(states)) delete states[k];
  useFleetStore.getState().reset();
  notificationService.resetSession();
}

export function currentSimTime(): number | null {
  return currentDataSource?.getSimTime?.() ?? null;
}

export function getDataSource() {
  return currentDataSource;
}

// Restart the replay from the start, clearing all in-flight state.
export async function restartReplay(): Promise<void> {
  if (!currentDataSource) return;
  currentDataSource.stop();
  resetRuntimeState();
  for (const k of Object.keys(lastStatusByUnit)) delete lastStatusByUnit[k];
  await currentDataSource.start();
}

function handleReading(reading: Reading): void {
  ringBuffer.push(reading);
  if (!states[reading.unitId]) states[reading.unitId] = makeUnitState();

  // Apply current effective sensitivity per unit to thresholds before evaluate.
  const cfg = useConfigStore.getState().config;
  const sensitivity = getEffectiveSensitivity(cfg, reading.unitId);
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];

  const result = evaluate({
    unitId: reading.unitId,
    window: ringBuffer.windowFor(reading.unitId, 60),
    peers: ringBuffer.latestPeers(reading.unitId),
    metadata: metadataMap[reading.unitId],
    config: { ...cfg.detection, thresholds },
    state: states[reading.unitId],
  });

  const simTime = currentDataSource?.getSimTime?.() ?? null;
  useFleetStore.getState().upsert(reading, result, simTime);

  maybeLogAndNotify(reading, result, simTime);
}

// Track per-unit last-status so we only log/notify on actual transitions.
const lastStatusByUnit: Record<string, string> = {};

function maybeLogAndNotify(reading: Reading, result: DetectionResult, simTime: number | null): void {
  const prev = lastStatusByUnit[reading.unitId];
  lastStatusByUnit[reading.unitId] = result.status;

  // Log alert on entering WATCH or ACT (or escalating WATCH → ACT).
  const entersWatch = (prev !== 'WATCH' && prev !== 'ACT') && result.status === 'WATCH';
  const entersAct = prev !== 'ACT' && result.status === 'ACT';

  if (entersWatch || entersAct) {
    const alert: Alert = {
      id: `${reading.unitId}-${reading.ts}-${result.status}`,
      unitId: reading.unitId,
      ts: result.ts,
      createdAtWall: Date.now(),
      status: result.status as Exclude<typeof result.status, 'OK'>,
      confidence: result.confidence,
      reasonHeadline: headline(result),
      reasonBullets: bullets(result),
      acknowledged: false,
    };
    useAlertsStore.getState().add(alert);
    notificationService.maybeFire(alert, simTime ?? Date.now());
  }
}
