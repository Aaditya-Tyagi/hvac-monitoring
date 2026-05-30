import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';

type ActionRowProps = {
  acknowledged: boolean;
  hasFalseAlarmFeedback: boolean;
  onAcknowledge: () => void;
  onMarkFalseAlarm: () => void;
  onAddNote: () => void;
};

export function ActionRow({
  acknowledged,
  hasFalseAlarmFeedback,
  onAcknowledge,
  onMarkFalseAlarm,
  onAddNote,
}: ActionRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm as any, marginTop: spacing.md }}>
      <Button
        label={acknowledged ? 'Acknowledged' : 'Acknowledge'}
        primary
        disabled={acknowledged}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAcknowledge();
        }}
      />
      <Button
        label={hasFalseAlarmFeedback ? 'Marked false' : 'False alarm'}
        disabled={hasFalseAlarmFeedback}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onMarkFalseAlarm();
        }}
      />
      <Button label="Note" onPress={onAddNote} />
    </View>
  );
}

function Button({
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
        flex: 1,
        minHeight: tap.action,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        backgroundColor: disabled
          ? colors.bgPressed
          : primary
            ? (pressed ? colors.accentPressed : colors.accent)
            : (pressed ? colors.bgPressed : colors.bgCard),
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          ...typography.bodyStrong,
          color: primary && !disabled ? colors.textPrimary : colors.textPrimary,
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
