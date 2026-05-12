import React from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import IceCreamsScreen from './src/screens/IceCreamsScreen';
import VendorsScreen from './src/screens/VendorsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import BackupScreen from './src/screens/BackupScreen';

const Tab = createBottomTabNavigator();

const TAB_ICON = {
  'Ice Creams': '🍦',
  Vendors: '🧑‍💼',
  Transactions: '📋',
  Backup: '💾',
};

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#2E86AB" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22 }}>
              {TAB_ICON[route.name]}
            </Text>
          ),
          tabBarActiveTintColor: '#2E86AB',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: Platform.OS === 'ios' ? 20 : 6,
            paddingTop: 6,
            height: Platform.OS === 'ios' ? 80 : 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#2E86AB',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
        })}
      >
        <Tab.Screen
          name="Ice Creams"
          component={IceCreamsScreen}
          options={{ headerTitle: '🍦  Ice Creams' }}
        />
        <Tab.Screen
          name="Vendors"
          component={VendorsScreen}
          options={{ headerTitle: '🧑‍💼  Vendors' }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ headerTitle: '📋  Transactions' }}
        />
        <Tab.Screen
          name="Backup"
          component={BackupScreen}
          options={{ headerTitle: '💾  Backup & Restore' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
