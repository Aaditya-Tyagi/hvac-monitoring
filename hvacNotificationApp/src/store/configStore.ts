// User config, persisted via MMKV. Editable from Settings; hot-read by the
// detection runtime on every evaluation (no app restart needed for config
// changes to take effect).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkv';
import {
  DEFAULT_CONFIG,
  SENSITIVITY_THRESHOLDS,
  type AppConfig,
  type Sensitivity,
  type NotifLevel,
} from '../config/defaults';

type ConfigState = {
  config: AppConfig;
  setNotifLevel: (level: NotifLevel) => void;
  setQuietHours: (start: string, end: string) => void;
  setGlobalSensitivity: (s: Sensitivity) => void;
  setUnitOverride: (unitId: string, override: { level?: NotifLevel; sensitivity?: Sensitivity }) => void;
  clearUnitOverride: (unitId: string) => void;
  reset: () => void;
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      setNotifLevel: (level) =>
        set((s) => ({
          config: {
            ...s.config,
            notifications: { ...s.config.notifications, level },
          },
        })),
      setQuietHours: (start, end) =>
        set((s) => ({
          config: {
            ...s.config,
            notifications: { ...s.config.notifications, quietHours: [start, end] },
          },
        })),
      setGlobalSensitivity: (sensitivity) =>
        set((s) => ({
          config: {
            ...s.config,
            sensitivity,
            detection: { ...s.config.detection, thresholds: SENSITIVITY_THRESHOLDS[sensitivity] },
          },
        })),
      setUnitOverride: (unitId, override) =>
        set((s) => ({
          config: {
            ...s.config,
            notifications: {
              ...s.config.notifications,
              perUnit: { ...s.config.notifications.perUnit, [unitId]: { ...(s.config.notifications.perUnit[unitId] ?? {}), ...override } },
            },
          },
        })),
      clearUnitOverride: (unitId) =>
        set((s) => {
          const { [unitId]: _drop, ...rest } = s.config.notifications.perUnit;
          return {
            config: {
              ...s.config,
              notifications: { ...s.config.notifications, perUnit: rest },
            },
          };
        }),
      reset: () => set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: 'config-v1',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// Effective per-unit sensitivity (override falls back to global).
export const getEffectiveSensitivity = (
  cfg: AppConfig,
  unitId: string,
): Sensitivity => cfg.notifications.perUnit[unitId]?.sensitivity ?? cfg.sensitivity;

// Effective per-unit notification level.
export const getEffectiveNotifLevel = (
  cfg: AppConfig,
  unitId: string,
): NotifLevel => cfg.notifications.perUnit[unitId]?.level ?? cfg.notifications.level;
