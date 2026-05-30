import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Sparkline, type SparklineMode } from './Sparkline';
import type { SensorKey } from '../datasource/types';

type Props = {
  sensor: SensorKey;
  label: string;
  unit: string;
  precision?: number;
  values: { ts: number; value: number }[];
  width: number;
  mode: SparklineMode;
  peerMedian?: number;
  baselineMean?: number;
  baselineStd?: number;
  isContributing?: boolean; // analysis mode: highlight this tile in severity color
  severityColor?: string;
};

const SENSOR_COLOR: Record<SensorKey, string> = {
  temp: colors.sensor.temp,
  pressure: colors.sensor.pressure,
  airflow: colors.sensor.airflow,
  vibration: colors.sensor.vibration,
  power: colors.sensor.power,
};

export function SensorTile({
  sensor,
  label,
  unit,
  precision = 2,
  values,
  width,
  mode,
  peerMedian,
  baselineMean,
  baselineStd,
  isContributing,
  severityColor,
}: Props) {
  const latest = values.length > 0 ? values[values.length - 1].value : null;
  const traceColor = mode === 'analysis' && isContributing && severityColor
    ? severityColor
    : SENSOR_COLOR[sensor];

  const delta =
    latest !== null && baselineMean !== undefined
      ? latest - baselineMean
      : null;
  const deltaStr =
    delta === null
      ? ''
      : (delta >= 0 ? '+' : '') + delta.toFixed(precision);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: isContributing && mode === 'analysis' ? (severityColor ?? colors.border) + '88' : colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ ...typography.h2, color: colors.textPrimary, marginTop: 2 }}>
          {latest === null ? '—' : latest.toFixed(precision)}
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{' ' + unit}</Text>
        </Text>
        {delta !== null && mode === 'analysis' ? (
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
            {deltaStr} from baseline
          </Text>
        ) : null}
      </View>
      <Sparkline
        values={values}
        width={width}
        height={48}
        color={traceColor}
        mode={mode}
        peerMedian={peerMedian}
        baselineMean={baselineMean}
        baselineStd={baselineStd}
      />
    </View>
  );
}
