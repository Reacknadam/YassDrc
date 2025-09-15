// app/_layout.tsx
import * as React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const WORKER_URL = 'https://notif.israelntalu328.workers.dev'; // <--- ton Worker

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const { authUser } = useAuth(); // ← hook perso

  /* ----------  1.  Splash screen  ---------- */
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  /* ----------  2.  FCM + enregistrement  ---------- */
  useEffect(() => {
    (async () => {
      if (!Device.isDevice) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })
      ).data;

      // On envoie le token au Worker (KV)
      await fetch(`${WORKER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser?.id ?? 'anon', token }),
      });

      // On écoute les notifs reçues **while app is foreground**
      const sub = Notifications.addNotificationReceivedListener((notification) => {
        const { title, body } = notification.request.content;
        Alert.alert(title ?? 'Notification', body ?? '');
      });

      return () => sub.remove();
    })();
  }, [authUser?.id]);

  /* ----------  3.  UI  ---------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
              <StatusBar style="dark" />
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#6C63FF" />
                  <Text style={styles.loadingText}>
                    Préparation de votre expérience...
                  </Text>
                </View>
              ) : (
                <Slot />
              )}
            </SafeAreaView>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#6C63FF',
  },
});