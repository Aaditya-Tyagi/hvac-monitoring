import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { radius, spacing, tap } from '../theme/spacing';
import { typography } from '../theme/typography';
import { getDataSource, restartReplay } from '../runtime';
import { useFleetStore } from '../store/fleetStore';
import { fmtSimDate } from '../lib/time';

// Speed presets — labels in "Nx" reflect how much faster than real time.
// Default tick is 250 ms = simulated 5 min = 1200× real time.
const SPEEDS: { label: string; tickMs: number }[] = [
  { label: '1×', tickMs: 300_000 }, // real time — useless for demo, but completeness
  { label: '60×', tickMs: 5_000 },
  { label: '300×', tickMs: 1_000 },
  { label: '1200×', tickMs: 250 },
  { label: '2000×', tickMs: 150 },
];

export function DebugScreen() {
  const ds = getDataSource();
  const simTime = useFleetStore((s) => s.simTime);
  const [, force] = useState(0);

  // Re-render every second so state pill stays fresh.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 750);
    return () => clearInterval(id);
  }, []);

  const state = ds?.state ?? 'idle';
  const tickMs = typeof (ds as any)?.getTickMs === 'function' ? (ds as any).getTickMs() : 250;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.h1, color: colors.textPrimary }}>Debug</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 4 }}>
          Dev-only replay controls for the eval demo.
        </Text>

        <SectionTitle>Replay state</SectionTitle>
        <View style={card()}>
          <Row k="State" v={state} />
          <Row k="Sim time" v={fmtSimDate(simTime)} />
          <Row k="Tick interval" v={`${tickMs} ms (≈ ${Math.round(300_000 / tickMs)}× real time)`} />
        </View>

        <SectionTitle>Controls</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm as any, marginBottom: spacing.md }}>
          <Btn
            label="Pause"
            disabled={state !== 'running'}
            onPress={() => ds?.pause()}
          />
          <Btn
            label="Resume"
            disabled={state !== 'paused'}
            onPress={() => ds?.resume()}
          />
          <Btn label="Restart" primary onPress={() => restartReplay()} />
        </View>

        <SectionTitle>Replay speed</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm as any }}>
          {SPEEDS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => ds?.setSpeed?.(s.tickMs)}
              android_ripple={{ color: colors.bgPressed }}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: tickMs === s.tickMs ? colors.accent : pressed ? colors.bgPressed : colors.bgCard,
                borderWidth: 1,
                borderColor: tickMs === s.tickMs ? colors.accent : colors.border,
                minHeight: tap.min - 8,
                justifyContent: 'center',
              })}
            >
              <Text style={{ ...typography.bodyStrong, color: colors.textPrimary, fontSize: 14 }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle>Notes</SectionTitle>
        <Text style={{ ...typography.caption, color: colors.textMuted, lineHeight: 18 }}>
          The CSV replays a 16-hour shift. Key moments:{'\n'}
          · sim ~03:00 — HVAC_1 should drift toward WATCH (gradual degradation).{'\n'}
          · sim 04:10 — HVAC_2 single-reading spike → ACT (hard-override).{'\n'}
          · sim 04:15+ — HVAC_2 returns to normal; status de-escalates.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        ...typography.micro,
        color: colors.textSecondary,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <Text style={{ ...typography.body, color: colors.textSecondary }}>{k}</Text>
      <Text style={{ ...typography.body, color: colors.textPrimary }}>{v}</Text>
    </View>
  );
}

function Btn({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_ripple={{ color: colors.bgPressed }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tap.min,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: disabled
          ? colors.bgPressed
          : primary
            ? (pressed ? colors.accentPressed : colors.accent)
            : (pressed ? colors.bgPressed : colors.bgCard),
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

const card = () => ({
  backgroundColor: colors.bgCard,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
});
