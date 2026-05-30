import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FleetScreen } from '../screens/FleetScreen';
import { UnitDetailScreen } from '../screens/UnitDetailScreen';
import { colors } from '../theme/colors';

export type FleetStackParamList = {
  Fleet: undefined;
  UnitDetail: { unitId: string };
};

const Stack = createNativeStackNavigator<FleetStackParamList>();

export function FleetStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Fleet" component={FleetScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="UnitDetail"
        component={UnitDetailScreen}
        options={({ route }) => ({ title: route.params.unitId })}
      />
    </Stack.Navigator>
  );
}
