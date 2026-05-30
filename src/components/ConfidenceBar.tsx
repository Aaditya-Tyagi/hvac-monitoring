import React from 'react';
import { View, Text } from 'react-native';
import { colors, severityPalette } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Status } from '../detection/engine';

export function ConfidenceBar({
  confidence,
  status,
}: {
  confidence: number;
  status: Status;
}) {
  const pct = Math.round(confidence * 100);
  const key = status === 'OK' ? 'ok' : status === 'WATCH' ? 'watch' : status === 'ACT' ? 'act' : 'unknown';
  const p = severityPalette(key as any);
  return (
    <View style={{ width: '100%' }}>
      <View
        style={{
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: colors.bgPressed,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: p.fg,
          }}
        />
      </View>
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
        {pct}% confidence
      </Text>
    </View>
  );
}
