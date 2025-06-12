import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Importe getAuth et onAuthStateChanged
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Text, Portal, Provider as PaperProvider } from 'react-native-paper'; // Importe pour les modals Paper

// Ce composant représente le layout racine de ton application avec Expo Router.
// Il gère la logique d'authentification et bascule entre les routes d'authentification et les routes de l'application principale.
export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // Initialisé à null pour indiquer "pas encore vérifié"
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);

  useEffect(() => {
    // Obtenez l'instance d'authentification de Firebase.
    // Assurez-vous que Firebase est initialisé UNE SEULE FOIS dans `firebaseConfig.js`
    // et que `auth` est exporté de là.
    const authInstance = getAuth();

    // S'abonne aux changements d'état d'authentification de Firebase.
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setIsAuthenticated(!!user); // Définit `true` si un utilisateur est connecté, `false` sinon.
      setAuthInitialized(true); // Indique que l'état d'authentification initial a été vérifié.
    });

    // Nettoie l'abonnement quand le composant est démonté.
    return unsubscribe;
  }, []); // Le tableau de dépendances vide assure que cela ne s'exécute qu'une seule fois au montage.

  // Affiche un indicateur de chargement tant que l'état d'authentification n'est pas initialisé.
  if (!authInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={styles.loadingText}>Chargement de l'application...</Text>
      </View>
    );
  }

  // Si l'utilisateur n'est pas authentifié, affiche la pile de navigation de l'authentification.
  // Les routes d'authentification (login, register, forgot-password) n'auront pas de header.
  if (!isAuthenticated) {
    return (
      <PaperProvider>
        <Portal.Host>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" /> {/* app/login.tsx */}
            <Stack.Screen name="register" /> {/* app/register.tsx */}
            <Stack.Screen name="forgot-password" /> {/* app/forgot-password.tsx */}
          </Stack>
        </Portal.Host>
      </PaperProvider>
    );
  }

  // Si l'utilisateur est authentifié, affiche le layout principal de l'application.
  // Cela inclura les onglets (définis dans app/(tabs)/_layout.tsx) et toute autre route principale.
  return (
    <PaperProvider>
      <Portal.Host>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Le groupe (tabs) contient la navigation par onglets pour les utilisateurs connectés. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Ajoute ici d'autres routes de haut niveau qui ne sont pas dans les onglets,
              par exemple, un écran de détails de produit qui s'ouvre depuis n'importe où. */}
          <Stack.Screen name="product-details/[id]" options={{ headerShown: false }} /> {/* Exemple pour product-details/[id].tsx */}
        </Stack>
      </Portal.Host>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FA',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
