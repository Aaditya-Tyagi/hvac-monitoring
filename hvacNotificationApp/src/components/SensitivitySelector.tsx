import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Sensitivity } from '../config/defaults';

const ORDER: Sensitivity[] = ['low', 'med', 'high'];
const LABEL: Record<Sensitivity, string> = { low: 'Low', med: 'Medium', high: 'High' };

export function SensitivitySelector({
  value,
  onChange,
}: {
  value: Sensitivity;
  onChange: (s: Sensitivity) => void;
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
      {ORDER.map((s) => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          android_ripple={{ color: colors.bgPressed }}
          style={{
            flex: 1,
            minHeight: tap.min - 12,
            paddingVertical: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: value === s ? colors.bgPressed : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              ...typography.bodyStrong,
              color: value === s ? colors.textPrimary : colors.textSecondary,
              fontSize: 14,
            }}
          >
            {LABEL[s]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
