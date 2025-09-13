import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const auth = useAuth();
  const user = auth?.authUser;
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6C63FF" />
    </View>
  );
}