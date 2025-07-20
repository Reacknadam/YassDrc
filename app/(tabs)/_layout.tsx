// app/(tabs)/_layout.tsx
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function TabsLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Tabs>
          <Tabs.Screen
            name="home"
            options={{
              title: 'Accueil',
              headerShown: false,
              tabBarIcon: ({ color }) => <Ionicons name="home" color={color} size={24} />,
            }}
          />
          <Tabs.Screen
            name="cart"
            options={{
              title: 'Panier',
              headerShown: false,
              tabBarIcon: ({ color }) => <Ionicons name="cart" color={color} size={24} />,
            }}
          />
          {/* Décommente si tu as ce fichier */}
          {/* <Tabs.Screen
            name="profile"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={24} />,
            }}
          /> */}
        </Tabs>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
