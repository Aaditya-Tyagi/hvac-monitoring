import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import { StatusPill } from './StatusPill';
import { headline } from '../detection/reasons';
import type { DetectionResult, Status } from '../detection/engine';
import { fmtSimTime } from '../lib/time';

type Props = {
  unitId: string;
  detection: DetectionResult | null;
  lastSimTs: number | null;
  onPress: () => void;
};

export function UnitCard({ unitId, detection, lastSimTs, onPress }: Props) {
  const status: Status = detection?.status ?? 'UNKNOWN';
  const conf = detection?.confidence ?? 0;
  const accent =
    status === 'ACT' ? colors.act
    : status === 'WATCH' ? colors.watch
    : status === 'OK' ? colors.ok
    : colors.unknown;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={({ pressed }) => ({
        minHeight: tap.action + spacing.lg,
        backgroundColor: pressed ? colors.bgPressed : colors.bgCard,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: status === 'ACT' || status === 'WATCH' ? accent + '55' : colors.border,
      })}
    >
      {/* Severity accent stripe at left */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: accent,
          borderTopLeftRadius: radius.lg,
          borderBottomLeftRadius: radius.lg,
        }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.h2, color: colors.textPrimary }}>{unitId}</Text>
        <StatusPill status={status} />
      </View>

      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
        {detection ? headline(detection) : 'No data yet'}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.md,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {Math.round(conf * 100)}% confidence
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          sim {fmtSimTime(lastSimTs)}
        </Text>
      </View>
    </Pressable>
  );
}
