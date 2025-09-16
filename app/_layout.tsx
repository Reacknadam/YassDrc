// app/_layout.tsx
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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

// Modern SplashScreen Component
function ModernSplashScreen() {
  const logoScale = React.useRef(new Animated.Value(0.7)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const textOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.splashContainer}>
      <Animated.View
        style={[
          styles.splashLogoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        
      </Animated.View>
      <Animated.Text style={[styles.splashText, { opacity: textOpacity }]}>
        Préparation de votre expérience...
      </Animated.Text>
      <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 32 }} />
    </View>
  );
}

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const { authUser } = useAuth(); // ← hook perso

  /* ----------  1.  Splash screen  ---------- */
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800);
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
                <ModernSplashScreen />
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
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  splashLogoContainer: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
 
  splashText: {
    marginTop: 8,
    fontSize: 18,
    color: '#6C63FF',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});