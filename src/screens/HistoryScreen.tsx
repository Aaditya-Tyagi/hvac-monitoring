import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, severityPalette } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useAlertsStore, type Alert } from '../store/alertsStore';
import { StatusPill } from '../components/StatusPill';
import { fmtSimDate } from '../lib/time';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FleetStackParamList } from '../navigation/FleetStack';

type FilterMode = 'all' | 'open' | 'flagged';

export function HistoryScreen() {
  const alerts = useAlertsStore((s) => s.alerts);
  const setFeedback = useAlertsStore((s) => s.setFeedback);
  const ack = useAlertsStore((s) => s.ack);
  const navigation = useNavigation<NativeStackNavigationProp<FleetStackParamList>>();
  const [filter, setFilter] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    if (filter === 'open') return alerts.filter((a) => !a.acknowledged && !a.feedback);
    if (filter === 'flagged') return alerts.filter((a) => a.feedback === 'false_alarm');
    return alerts;
  }, [alerts, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Text style={{ ...typography.h1, color: colors.textPrimary }}>History</Text>
        <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm as any }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} count={alerts.length} />
          <Chip
            label="Open"
            active={filter === 'open'}
            onPress={() => setFilter('open')}
            count={alerts.filter((a) => !a.acknowledged && !a.feedback).length}
          />
          <Chip
            label="False alarms"
            active={filter === 'flagged'}
            onPress={() => setFilter('flagged')}
            count={alerts.filter((a) => a.feedback === 'false_alarm').length}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ ...typography.body, color: colors.textMuted }}>No alerts yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlertItem
            alert={item}
            onOpenUnit={() =>
              (navigation.getParent() as any)?.navigate('Fleet', { screen: 'UnitDetail', params: { unitId: item.unitId } })
            }
            onMarkFalse={() => setFeedback(item.id, 'false_alarm')}
            onMarkTrue={() => setFeedback(item.id, 'true_positive')}
            onAck={() => ack(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.accent : colors.bgCard,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ ...typography.caption, color: active ? colors.textPrimary : colors.textSecondary }}>
        {label} · {count}
      </Text>
    </Pressable>
  );
}

function AlertItem({
  alert,
  onOpenUnit,
  onMarkFalse,
  onMarkTrue,
  onAck,
}: {
  alert: Alert;
  onOpenUnit: () => void;
  onMarkFalse: () => void;
  onMarkTrue: () => void;
  onAck: () => void;
}) {
  const p = severityPalette(alert.status === 'ACT' ? 'act' : 'watch');
  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: p.border,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>{alert.unitId}</Text>
        <StatusPill status={alert.status} />
      </View>
      <Text style={{ ...typography.body, color: colors.textPrimary, marginTop: spacing.sm }}>
        {alert.reasonHeadline}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 4 }}>
        sim {fmtSimDate(alert.ts)} · {Math.round(alert.confidence * 100)}% confidence
      </Text>

      {alert.feedback ? (
        <Text style={{ ...typography.caption, color: alert.feedback === 'false_alarm' ? colors.watch : colors.ok, marginTop: spacing.sm }}>
          {alert.feedback === 'false_alarm' ? '🛈 Marked as false alarm — sensitivity will adjust.' : '✓ Marked as real issue.'}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm as any, marginTop: spacing.md }}>
          <SmallBtn label={alert.acknowledged ? 'Acked' : 'Acknowledge'} onPress={onAck} disabled={alert.acknowledged} />
          <SmallBtn label="False alarm" onPress={onMarkFalse} />
          <SmallBtn label="Real" onPress={onMarkTrue} />
          <SmallBtn label="Open" onPress={onOpenUnit} primary />
        </View>
      )}
    </View>
  );
}

function SmallBtn({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={({ pressed }) => ({
        minHeight: tap.min - 8,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: disabled
          ? colors.bgPressed
          : primary
            ? (pressed ? colors.accentPressed : colors.accent)
            : (pressed ? colors.bgPressed : 'transparent'),
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text
        style={{ ...typography.caption, color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
