import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fmtSimTime } from '../lib/time';

type Props = {
  counts: { OK: number; WATCH: number; ACT: number; UNKNOWN: number };
  simTime: number | null;
};

export function FleetHeader({ counts, simTime }: Props) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <Text style={{ ...typography.h1, color: colors.textPrimary }}>Fleet</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          sim {fmtSimTime(simTime)}
        </Text>
      </View>
      <View
        style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg as any, flexWrap: 'wrap' }}
      >
        <Counter label="OK" value={counts.OK} color={colors.ok} />
        <Counter label="WATCH" value={counts.WATCH} color={colors.watch} />
        <Counter label="ACT" value={counts.ACT} color={colors.act} />
        {counts.UNKNOWN > 0 ? (
          <Counter label="UNKNOWN" value={counts.UNKNOWN} color={colors.unknown} />
        ) : null}
      </View>
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 as any }}>
      <Text style={{ ...typography.h2, color }}>{value}</Text>
      <Text style={{ ...typography.micro, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}
