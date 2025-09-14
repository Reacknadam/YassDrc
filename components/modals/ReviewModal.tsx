import { AntDesign, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  productName: string;
  onSubmit: (rating: number, comment: string) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  onClose,
  productName,
  onSubmit,
}) => {
  const [currentRating, setCurrentRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const handleSubmit = () => {
    onSubmit(currentRating, reviewComment);
    // Reset state after submission
    setCurrentRating(0);
    setReviewComment('');
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Soumettre un Avis</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewProductTitle}>{productName}</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setCurrentRating(star)}>
                  <AntDesign
                    name={star <= currentRating ? "star" : "staro"}
                    size={40}
                    color="#FFD700"
                    style={{ marginHorizontal: 5 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.inputArea}
              placeholder="Écrivez votre commentaire..."
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <TouchableOpacity style={styles.submitReviewBtn} onPress={handleSubmit}>
              <Text style={styles.submitReviewBtnText}>Envoyer l'avis</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
    modalView: { backgroundColor: '#f8f8f8', borderRadius: 20, padding: 20, width: '90%', maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    reviewContent: { padding: 10 },
    reviewProductTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    ratingContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
    inputArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, color: '#333', height: 100, textAlignVertical: 'top' },
    submitReviewBtn: { backgroundColor: '#6C63FF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    submitReviewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default ReviewModal;
