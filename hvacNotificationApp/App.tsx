import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { RootNavigator, deepLinkToUnit } from './src/navigation/RootNavigator';
import { attachDataSource, setMetadata } from './src/runtime';
import { CsvReplayDataSource } from './src/datasource/CsvReplayDataSource';
import { setUnitMetadata } from './src/datasource/metadata';
import type { UnitMetadata } from './src/datasource/types';
import { notificationService } from './src/notifications/service';

// CSV is a binary asset (registered via metro.config.js), so require() returns
// a module ID number that we feed to expo-asset.
const csvModule = require('./assets/hvac_sensor_data.csv');
// JSON, by contrast, is parsed inline by Metro — require() returns the value.
const unitMetadataArr = require('./assets/unit_metadata.json') as UnitMetadata[];

export default function App() {
  useEffect(() => {
    let cancelled = false;
    const ds = new CsvReplayDataSource({ csvModule, tickMs: 400 });

    // Metadata is synchronous (already parsed by Metro); set it before kicking
    // off the data source so the engine has it from reading #1.
    const meta = setUnitMetadata(unitMetadataArr);
    setMetadata(meta);

    (async () => {
      try {
        await notificationService.setup();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('notification setup failed', e);
      }
      if (cancelled) return;
      attachDataSource(ds);
      try {
        await ds.start();
        // eslint-disable-next-line no-console
        console.log('[runtime] CSV replay started, state =', ds.state);
      } catch (e) {
        // Replay failure isn't fatal — UI will show empty state.
        // eslint-disable-next-line no-console
        console.warn('[runtime] CSV replay failed to start:', e);
      }
    })();

    return () => {
      cancelled = true;
      ds.stop();
    };
  }, []);

  // Deep-link: when the user taps a notification, jump to that unit's detail.
  // Handles both "tapped while app open" and "tapped from cold start".
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const unitId = response.notification.request.content.data?.unitId as string | undefined;
      if (unitId) deepLinkToUnit(unitId);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const unitId = response?.notification?.request.content.data?.unitId as string | undefined;
      if (unitId) deepLinkToUnit(unitId);
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
