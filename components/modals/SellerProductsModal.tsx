import { Product } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import OptimizedImage from '../OptimizedImage';

interface SellerProductsModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  sellerName: string;
  onProductSelect: (product: Product) => void;
}

const SellerProductsModal: React.FC<SellerProductsModalProps> = ({
  visible,
  onClose,
  products,
  sellerName,
  onProductSelect,
}) => {
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
            <Text style={styles.modalTitle}>Produits de {sellerName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.sellerProductItem} onPress={() => onProductSelect(item)}>
                <OptimizedImage source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
                <View style={styles.sellerProductDetails}>
                  <Text style={styles.sellerProductName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.noProductsContainer}>
                <Text style={styles.noProductsText}>Ce vendeur n'a pas encore de produits.</Text>
              </View>
            )}
          />
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
    sellerProductItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
    sellerProductImage: { width: 70, height: 70, borderRadius: 8, marginRight: 15 },
    sellerProductDetails: { flex: 1 },
    sellerProductName: { fontSize: 16, fontWeight: 'bold' },
    sellerProductPrice: { fontSize: 14, color: '#6C63FF', marginTop: 5 },
    noProductsContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    noProductsText: { fontSize: 16, color: '#888', marginTop: 10 },
});

export default SellerProductsModal;
