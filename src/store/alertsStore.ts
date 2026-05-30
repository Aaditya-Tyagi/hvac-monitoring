// Alert history + feedback for the trust loop. Persisted via MMKV.
//
// When the engine produces an ACT/WATCH status, we log an Alert. The user can
// mark alerts as "false alarm" — that feedback adjusts per-unit sensitivity
// (3 false-alarms in 24h drops the unit's sensitivity one step; 7 quiet days
// recovers).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkv';
import type { DetectionResult, Status } from '../detection/engine';
import { useConfigStore } from './configStore';
import type { Sensitivity } from '../config/defaults';

export type Alert = {
  id: string;
  unitId: string;
  ts: number;             // sim-time epoch ms when this alert fired
  createdAtWall: number;  // real wall-clock for time-since-feedback math
  status: Exclude<Status, 'OK'>;
  confidence: number;
  reasonHeadline: string;
  reasonBullets: string[];
  acknowledged: boolean;
  acknowledgedAtWall?: number;
  feedback?: 'true_positive' | 'false_alarm';
  feedbackAtWall?: number;
  note?: string;
};

type AlertsState = {
  alerts: Alert[]; // newest first
  add: (a: Alert) => void;
  ack: (id: string) => void;
  setFeedback: (id: string, fb: 'true_positive' | 'false_alarm') => void;
  setNote: (id: string, note: string) => void;
  clear: () => void;
};

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      add: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 500) })),
      ack: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, acknowledged: true, acknowledgedAtWall: Date.now() } : a,
          ),
        })),
      setFeedback: (id, fb) => {
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, feedback: fb, feedbackAtWall: Date.now() } : a,
          ),
        }));
        // Trust loop side-effect: false-alarm taps may step down sensitivity.
        if (fb === 'false_alarm') {
          const alert = get().alerts.find((a) => a.id === id);
          if (alert) maybeStepDownSensitivity(alert.unitId);
        }
      },
      setNote: (id, note) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, note } : a)),
        })),
      clear: () => set({ alerts: [] }),
    }),
    {
      name: 'alerts-v1',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// --- Trust loop ---------------------------------------------------------

// Step down a unit's sensitivity (med → low → off-via-low-still) after 3
// false-alarm taps in a 24h window. We never go below 'low'.
const SENSITIVITY_DOWN: Record<Sensitivity, Sensitivity> = {
  high: 'med',
  med: 'low',
  low: 'low',
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function maybeStepDownSensitivity(unitId: string) {
  const alerts = useAlertsStore.getState().alerts;
  const now = Date.now();
  const recentFalse = alerts.filter(
    (a) =>
      a.unitId === unitId &&
      a.feedback === 'false_alarm' &&
      a.feedbackAtWall !== undefined &&
      now - a.feedbackAtWall < ONE_DAY_MS,
  );
  if (recentFalse.length < 3) return;

  const cfgState = useConfigStore.getState();
  const current =
    cfgState.config.notifications.perUnit[unitId]?.sensitivity ?? cfgState.config.sensitivity;
  const next = SENSITIVITY_DOWN[current];
  if (next === current) return;
  cfgState.setUnitOverride(unitId, { sensitivity: next });
}

// Recovery: if a unit has had a per-unit sensitivity override AND no false
// alarms for 7 days, step it back up one. Called from a scheduled check or
// app-foreground hook.
const SENSITIVITY_UP: Record<Sensitivity, Sensitivity> = {
  low: 'med',
  med: 'high',
  high: 'high',
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function maybeRecoverSensitivities() {
  const cfgState = useConfigStore.getState();
  const alerts = useAlertsStore.getState().alerts;
  const now = Date.now();
  for (const unitId of Object.keys(cfgState.config.notifications.perUnit)) {
    const override = cfgState.config.notifications.perUnit[unitId];
    if (!override?.sensitivity) continue;
    const lastFalseAlarm = alerts.find(
      (a) => a.unitId === unitId && a.feedback === 'false_alarm' && a.feedbackAtWall,
    );
    const lastWall = lastFalseAlarm?.feedbackAtWall ?? 0;
    if (now - lastWall < SEVEN_DAYS_MS) continue;
    const next = SENSITIVITY_UP[override.sensitivity];
    if (next === override.sensitivity) continue;
    if (next === cfgState.config.sensitivity) cfgState.clearUnitOverride(unitId);
    else cfgState.setUnitOverride(unitId, { sensitivity: next });
  }
}
