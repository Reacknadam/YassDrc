// app/_layout.tsx
import { Slot } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // rotation infinie
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // effet pulsation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // arrêt du loading après 3s
    const timer = setTimeout(() => {
      pulse.stop();
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // interpolation pour la rotation
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            {loading ? (
              <View style={styles.loadingContainer}>
                <Animated.View
                  style={[
                    styles.orbit,
                    { transform: [{ rotate: spin }, { scale: scaleAnim }] },
                  ]}
                >
                  {[ '#6C63FF', '#FF6584', '#FFA500', '#00C9A7' ].map(
                    (color, i) => (
                      <View
                        key={i}
                        style={[
                          styles.planet,
                          {
                            backgroundColor: color,
                            transform: [
                              {
                                translateX: Math.cos((i * Math.PI) / 2) * 80,
                              },
                              {
                                translateY: Math.sin((i * Math.PI) / 2) * 80,
                              },
                            ],
                          },
                        ]}
                      />
                    )
                  )}
                </Animated.View>
                <Text style={styles.loadingText}>Chargement... 🌌</Text>
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
    backgroundColor: '#0d0d1a', // fond sombre style galaxie
  },
  orbit: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planet: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.8,
  },
  loadingText: {
    marginTop: 220,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
