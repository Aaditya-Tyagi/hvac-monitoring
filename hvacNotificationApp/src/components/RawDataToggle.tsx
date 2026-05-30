import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { SparklineMode } from './Sparkline';

// "Without our bias" — Raw is the default so the technician sees the data
// before they see our verdict.
export function RawDataToggle({
  mode,
  onChange,
}: {
  mode: SparklineMode;
  onChange: (m: SparklineMode) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Segment label="Raw data" active={mode === 'raw'} onPress={() => onChange('raw')} />
      <Segment label="System analysis" active={mode === 'analysis'} onPress={() => onChange('analysis')} />
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={{
        flex: 1,
        minHeight: tap.min - 12,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.bgPressed : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          ...typography.bodyStrong,
          color: active ? colors.textPrimary : colors.textSecondary,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
