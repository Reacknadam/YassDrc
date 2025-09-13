import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function Login() {
  const { authUser, login, loading: authLoading, error: authError, setError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isEmailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const isPasswordValid = useMemo(() => password.trim().length >= 6, [password]);
  const formValid = isEmailValid && isPasswordValid;

  const buttonScale = new Animated.Value(1);
  const cardTranslateY = new Animated.Value(0);

  // Rediriger automatiquement si l'utilisateur est déjà connecté
  useEffect(() => {
    if (authUser) {
      router.replace('/home');
    }
  }, [authUser]);
  
  // Effacer l'erreur lors du démontage du composant
  useEffect(() => {
    return () => {
      setError(null);
    };
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password || !formValid) {
      setError("Veuillez saisir des identifiants valides (email + mot de passe ≥ 6 caractères).");
      return;
    }

    try {
      const success = await login(email, password);
      if (success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          router.replace('/home');
        }, 2000);
      }
    } catch (err) {
      console.error("Erreur inattendue:", err);
    }
  };

  const handleGoToRegister = () => {
    router.replace('/register');
  };
  
  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const floatAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardTranslateY, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    floatAnimation();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={['#6C63FF', '#4F46E5']}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View style={[styles.card, { transform: [{ translateY: cardTranslateY }] }]}>
              <Text style={styles.title}>Se connecter</Text>
              <Text style={styles.subtitle}>Bienvenue de retour</Text>
              
              {authError && <Text style={styles.errorText}>{authError}</Text>}
              
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Adresse e-mail"
                  placeholderTextColor="#A8A8B3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              {!isEmailValid && email.length > 0 && (
                <Text style={styles.helperError}>Format d'email invalide.</Text>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#A8A8B3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              {!isPasswordValid && password.length > 0 && (
                <Text style={styles.helperError}>Au moins 6 caractères.</Text>
              )}

              <TouchableOpacity style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, { transform: [{ scale: buttonScale }] }]}
                onPress={handleLogin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={authLoading || !formValid}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Se connecter</Text>
                )}
              </TouchableOpacity>

              {success && (
                <View style={styles.successMessage}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#22C55E" />
                  <Text style={styles.successText}>Connexion réussie !</Text>
                </View>
              )}

              <View style={styles.separatorContainer}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>OU</Text>
                <View style={styles.separatorLine} />
              </View>

          

              
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Vous n'avez pas de compte ?</Text>
                <TouchableOpacity onPress={handleGoToRegister}>
                  <Text style={styles.signupLink}>S'inscrire</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
  },
  helperError: {
    width: '100%',
    color: '#ef4444',
    marginTop: -8,
    marginBottom: 10,
    fontSize: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E1E1E',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6A6A6A',
    marginBottom: 30,
  },
  errorText: {
    color: '#FF6347',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F7F7F7',
    borderRadius: 15,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#6C63FF',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#E6F9F0',
    padding: 10,
    borderRadius: 10,
  },
  successText: {
    color: '#22C55E',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 30,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  separatorText: {
    marginHorizontal: 15,
    color: '#A8A8B3',
    fontSize: 14,
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: '#F7F7F7',
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  socialButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginLeft: 10,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 15,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  signupText: {
    color: '#A8A8B3',
  },
  signupLink: {
    color: '#4F46E5',
    fontWeight: 'bold',
    marginLeft: 5,
  },
});
