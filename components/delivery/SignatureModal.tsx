import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ visible, onClose, onSave }) => {
  const [signature, setSignature] = useState('');

  const handleSave = () => {
    if (signature.trim().length < 2) {
      Alert.alert('Signature invalide', 'Veuillez entrer une signature valide');
      return;
    }
    onSave(signature);
    setSignature('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
    >
      <View style={styles.signatureModalContainer}>
        <View style={styles.signatureModalContent}>
          <View style={styles.signatureModalHeader}>
            <Text style={styles.signatureModalTitle}>Signature du client</Text>
            <TouchableOpacity onPress={onClose} style={styles.signatureCloseButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.signatureInputContainer}>
            <Text style={styles.signatureLabel}>
              Veuillez demander au client de signer ci-dessous :
            </Text>
            <TextInput
              style={styles.signatureInput}
              value={signature}
              onChangeText={setSignature}
              placeholder="Nom du client"
              placeholderTextColor="#94A3B8"
              autoFocus={true}
            />
          </View>

          <View style={styles.signatureActions}>
            <TouchableOpacity
              style={[styles.signatureButton, styles.signatureCancelButton]}
              onPress={onClose}
            >
              <Text style={styles.signatureCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.signatureButton, styles.signatureSaveButton]}
              onPress={handleSave}
            >
              <Text style={styles.signatureSaveText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  signatureModalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  signatureModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '50%' },
  signatureModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  signatureModalTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  signatureCloseButton: { padding: 4 },
  signatureInputContainer: { marginBottom: 24 },
  signatureLabel: { fontSize: 14, color: '#64748B', marginBottom: 12 },
  signatureInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1E293B' },
  signatureActions: { flexDirection: 'row', gap: 12 },
  signatureButton: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  signatureCancelButton: { backgroundColor: '#F1F5F9' },
  signatureCancelText: { color: '#64748B', fontWeight: '600' },
  signatureSaveButton: { backgroundColor: '#4F46E5' },
  signatureSaveText: { color: '#FFF', fontWeight: '600' },
});

export default SignatureModal;
