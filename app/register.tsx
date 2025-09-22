import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export default function RegisterScreen() {
  const { register, loading: authLoading, error: authError, setError } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State for showing the credentials modal
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  // Store the credentials to show in the modal
  const [credentials, setCredentials] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    return () => {
      setError(null);
    };
  }, []);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLocalLoading(true);
    const success = await register(name, email, password);
    setLocalLoading(false); // ← remet actif immédiatement
    if (success) {
      // Affiche la pop-up avec les infos de connexion
      setCredentials({ name, email, password });
      setShowCredentialsModal(true);
    }
  };

  // Quand l'utilisateur ferme la pop-up, on le redirige vers le login
  const handleCloseModal = () => {
    setShowCredentialsModal(false);
    Alert.alert(
      "Succès",
      "Votre compte a été créé. Vous pouvez maintenant vous connecter."
    );
    router.replace('/login');
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
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back-outline" size={28} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.title}>Créer un compte</Text>
              <Text style={styles.subtitle}>Rejoignez-nous dès aujourd'hui</Text>
            </View>

            {authError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#E53E3E" />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nom complet"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                />
              </View>
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
              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmer le mot de passe"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(p => !p)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.registerButton]}
                onPress={handleRegister}
                disabled={localLoading}
              >
                {localLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>S'inscrire</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Vous avez déjà un compte ?</Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>

            {/* Modal pour afficher les infos de connexion */}
            <Modal
              visible={showCredentialsModal}
              animationType="slide"
              transparent
              onRequestClose={handleCloseModal}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Ionicons name="shield-checkmark-outline" size={48} color="#4F46E5" style={{ alignSelf: 'center', marginBottom: 10 }} />
                  <Text style={styles.modalTitle}>Informations de connexion</Text>
                  <Text style={styles.modalMessage}>
                    Veuillez faire une capture d'écran de ces informations et les conserver en lieu sûr. 
                    Pour votre sécurité, nous ne pourrons pas vous les réafficher plus tard.
                  </Text>
                  <View style={styles.credentialRow}>
                    <Text style={styles.credentialLabel}>Nom :</Text>
                    <Text style={styles.credentialValue}>{credentials.name}</Text>
                  </View>
                  <View style={styles.credentialRow}>
                    <Text style={styles.credentialLabel}>Email :</Text>
                    <Text style={styles.credentialValue}>{credentials.email}</Text>
                  </View>
                  <View style={styles.credentialRow}>
                    <Text style={styles.credentialLabel}>Mot de passe :</Text>
                    <Text style={styles.credentialValue}>{credentials.password}</Text>
                  </View>
                  <Text style={styles.modalWarning}>
                    ⚠️ Ne partagez jamais ces informations avec qui que ce soit. La sécurité de votre compte est primordiale.
                  </Text>
                  <TouchableOpacity style={styles.modalButton} onPress={handleCloseModal}>
                    <Text style={styles.modalButtonText}>J'ai bien noté mes infos</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
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
  backButton: {
    position: 'absolute',
    left: 0,
    top: 10,
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
  button: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 16,
  },
  registerButton: {
    backgroundColor: '#4F46E5',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  loginLink: {
    marginLeft: 4,
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Styles pour la modal de credentials
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
    marginBottom: 18,
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  credentialLabel: {
    fontWeight: 'bold',
    color: '#222',
    fontSize: 15,
  },
  credentialValue: {
    color: '#4F46E5',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: '60%',
  },
  modalWarning: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 18,
    fontStyle: 'italic',
  },
  modalButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
