import { Product } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView
} from 'react-native';
import OptimizedImage from '../OptimizedImage';

interface SellerProductsModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  sellerName: string;
  onProductPress: (product: Product) => void; // déclenche add + close
}

const SellerProductsModal: React.FC<SellerProductsModalProps> = ({
  visible,
  onClose,
  products,
  sellerName,
  onProductPress,
}) => {
  const handlePress = (product: Product) => {
    onProductPress(product);
  };

  const renderItem = ({ item }: { item: Product }) => {
    const imageUri = Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : 'https://via.placeholder.com/150';
    const name = item.name || 'Produit inconnu';
    const price = item.price != null ? `${item.price.toLocaleString()} CDF` : 'N/A';

    return (
      <TouchableOpacity
        style={styles.sellerProductItem}
     
      >
        <OptimizedImage source={{ uri: imageUri }} style={styles.sellerProductImage} />
        <View style={styles.sellerProductDetails}>
          <Text style={styles.sellerProductName} numberOfLines={1}>{name}</Text>
          <Text style={styles.sellerProductPrice}>{price}</Text>
        </View>
      </TouchableOpacity>
    );
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
            <Text style={styles.modalTitle}>Produits de {sellerName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>

          {products.length === 0 ? (
            <View style={styles.noProductsContainer}>
              <Text style={styles.noProductsText}>Ce vendeur n'a pas encore de produits.</Text>
            </View>
          ) : (
            <ScrollView style={styles.productList}>
              {products.map((item) => (
                <View key={item.id || Math.random().toString()}>
                  {renderItem({ item })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  modalView: {
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flex: 1, // modale longue
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  productList: { flex: 1 },
  sellerProductItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 12, marginBottom: 12 },
  sellerProductImage: { width: 70, height: 70, borderRadius: 0, marginRight: 15, backgroundColor: '#ddd' },
  sellerProductDetails: { flex: 1 },
  sellerProductName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  sellerProductPrice: { fontSize: 14, color: '#6C63FF', marginTop: 5 },
  noProductsContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  noProductsText: { fontSize: 16, color: '#888', marginTop: 10 },
});

export default SellerProductsModal;
