import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function AuthCallback() {
  const router = useRouter();
  const { access_token, refresh_token } = useLocalSearchParams();

  useEffect(() => {
    (async () => {
      if (typeof access_token === 'string' && typeof refresh_token === 'string') {
        try {
          await supabase.auth.setSession({ access_token, refresh_token });
          router.replace('/(tabs)/home');
        } catch {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    })();
  }, [access_token, refresh_token, router]);

  return null; // écran blanc le temps du traitement
}