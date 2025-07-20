import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext'; // Assurez-vous que ce chemin est correct
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  // Utilisez les états `loading` et `error` du contexte pour une meilleure cohérence
  const { register, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Supprimé les états `error` et `loading` locaux car ils sont maintenant gérés par le contexte

  const handleRegister = async () => {
    // Validations côté client avant d'appeler le contexte
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Erreur d'inscription", "Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Erreur d'inscription", "Le mot de passe doit contenir au minimum 6 caractères.");
      return;
    }

    try {
      // Le `register` du contexte gère déjà son propre `loading` et `error`
      // Il renvoie `true` en cas de succès, `false` en cas d'échec (avec alerte déjà affichée par le contexte)
      const success = await register(username, email, password);

      if (success) {
        Alert.alert("Succès", "Compte créé ! Vous êtes maintenant connecté.");
        router.replace('/home'); // Naviguer seulement si l'inscription a réussi
      } else {
        // Si `success` est `false`, cela signifie que le contexte a déjà affiché une alerte spécifique
        // (par ex., email déjà utilisé). On reste sur la page.
        console.log('Échec de l\'inscription. L\'utilisateur reste sur la page d\'inscription.');
      }
    } catch (err: any) {
      // Ce bloc catch ne sera atteint que si une erreur inattendue se produit
      // qui n'est pas gérée par le retour `false` du contexte (ex. problème réseau grave).
      console.error("Erreur inattendue lors de l'inscription:", err);
      // `authError` (du contexte) affichera le message approprié dans l'UI.
    }
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={28} color="#6C63FF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="person-add-outline" size={80} color="#33CC66" />
          <Text style={styles.title}>Créez votre compte</Text>
          <Text style={styles.subtitle}>Rejoignez notre communauté !</Text>
        </View>
      </View>

      <View style={styles.form}>
        {/* Afficher l'erreur provenant du contexte */}
        {authError && <Text style={styles.errorText}>{authError}</Text>}

        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={20} color="#888" style={styles.icon} />
          <TextInput
            placeholder="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={20} color="#888" style={styles.icon} />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.icon} />
          <TextInput
            placeholder="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.icon} />
          <TextInput
            placeholder="Confirmer le mot de passe"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            placeholderTextColor="#888"
          />
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={authLoading} 
        >
          {authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>S'inscrire</Text>
          )}
        </TouchableOpacity>

        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OU</Text>
          <View style={styles.separatorLine} />
        </View>

        <TouchableOpacity style={styles.loginLinkButton} onPress={handleGoToLogin}>
          <Text style={styles.loginLinkText}>J'ai déjà un compte</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 25,
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 25,
    width: '100%',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 25,
  },
  form: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  errorText: {
    color: '#FF6347',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
    fontWeight: '500',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  registerButton: {
    backgroundColor: '#33CC66',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#33CC66',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    marginHorizontal: 15,
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLinkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
});