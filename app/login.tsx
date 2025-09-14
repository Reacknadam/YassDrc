import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export default function LoginScreen() {
  const { login, signInWithGoogle, loading: authLoading, error: authError, setError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Clear error when the component is unmounted or inputs change
    return () => {
      setError(null);
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("L'email et le mot de passe sont requis.");
      return;
    }
    const success = await login(email, password);
    if (success) {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Bienvenue</Text>
              <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>
            </View>

            {authError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#E53E3E" />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Ionicons name="mail-outline" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.loginButton]}
                onPress={handleLogin}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Se connecter</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OU</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.socialLogins}>
              <TouchableOpacity style={styles.socialButton} onPress={signInWithGoogle}>
                <Ionicons name="logo-google" size={24} color="#DB4437" />
                <Text style={styles.socialButtonText}>Continuer avec Google</Text>
              </TouchableOpacity>
             
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Vous n'avez pas de compte ?</Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.signupLink}>S'inscrire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    marginLeft: 8,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputIcon: {
    fontSize: 22,
    color: '#9CA3AF',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#111827',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loginButton: {
    backgroundColor: '#4F46E5',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  separatorText: {
    marginHorizontal: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  socialLogins: {
    width: '100%',
    gap: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  socialButtonText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  signupLink: {
    marginLeft: 4,
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
