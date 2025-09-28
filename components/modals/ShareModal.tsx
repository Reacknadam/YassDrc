import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onReport: () => void;
  productName: string;
}

const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  onShare,
  onReport,
  productName,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.productName} numberOfLines={1}>
                  {productName}
                </Text>
                <View style={styles.dragHandle} />
              </View>

              <TouchableOpacity style={styles.optionButton} onPress={onShare}>
                <Feather name="share-2" size={22} color="#333" />
                <Text style={styles.optionText}>Partager le produit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionButton} onPress={onReport}>
                <Feather name="flag" size={22} color="#333" />
                <Text style={styles.optionText}>Signaler le produit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={[styles.optionText, styles.cancelButtonText]}>
                  Annuler
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Safe area for iOS bottom
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ccc',
    marginTop: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  optionText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    justifyContent: 'center',
    marginTop: 8,
    borderTopWidth: 0,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
  },
});

export default ShareModal;