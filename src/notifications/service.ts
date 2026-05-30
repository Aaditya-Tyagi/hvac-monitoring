// Local notifications via expo-notifications. Android-only target. Implements:
//   - permission request on first use
//   - notification channels (alerts-act, alerts-watch) required on Android 8+
//   - dedup (don't re-fire the same unit while it's still in the same state)
//   - quiet hours (wall-clock)
//   - cooldown (sim-time; consistent under fast replay)
//   - per-unit level overrides
//
// Tapping a notification deep-links into UnitDetail; that wiring is in
// RootNavigator (uses the lastNotificationResponse handler).

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Alert } from '../store/alertsStore';
import { useConfigStore, getEffectiveNotifLevel } from '../store/configStore';
import { isQuietNow } from '../lib/time';

let permissionsRequested = false;
let channelsCreated = false;

// Per-unit last-fire sim-time (ms), for cooldown enforcement.
const lastFireByUnit: Record<string, number> = {};

export const notificationService = {
  async setup(): Promise<void> {
    // Foreground handler — show banner + sound when app is open.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android' && !channelsCreated) {
      // Required on Android 8+: without channels, Android silently drops.
      await Notifications.setNotificationChannelAsync('alerts-act', {
        name: 'Act now',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#EF4444',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('alerts-watch', {
        name: 'Watch',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#F59E0B',
      });
      await Notifications.setNotificationChannelAsync('system', {
        name: 'System',
        importance: Notifications.AndroidImportance.LOW,
      });
      channelsCreated = true;
    }
  },

  async ensurePermissions(): Promise<boolean> {
    if (permissionsRequested) {
      const status = await Notifications.getPermissionsAsync();
      return status.granted;
    }
    permissionsRequested = true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  },

  resetSession(): void {
    for (const k of Object.keys(lastFireByUnit)) delete lastFireByUnit[k];
    // Best-effort: clear any pending scheduled notifications.
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  },

  async maybeFire(alert: Alert, simTime: number): Promise<void> {
    const cfg = useConfigStore.getState().config;
    const unitLevel = getEffectiveNotifLevel(cfg, alert.unitId);
    if (unitLevel === 'off') return;
    if (alert.status === 'WATCH' && unitLevel !== 'watch+act') return;
    // Quiet hours (wall clock — UX concern, not sim concern).
    const [qs, qe] = cfg.notifications.quietHours;
    if (isQuietNow(qs, qe)) return;

    // Cooldown — sim-time so it behaves consistently under fast replay.
    const last = lastFireByUnit[alert.unitId] ?? -Infinity;
    const cooldownMs = cfg.notifications.cooldownMin * 60_000;
    if (simTime - last < cooldownMs) return;

    const ok = await notificationService.ensurePermissions();
    if (!ok) return;

    const channel = alert.status === 'ACT' ? 'alerts-act' : 'alerts-watch';
    const title =
      alert.status === 'ACT'
        ? `${alert.unitId}: ACT — investigate now`
        : `${alert.unitId}: WATCH`;
    const body = alert.reasonBullets.slice(0, 2).join(' · ') || alert.reasonHeadline;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { unitId: alert.unitId, alertId: alert.id, status: alert.status },
        ...(Platform.OS === 'android' ? { channelId: channel } : {}),
      },
      trigger: null, // fire immediately
    });

    lastFireByUnit[alert.unitId] = simTime;
  },
};
