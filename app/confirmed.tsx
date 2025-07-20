import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Alert, View, Text, ActivityIndicator } from 'react-native';
import { supabase } from '@/services/supabase';

export default function ConfirmedScreen() {
  const { access_token, refresh_token } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const connect = async () => {
      if (!access_token || !refresh_token) {
        Alert.alert("Erreur", "Impossible de récupérer la session.");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string,
      });

      if (error) {
        Alert.alert("Connexion échouée", error.message);
      } else {

      }
    };

    connect();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text>Connexion en cours...</Text>
    </View>
  );
}
