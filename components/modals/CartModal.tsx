import { CartItem } from '../../types';
import { useRouter } from 'expo-router';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import OptimizedImage from '../OptimizedImage';

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onPlaceOrder: (sellerId: string, items: CartItem[], totalAmount: number) => void;
  loadingOrder: string | null;
}
const router = useRouter();
const CartModal: React.FC<CartModalProps> = ({
  visible,
  onClose,
  cart,
  onUpdateQuantity,
  onPlaceOrder,
  loadingOrder,
}) => {

  const groupCartBySeller = () => {
    const grouped: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      if (!grouped[item.sellerId]) {
        grouped[item.sellerId] = [];
      }
      grouped[item.sellerId].push(item);
    });
    return grouped;
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

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
            <Text style={styles.modalTitle}>Votre Panier ({cart.length})</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(groupCartBySeller()).map(([sellerId, items]) => (
              <View key={sellerId} style={styles.cartSection}>
                <View style={styles.sellerHeader}>
                  <Text style={styles.sellerNameText}>{items[0].sellerName}</Text>
                  <TouchableOpacity
                    style={[styles.checkoutBtn, loadingOrder === sellerId && { backgroundColor: '#ccc' }]}
                 onPress={() => {
                      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
                      router.push({
                        pathname: '/pay',
                        params: {
                          orderId: 'temp',
                          totalAmount: String(total),
                          sellerId,
                        },
                      });
                    }}
                  >
                    {loadingOrder === sellerId ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.checkoutBtnText}>Commander</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {items.map(item => (
                  <View key={item.id} style={styles.cartItem}>
                    <OptimizedImage source={{ uri: item.images[0] }} style={styles.cartItemImage} />
                    <View style={styles.cartItemDetails}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>{item.price.toLocaleString()} CDF</Text>
                    </View>
                    <View style={styles.cartItemControls}>
                      <TouchableOpacity onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                        <AntDesign name="minus" size={24} color="#888" />
                      </TouchableOpacity>
                      <Text style={styles.cartItemQuantity}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                        <AntDesign name="pluscircleo" size={24} color="#6C63FF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.cartFooter}>
            <Text style={styles.cartTotalText}>Total : {cartTotal.toLocaleString()} CDF</Text>
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
    cartSection: { marginBottom: 20, padding: 10, backgroundColor: '#fff', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 },
    sellerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sellerNameText: { fontSize: 16, fontWeight: 'bold' },
    checkoutBtn: { backgroundColor: '#2ecc71', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
    checkoutBtnText: { color: '#fff', fontWeight: 'bold' },
    cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    cartItemImage: { width: 60, height: 60, borderRadius: 10, marginRight: 15 },
    cartItemDetails: { flex: 1 },
    cartItemName: { fontSize: 16, fontWeight: 'bold' },
    cartItemPrice: { fontSize: 14, color: '#6C63FF' },
    cartItemControls: { flexDirection: 'row', alignItems: 'center' },
    cartItemQuantity: { fontSize: 16, marginHorizontal: 10 },
    cartFooter: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10, alignItems: 'flex-end' },
    cartTotalText: { fontSize: 20, fontWeight: 'bold', color: '#6C63FF' },
});

export default CartModal;
