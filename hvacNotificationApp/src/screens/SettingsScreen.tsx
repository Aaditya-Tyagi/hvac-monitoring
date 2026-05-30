import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useConfigStore, getEffectiveSensitivity, getEffectiveNotifLevel } from '../store/configStore';
import { useAlertsStore } from '../store/alertsStore';
import { SensitivitySelector } from '../components/SensitivitySelector';
import type { NotifLevel } from '../config/defaults';
import { useFleetStore } from '../store/fleetStore';

const NOTIF_OPTIONS: { value: NotifLevel; label: string; desc: string }[] = [
  { value: 'off', label: 'Off', desc: 'No notifications' },
  { value: 'act', label: 'ACT only', desc: 'Notify only for critical alerts' },
  { value: 'watch+act', label: 'WATCH + ACT', desc: 'Notify for any alert' },
];

export function SettingsScreen() {
  const cfg = useConfigStore((s) => s.config);
  const setNotifLevel = useConfigStore((s) => s.setNotifLevel);
  const setGlobalSensitivity = useConfigStore((s) => s.setGlobalSensitivity);
  const setUnitOverride = useConfigStore((s) => s.setUnitOverride);
  const clearUnitOverride = useConfigStore((s) => s.clearUnitOverride);
  const resetConfig = useConfigStore((s) => s.reset);
  const clearAlerts = useAlertsStore((s) => s.clear);
  const unitOrder = useFleetStore((s) => s.unitOrder);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg }}>
          Settings
        </Text>

        {/* Notification level */}
        <SectionTitle>Notifications</SectionTitle>
        <View style={card()}>
          {NOTIF_OPTIONS.map((o, i) => (
            <Pressable
              key={o.value}
              onPress={() => setNotifLevel(o.value)}
              android_ripple={{ color: colors.bgPressed }}
              style={{
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.divider,
                minHeight: tap.min,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>{o.label}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
                  {o.desc}
                </Text>
              </View>
              <Radio selected={cfg.notifications.level === o.value} />
            </Pressable>
          ))}
        </View>

        <SectionLabel>
          Quiet hours: {cfg.notifications.quietHours[0]} – {cfg.notifications.quietHours[1]} (wall clock)
        </SectionLabel>

        {/* Global sensitivity */}
        <SectionTitle>Detection sensitivity</SectionTitle>
        <View style={{ marginBottom: spacing.sm }}>
          <SensitivitySelector value={cfg.sensitivity} onChange={setGlobalSensitivity} />
        </View>
        <SectionLabel>
          Lower sensitivity → fewer alerts but slower to catch slow drifts. Higher sensitivity → more alerts.
        </SectionLabel>

        {/* Per-unit overrides */}
        {unitOrder.length > 0 ? (
          <>
            <SectionTitle>Per-unit overrides</SectionTitle>
            <View style={card()}>
              {unitOrder.map((unitId, i) => {
                const override = cfg.notifications.perUnit[unitId];
                const effLevel = getEffectiveNotifLevel(cfg, unitId);
                const effSens = getEffectiveSensitivity(cfg, unitId);
                return (
                  <View
                    key={unitId}
                    style={{
                      paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.divider,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>{unitId}</Text>
                      {override ? (
                        <Pressable
                          onPress={() => clearUnitOverride(unitId)}
                          style={{ paddingHorizontal: spacing.sm, paddingVertical: 4 }}
                        >
                          <Text style={{ ...typography.caption, color: colors.accent }}>Reset</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
                      Notif: {effLevel} · Sensitivity: {effSens}
                      {override ? ' (override)' : ''}
                    </Text>
                    <View style={{ marginTop: spacing.sm }}>
                      <SensitivitySelector
                        value={effSens}
                        onChange={(s) => setUnitOverride(unitId, { sensitivity: s })}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Danger zone */}
        <SectionTitle>Danger zone</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm as any }}>
          <DangerButton label="Reset config" onPress={resetConfig} />
          <DangerButton label="Clear history" onPress={clearAlerts} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        ...typography.micro,
        color: colors.textSecondary,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.sm }}>
      {children}
    </Text>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
      ) : null}
    </View>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tap.min,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.actBorder,
        backgroundColor: pressed ? colors.actBg : 'transparent',
      })}
    >
      <Text style={{ ...typography.bodyStrong, color: colors.act }}>{label}</Text>
    </Pressable>
  );
}

const card = () => ({
  backgroundColor: colors.bgCard,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: spacing.md,
});
