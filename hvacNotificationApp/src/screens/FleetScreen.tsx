import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useFleetStore, selectUnitsSortedBySeverity, selectFleetSummary } from '../store/fleetStore';
import { UnitCard } from '../components/UnitCard';
import { FleetHeader } from '../components/FleetHeader';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FleetStackParamList } from '../navigation/FleetStack';

export function FleetScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FleetStackParamList>>();
  // useShallow does a shallow ref-equal compare so freshly-allocated arrays/
  // objects with the same contents don't trigger re-renders. Without this,
  // every store tick re-renders this screen even when sorted order hasn't
  // changed — at 400ms ticks * 5 units that's a lot of wasted work and can
  // pile up into a "maximum update depth" cascade.
  const units = useFleetStore(useShallow(selectUnitsSortedBySeverity));
  const counts = useFleetStore(useShallow(selectFleetSummary));
  const simTime = useFleetStore((s) => s.simTime);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FleetHeader counts={counts} simTime={simTime} />
      <FlatList
        data={units}
        keyExtractor={(u) => u.unitId}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, alignItems: 'flex-start' }}>
            <View
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: spacing.lg,
                width: '100%',
              }}
            >
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={{ ...typography.h3, color: colors.textPrimary }}>Waiting for sensors…</Text>
              </View>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                The CSV replay starts when the runtime mounts. Open the Debug tab
                to control replay speed or restart.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <UnitCard
            unitId={item.unitId}
            detection={item.detection}
            lastSimTs={item.latest?.ts ?? null}
            onPress={() => navigation.navigate('UnitDetail', { unitId: item.unitId })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
