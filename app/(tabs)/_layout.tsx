// app/(tabs)/_layout.tsx
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { db } from '@/services/firebase'; // Assurez-vous que le chemin est correct
import { StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TabsLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            
            backgroundColor: '#dae3f9ff', // fond blanc
            borderRadius: 25,
            height: 70,
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            shadowColor: '#3b82f6', // bleu clair
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
            borderColor: '#e0e0e0',
            borderWidth: 1,
          },
          tabBarActiveTintColor: '#2563eb', // bleu vif
          tabBarInactiveTintColor: '#94a3b8', // gris bleu
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" color={color} size={28} />
            ),
          }}
        />
        <Tabs.Screen
          name="help"
          options={{
            title: 'Aide',
            tabBarIcon: ({ color }) => (
              <Ionicons name="help-circle-outline" color={color} size={28} />
            ),
          }}
        />
        {/* Nouvel onglet pour le chat */}
        <Tabs.Screen
          name="chat" // Le nom doit correspondre au dossier 'chat'
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubbles-outline" color={color} size={28} /> // Icône de bulle de discussion
            ),
          }}
        />

        {/* Ajoute d'autres onglets si besoin */}
         <Tabs.Screen
          name="profile" // Le nom doit correspondre au dossier 'chat'
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" color={color} size={28} /> // Icône de bulle de discussion
            ),
          }}
        />


         <Tabs.Screen
          name="news" // Le nom doit correspondre au dossier 'chat'
          options={{
            title: 'news',
            tabBarIcon: ({ color }) => (
              <Ionicons name="book" color={color} size={28} /> // Icône de bulle de discussion
            ),
          }}
        />

      </Tabs>
    </SafeAreaProvider>
  );
}