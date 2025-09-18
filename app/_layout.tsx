// app/_layout.tsx
import { Slot } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext'; // ← ajout

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>   {/* ← enveloppe TOUT */}
          <AuthProvider>
            <StatusBar style="dark" />
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6C63FF" />
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : (
              <Slot />
            )}
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
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
    marginTop: 12,
    fontSize: 16,
    color: '#6C63FF',
  },
});