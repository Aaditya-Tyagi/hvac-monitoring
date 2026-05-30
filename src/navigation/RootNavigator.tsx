import React from 'react';
import { createNavigationContainerRef, NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FleetStack } from './FleetStack';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DebugScreen } from '../screens/DebugScreen';
import { colors } from '../theme/colors';
import { FleetIcon, HistoryIcon, SettingsIcon, DebugIcon } from '../components/TabIcons';

export type RootTabParamList = {
  Fleet: undefined;
  History: undefined;
  Settings: undefined;
  Debug: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Exposed so the notification deep-link handler can jump straight to a unit.
export const navigationRef = createNavigationContainerRef<RootTabParamList>();

export function deepLinkToUnit(unitId: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Fleet' as any, { screen: 'UnitDetail', params: { unitId } } as any);
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="Fleet"
          component={FleetStack}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <FleetIcon color={color} size={size ?? 24} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <HistoryIcon color={color} size={size ?? 24} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <SettingsIcon color={color} size={size ?? 24} focused={focused} />
            ),
          }}
        />
        {__DEV__ ? (
          <Tab.Screen
            name="Debug"
            component={DebugScreen}
            options={{
              tabBarIcon: ({ color, size, focused }) => (
                <DebugIcon color={color} size={size ?? 24} focused={focused} />
              ),
            }}
          />
        ) : null}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
