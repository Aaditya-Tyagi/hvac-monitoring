import React from 'react';
import { Text, View } from 'react-native';
import { format, formatDistanceStrict, differenceInDays } from 'date-fns';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { UnitMetadata } from '../datasource/types';

const AREA_LABEL: Record<UnitMetadata['area'], string> = {
  cleanroom: 'Cleanroom',
  warehouse: 'Warehouse',
  production_floor: 'Production floor',
  rooftop: 'Rooftop',
};

export function UnitMetadataCard({ meta, refTs }: { meta: UnitMetadata; refTs: number | null }) {
  const ref = refTs ?? Date.now();
  const lastServiceMs = new Date(meta.lastServiceDate).getTime();
  const daysSinceService = Math.floor((ref - lastServiceMs) / 86400000);
  const overdue = daysSinceService - meta.serviceIntervalDays;
  const ageYears = Math.max(0, ((ref - new Date(meta.installDate).getTime()) / (365.25 * 86400000))).toFixed(1);

  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
      }}
    >
      <Text style={{ ...typography.micro, color: colors.textSecondary, marginBottom: spacing.sm }}>
        Unit info
      </Text>

      <Row k="Area" v={AREA_LABEL[meta.area]} />
      <Row k="Age" v={`${ageYears} yrs`} />
      <Row k="Capacity" v={`${meta.nominalCapacity} kW`} />
      <Row
        k="Last service"
        v={`${format(lastServiceMs, 'd MMM yyyy')} (${daysSinceService}d ago)`}
      />

      {overdue > 0 ? (
        <View
          style={{
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.watch }}>
            ⚠ Service is {overdue} day{overdue === 1 ? '' : 's'} overdue
            {overdue > 30 ? ' — sensitivity is slightly raised on this unit.' : '.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ ...typography.body, color: colors.textSecondary }}>{k}</Text>
      <Text style={{ ...typography.body, color: colors.textPrimary }}>{v}</Text>
    </View>
  );
}
