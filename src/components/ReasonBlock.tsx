import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { DetectionResult } from '../detection/engine';
import { bullets, REASON_LABEL } from '../detection/reasons';

export function ReasonBlock({ result }: { result: DetectionResult }) {
  const bs = bullets(result);
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
        Why this status
      </Text>
      {bs.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: i === bs.length - 1 ? 0 : spacing.sm }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, width: 16 }}>•</Text>
          <Text style={{ ...typography.body, color: colors.textPrimary, flex: 1 }}>{line}</Text>
        </View>
      ))}

      {result.reasonCodes.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md, gap: 6 as any }}>
          {result.reasonCodes.slice(0, 4).map((code) => (
            <View
              key={code}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.bgPressed,
              }}
            >
              <Text style={{ ...typography.micro, color: colors.textSecondary }}>
                {REASON_LABEL[code]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
