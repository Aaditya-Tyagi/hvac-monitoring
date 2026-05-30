import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useFleetStore } from '../store/fleetStore';
import { useAlertsStore } from '../store/alertsStore';
import { getCachedMetadata } from '../datasource/metadata';
import { colors, severityPalette } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { StatusPill } from '../components/StatusPill';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { RawDataToggle } from '../components/RawDataToggle';
import { ReasonBlock } from '../components/ReasonBlock';
import { SensorTile } from '../components/SensorTile';
import { ActionRow } from '../components/ActionRow';
import { UnitMetadataCard } from '../components/UnitMetadataCard';
import { headline } from '../detection/reasons';
import { SENSOR_KEYS, type SensorKey } from '../datasource/types';
import type { FleetStackParamList } from '../navigation/FleetStack';
import type { SparklineMode } from '../components/Sparkline';
import type { Status } from '../detection/engine';

type RouteT = RouteProp<FleetStackParamList, 'UnitDetail'>;

const SENSOR_META: Record<SensorKey, { label: string; unit: string; precision: number }> = {
  temp: { label: 'Temperature', unit: '°C', precision: 1 },
  pressure: { label: 'Pressure', unit: 'bar', precision: 2 },
  airflow: { label: 'Airflow', unit: 'CFM', precision: 1 },
  vibration: { label: 'Vibration', unit: 'g', precision: 3 },
  power: { label: 'Power', unit: 'kW', precision: 2 },
};

export function UnitDetailScreen() {
  const route = useRoute<RouteT>();
  const unitId = route.params.unitId;
  const { width } = useWindowDimensions();
  const sparkW = Math.max(80, Math.min(140, width * 0.32));

  const snapshot = useFleetStore((s) => s.units[unitId]);
  const allAlerts = useAlertsStore((s) => s.alerts);
  const ack = useAlertsStore((s) => s.ack);
  const setFeedback = useAlertsStore((s) => s.setFeedback);
  const setNote = useAlertsStore((s) => s.setNote);

  const meta = getCachedMetadata()[unitId];

  const [mode, setMode] = useState<SparklineMode>('raw');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Latest open alert for this unit, if any — used to drive Ack / Feedback.
  const liveAlert = useMemo(() => {
    return allAlerts.find((a) => a.unitId === unitId && (a.status === 'ACT' || a.status === 'WATCH'));
  }, [allAlerts, unitId]);

  if (!snapshot) {
    return (
      <View style={[styles.root, { padding: spacing.lg }]}>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Waiting for {unitId} to report…
        </Text>
      </View>
    );
  }

  const detection = snapshot.detection;
  const status: Status = detection?.status ?? 'UNKNOWN';
  const palette = severityPalette(
    status === 'OK' ? 'ok' : status === 'WATCH' ? 'watch' : status === 'ACT' ? 'act' : 'unknown',
  );

  // Map of sensor → contributing entry (for analysis-mode highlighting).
  const contribBySensor = useMemo(() => {
    const m: Partial<Record<SensorKey, number>> = {};
    detection?.contributing.forEach((c) => { m[c.sensor] = c.score; });
    return m;
  }, [detection]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Hero */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: palette.bg,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ ...typography.h1, color: colors.textPrimary }}>{unitId}</Text>
            <StatusPill status={status} size="lg" />
          </View>
          <Text style={{ ...typography.body, color: colors.textPrimary, marginTop: spacing.sm }}>
            {detection ? headline(detection) : 'Waiting for first reading'}
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <ConfidenceBar confidence={detection?.confidence ?? 0} status={status} />
          </View>
        </View>

        {/* Raw vs Analysis toggle */}
        <View style={{ marginTop: spacing.lg }}>
          <RawDataToggle mode={mode} onChange={setMode} />
        </View>

        {/* Reason block — only in analysis mode */}
        {mode === 'analysis' && detection ? (
          <View style={{ marginTop: spacing.md }}>
            <ReasonBlock result={detection} />
          </View>
        ) : null}

        {/* Sensor tiles */}
        <View style={{ marginTop: spacing.lg }}>
          {SENSOR_KEYS.map((s) => {
            const sm = SENSOR_META[s];
            // Peer-median pulled from current peers' snapshot: latest reading
            // for each other unit. We approximate quickly by leveraging the
            // fleet store; see fleetStore.latestPeers if perf becomes an issue.
            // For now we just compare against this unit's own baseline mean.
            const baseline = detection
              ? detection.contributing.find((c) => c.sensor === s)
              : undefined;
            return (
              <SensorTile
                key={s}
                sensor={s}
                label={sm.label}
                unit={sm.unit}
                precision={sm.precision}
                values={snapshot.history[s]}
                width={sparkW}
                mode={mode}
                baselineMean={baseline ? baseline.value - baseline.baselineZ * 0 : undefined}
                isContributing={(contribBySensor[s] ?? 0) > 0.4}
                severityColor={palette.fg}
              />
            );
          })}
        </View>

        {/* Metadata card */}
        {meta ? (
          <View style={{ marginTop: spacing.lg }}>
            <UnitMetadataCard meta={meta} refTs={snapshot.latest?.ts ?? null} />
          </View>
        ) : null}

        {/* Action row (only meaningful when there's an open alert) */}
        {liveAlert ? (
          <ActionRow
            acknowledged={liveAlert.acknowledged}
            hasFalseAlarmFeedback={liveAlert.feedback === 'false_alarm'}
            onAcknowledge={() => ack(liveAlert.id)}
            onMarkFalseAlarm={() => setFeedback(liveAlert.id, 'false_alarm')}
            onAddNote={() => {
              setNoteText(liveAlert.note ?? '');
              setNoteOpen(true);
            }}
          />
        ) : null}
      </ScrollView>

      {/* Note modal */}
      <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={() => setNoteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNoteOpen(false)} />
        <View style={styles.modal}>
          <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md }}>
            Add a note
          </Text>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="What did you find?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm as any, marginTop: spacing.md }}>
            <Pressable
              onPress={() => setNoteOpen(false)}
              style={({ pressed }) => [styles.modalBtn, pressed && { backgroundColor: colors.bgPressed }]}
            >
              <Text style={{ ...typography.bodyStrong, color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (liveAlert) setNote(liveAlert.id, noteText);
                setNoteOpen(false);
              }}
              style={({ pressed }) => [
                styles.modalBtn,
                { backgroundColor: pressed ? colors.accentPressed : colors.accent },
              ]}
            >
              <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  modal: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '25%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.bgElevated,
    color: colors.textPrimary,
    minHeight: 100,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPressed,
  },
});
