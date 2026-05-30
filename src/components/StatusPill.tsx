import React from 'react';
import { Text, View } from 'react-native';
import { colors, severityPalette } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Status } from '../detection/engine';

const LABEL: Record<Status, string> = {
  OK: 'OK',
  WATCH: 'WATCH',
  ACT: 'ACT NOW',
  UNKNOWN: 'UNKNOWN',
};

const PALETTE_KEY: Record<Status, 'ok' | 'watch' | 'act' | 'unknown'> = {
  OK: 'ok',
  WATCH: 'watch',
  ACT: 'act',
  UNKNOWN: 'unknown',
};

export function StatusPill({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' | 'lg' }) {
  const p = severityPalette(PALETTE_KEY[status]);
  const padH = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.lg : spacing.md;
  const padV = size === 'sm' ? 2 : size === 'lg' ? spacing.sm : 4;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 12;
  return (
    <View
      style={{
        backgroundColor: p.bg,
        borderColor: p.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: padH,
        paddingVertical: padV,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          ...typography.micro,
          color: p.fg,
          fontSize,
          letterSpacing: 0.8,
        }}
      >
        {LABEL[status]}
      </Text>
    </View>
  );
}
