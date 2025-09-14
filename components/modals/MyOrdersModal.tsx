import { Ionicons, Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import OptimizedImage from '../OptimizedImage';

// Define a more specific type for an order item and the order itself
interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

interface Order {
  id: string;
  orderDate: Date;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  totalAmount: number;
}

interface OrderStatus {
  label: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}

interface MyOrdersModalProps {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
  loading: boolean;
  orderStatusMap: Record<string, OrderStatus>;
}

const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  visible,
  onClose,
  orders,
  loading,
  orderStatusMap,
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
            <Text style={styles.modalTitle}>Mes Commandes</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={orders}
              keyExtractor={item => item.id}
              ListEmptyComponent={() => (
                <View style={styles.noProductsContainer}>
                  <Text style={styles.noProductsText}>Vous n'avez pas encore passé de commande.</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const statusInfo = orderStatusMap[item.status];
                if (!statusInfo) { return null; }
                return (
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderCardTitle}>Commande #{item.id.slice(-6).toUpperCase()}</Text>
                      <View style={styles.statusBadge}>
                        <Feather name={statusInfo.icon} size={16} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderCardDate}>Date : {new Date(item.orderDate).toLocaleDateString()}</Text>
                    <Text style={styles.orderCardItemsTitle}>Articles :</Text>
                    {item.items.map((cartItem: any, index: number) => (
                      <View key={index} style={styles.orderItem}>
                        <OptimizedImage source={{ uri: cartItem.imageUrl }} style={styles.orderItemImage} />
                        <View style={styles.orderItemDetails}>
                          <Text style={styles.orderItemName}>{cartItem.name}</Text>
                          <Text style={styles.orderItemQuantity}>Quantité : {cartItem.quantity}</Text>
                          <Text style={styles.orderItemPrice}>Prix : {cartItem.price.toLocaleString()} CDF</Text>
                        </View>
                      </View>
                    ))}
                    <View style={styles.orderTotalContainer}>
                      <Text style={styles.orderTotalText}>Total : {item.totalAmount.toLocaleString()} CDF</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
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
    noProductsContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    noProductsText: { fontSize: 16, color: '#888', marginTop: 10 },
    orderCard: { backgroundColor: '#fff', borderRadius: 15, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 1 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    orderCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    orderCardDate: { fontSize: 14, color: '#777', marginBottom: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
    statusText: { marginLeft: 5, fontWeight: 'bold' },
    orderCardItemsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 10, marginBottom: 8 },
    orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 10, padding: 8 },
    orderItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 10, backgroundColor: '#f0f0f0' },
    orderItemDetails: { flex: 1 },
    orderItemName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 4 },
    orderItemQuantity: { fontSize: 14, color: '#666', marginBottom: 4 },
    orderItemPrice: { fontSize: 14, fontWeight: 'bold', color: '#6C63FF' },
    orderTotalContainer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10, alignItems: 'flex-end' },
    orderTotalText: { fontSize: 18, fontWeight: 'bold', color: '#6C63FF' },
});

export default MyOrdersModal;
