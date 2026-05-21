import React, { useState, useEffect } from 'react';
import { StatusBar, View, Text, StyleSheet, Animated, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import IceCreamsScreen from './src/screens/IceCreamsScreen';
import VendorsScreen from './src/screens/VendorsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import TotalsScreen from './src/screens/TotalsScreen';
import {
  cleanupOldTransactions,
  migrateFromAsyncStorage,
  enableNetwork,
} from './src/firebase/store';

const Tab = createBottomTabNavigator();
const MIGRATION_KEY = 'firebase_migrated_v1';

const TAB_ICON = {
  'Ice Creams': '🍦',
  Vendors: '🧑‍💼',
  Transactions: '📋',
  Totals: '📊',
};

function SplashScreen() {
  const scale = new Animated.Value(0.6);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={splash.container}>
      <Animated.View style={[splash.logoBox, { transform: [{ scale }], opacity }]}>
        <Text style={splash.emoji}>🍦</Text>
        <Text style={splash.title}>Ice Cream Shop</Text>
        <Text style={splash.subtitle}>Vendor Management</Text>
      </Animated.View>
    </View>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const startup = async () => {
      // One-time migration: upload existing local data to Firestore
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (!migrated) {
        try {
          const [icsRaw, vendsRaw, transRaw] = await Promise.all([
            AsyncStorage.getItem('icecreams'),
            AsyncStorage.getItem('vendors'),
            AsyncStorage.getItem('transactions'),
          ]);
          await migrateFromAsyncStorage({
            iceCreams: icsRaw ? JSON.parse(icsRaw) : [],
            vendors: vendsRaw ? JSON.parse(vendsRaw) : [],
            transactions: transRaw ? JSON.parse(transRaw) : {},
          });
          await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        } catch (_) {}
      }
      // Clean up Firestore transactions older than 30 days
      cleanupOldTransactions().catch(() => {});
    };

    startup();
    // Re-enable Firestore network when app comes back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') enableNetwork().catch(() => {});
    });
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  if (showSplash) return <SafeAreaProvider><SplashScreen /></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
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
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          headerStyle: { backgroundColor: '#2E86AB', elevation: 0, shadowOpacity: 0 },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        })}
      >
        <Tab.Screen name="Ice Creams" component={IceCreamsScreen} options={{ headerTitle: '🍦  Ice Creams' }} />
        <Tab.Screen name="Vendors" component={VendorsScreen} options={{ headerTitle: '🧑‍💼  Vendors' }} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ headerTitle: '📋  Transactions' }} />
        <Tab.Screen name="Totals" component={TotalsScreen} options={{ headerTitle: '📊  Monthly Totals' }} />
      </Tab.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

const splash = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2E86AB', alignItems: 'center', justifyContent: 'center' },
  logoBox: { alignItems: 'center' },
  emoji: { fontSize: 90, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: '500' },
});
