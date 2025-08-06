import { Slot } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';  // Importer AuthProvider
import React from 'react';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider> 
        <StatusBar style="dark" />
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingText}>Préparation de votre expérience...</Text>
          </View>
        ) : (
          <Slot />
        )}
      </AuthProvider>
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
    // fontFamily: 'Inter_500Medium' // Assure-toi que cette font est chargée, sinon commente
  },
});
