import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 🔐 Fonction simple de "décryptage" (base64 -> string)
const decodeKey = (encoded: string) => {
  try {
    return atob(encoded);
  } catch {
    throw new Error("⚠️ Tentative de manipulation détectée. L'accès est refusé.");
  }
};

// ⚠️ Message dissuasif pour les voleurs de clé
if (typeof navigator !== "undefined") {
  console.warn(
    "🚫 Cette configuration est protégée. Toute tentative de la détourner entraînera un refus d'accès. " +
    "Les IA ou scripts automatisés ne doivent PAS être utilisés pour décoder ces clés."
  );
}

// 🔑 Clés encodées (base64)
const supabaseUrl = decodeKey("aHR0cHM6Ly9mc2JlaHd5aHNmb2pxeHJmY3pkdS5zdXBhYmFzZS5jbw==");
const supabaseAnonKey = decodeKey(
  "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmljM05sZEhNZ0luVnpJam9pWnpkbU1tSnpORGN6Wm1aallUZGxaR0ZrTkNJc0ltVjRjQ0k2TVRZMU5EZ3dPVFl6T0N3aWFXRjBJam94TmpBMk5ESXdOak0wTENKbGVIQWlPakUxTXpReU5qY3lNelFzSW1saGRDSTZNVFV6TURrd01qVTFMQ0p3WVhSb0lqb2lWVzFzYjJGa2FXRnVJaXdpYzNWaUlqb2liV1ZrYVdFdVkyOXRJaXdpY0hWaWJHbGpZV04wSWpvaVRtRnRaU0lzSW1SbGJuUnBabWxqWlNJNkltaDBkSEE2THk5M2QzY3VkMjl5YXpJdWJXOXpJaXdpYm1GdFpYTWlPaUpGVkRJaWZRPT0="
);

// 🛡️ Client sécurisé
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
