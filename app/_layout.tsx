import { Slot, router } from "expo-router";

import { Linking } from 'react-native';
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { useState, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import React from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";



export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current; // animation fade-in

  useEffect(() => {
    // animation fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 750,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);


  useEffect(() => {
    // Gérer les URLs d'entrée
    const handleDeepLink = (event: { url: string }) => {
      const url = new URL(event.url);
      const depositId = url.searchParams.get('depositId');
      const userId = url.searchParams.get('userId');
      
      // Si nous avons des paramètres de paiement, rediriger vers la page de subs
      if (depositId && userId) {
        router.replace(`/subs?depositId=${depositId}&userId=${userId}`);
      }
    };

    // Écouter les événements de deep linking
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Vérifier si l'app a été ouverte via un deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, []);



  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
            <StatusBar style="dark" />
            {loading ? (
              <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
                <Image
                  source={require('@/assets/images/icon.jpg')} // ton logo
                  style={styles.logo}
                />
                <Text style={styles.loadingText}>
                  Bienvenue sur Jumy...
                </Text>
              </Animated.View>
            ) : (
              <Slot />
            )}
          </SafeAreaView>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    resizeMode: "contain",
  },
  loadingText: {
    fontSize: 18,
    color: "#6C63FF",
    fontWeight: "600",
  },
});
