import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Copied from check.tsx, should be centralized in types/index.ts
enum OrderStatus {
  PendingDeliveryChoice = 'pending_delivery_choice',
  SellerDelivering = 'seller_delivering',
  AppDelivering = 'app_delivering',
  PaymentOK = 'payment_ok',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

enum DeliveryMethod {
    SellerDelivery = 'seller_delivery',
    AppDelivery = 'app_delivery',
  }

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  priceCDF: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCoordinates: Coordinates;
  totalAmountCDF: number;
  status: OrderStatus;
  deliveryMethod?: 'seller_delivery' | 'app_delivery';
  sellerId: string;
  createdAt: Timestamp;
  proofImageUrl?: string;
  proofSignatureUrl?: string;
  proofGpsTimestamp?: Timestamp;
  deliveredAt?: Timestamp;
  sellerDepositId?: string;
  sellerLiveLatitude?: number;
  sellerLiveLongitude?: number;
  items?: OrderItem[];
  driverId?: string;
}

interface Driver {
    id: string;
    name: string;
    phoneNumber: string;
    liveLatitude: number;
    liveLongitude: number;
    distance: string;
    isAvailable: boolean;
}
// End of copied types

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
const formatDate = (timestamp: Timestamp): string => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(timestamp.toDate());
};

interface OrderCardProps {
  order: Order;
  onAppDeliverySelected: () => void;
  onSellerDeliverySelected: () => void;
  onDeliveryProof: () => void;
  onContactCustomer: () => void;
  onAssignDriver: () => void;
  setSelectedDriver: (driver: Driver) => void;
  setDriverDepositId: (id: string) => void;
  setPaymentVisible: (visible: boolean) => void;
  availableDrivers: Driver[];
  driverLocation?: { latitude: number; longitude: number } | null;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onAppDeliverySelected,
  onSellerDeliverySelected,
  onDeliveryProof,
  onContactCustomer,
  onAssignDriver,
  setSelectedDriver,
  setDriverDepositId,
  setPaymentVisible,
  availableDrivers,
  driverLocation,
}) => {

  const getStatusConfig = (status: OrderStatus): { color: string; text: string; icon: IoniconName } => {
    switch (status) {
      case OrderStatus.PendingDeliveryChoice:
        return { color: '#F59E0B', text: 'En attente', icon: 'time-outline' };
      case OrderStatus.SellerDelivering:
        return { color: '#3B82F6', text: 'En livraison', icon: 'car' };
      case OrderStatus.AppDelivering:
        return { color: '#8B5CF6', text: 'Course à payer', icon: 'card-outline' };
      case OrderStatus.PaymentOK:
        return { color: '#10B981', text: 'Paiement confirmé', icon: 'checkmark-circle' };
      case OrderStatus.Delivered:
        return { color: '#059669', text: 'Livrée', icon: 'checkmark-done' };
      case OrderStatus.Cancelled:
        return { color: '#EF4444', text: 'Annulée', icon: 'close-circle' };
      default:
        return { color: '#6B7280', text: 'Inconnu', icon: 'help-circle-outline' };
    }
  };

  const statusConfig = getStatusConfig(order.status);

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        <View>
          <Text style={styles.orderId}>Commande #{order.id.slice(-6)}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
          <Ionicons name={statusConfig.icon} size={14} color="#FFF" />
          <Text style={styles.statusText}>{statusConfig.text}</Text>
        </View>
      </View>

      <View style={styles.customerInfo}>
        <Ionicons name="person" size={16} color="#4B5563" />
        <Text style={styles.customerName}>{order.customerName}</Text>
        <TouchableOpacity onPress={onContactCustomer} style={styles.contactButton}>
          <Ionicons name="call" size={16} color="#3B82F6" />
          <Text style={styles.contactText}>Appeler</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.deliveryInfo}>
        <Ionicons name="location" size={16} color="#4B5563" />
        <Text style={styles.deliveryAddress} numberOfLines={2}>
          {order.deliveryAddress}
        </Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Montant total:</Text>
        <Text style={styles.amountValue}>{formatCurrency(order.totalAmountCDF)}</Text>
      </View>

      {order.items && order.items.length > 0 && (
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Articles:</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity} x {formatCurrency(item.priceCDF)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {order.status === OrderStatus.PendingDeliveryChoice && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.sellerDeliveryButton]}
            onPress={onSellerDeliverySelected}
          >
            <Ionicons name="car" size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>Je livre moi-même</Text>
          </TouchableOpacity>
         
          <TouchableOpacity
            style={[styles.actionButton, styles.assignDriverButton]}
            onPress={() => {
                if (availableDrivers.length > 0) {
                    const driver = availableDrivers[0]; // ou choisis-en un autre
                    setSelectedDriver(driver);
                    setDriverDepositId(`dep_driver_${order.id}_${Math.random().toString(36).substring(7)}`);
                    setPaymentVisible(true);
                }
            }}
          >
            <Ionicons name="person" size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>Assigner livreur</Text>
          </TouchableOpacity>
        </View>
      )}

      {(order.status === OrderStatus.SellerDelivering || order.status === OrderStatus.AppDelivering) && (
        <TouchableOpacity
          style={[styles.actionButton, styles.proofButton]}
          onPress={onDeliveryProof}
        >
          <Ionicons name="camera" size={18} color="#FFF" />
          <Text style={styles.actionButtonText}>Preuve de livraison</Text>
        </TouchableOpacity>
      )}

      {order.status === OrderStatus.Delivered && order.deliveredAt && (
        <View style={styles.deliveredInfo}>
          <Ionicons name="checkmark-done" size={16} color="#059669" />
          <Text style={styles.deliveredText}>
            Livrée le {formatDate(order.deliveredAt)}
          </Text>
        </View>
      )}

      {order.status === OrderStatus.PaymentOK && driverLocation && (
        <View style={styles.driverTrackingBanner}>
            <Ionicons name="car" size={16} color="#10B981" />
            <Text style={styles.driverTrackingText}>Livreur en route vers le client</Text>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
    orderCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
      },
      orderCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      },
      orderId: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
      },
      orderDate: {
        fontSize: 12,
        color: '#64748B',
      },
      statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
      },
      statusText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
      },
      customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
      },
      customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
      },
      contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#EFF6FF',
      },
      contactText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3B82F6',
      },
      deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 8,
      },
      deliveryAddress: {
        fontSize: 14,
        color: '#475569',
        flex: 1,
        lineHeight: 20,
      },
      amountContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
      },
      amountLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
      },
      amountValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
      },
      itemsContainer: {
        marginBottom: 16,
      },
      itemsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
      },
      itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      },
      itemName: {
        fontSize: 14,
        color: '#4B5563',
      },
      itemDetails: {
        fontSize: 14,
        color: '#6B7280',
      },
      actionButtons: {
        flexDirection: 'column',
        gap: 12,
      },
      actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
      },
      sellerDeliveryButton: {
        backgroundColor: '#3B82F6',
      },
      assignDriverButton: {
        backgroundColor: '#10B981',
      },
      proofButton: {
        backgroundColor: '#10B981',
      },
      actionButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
      },
      deliveredInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
      },
      deliveredText: {
        fontSize: 14,
        color: '#065F46',
        fontWeight: '500',
      },
      driverTrackingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        marginTop: 12,
      },
      driverTrackingText: {
        fontSize: 14,
        color: '#065F46',
        fontWeight: '500',
      },
});

export default OrderCard;
export { Order, OrderStatus, DeliveryMethod, Coordinates, OrderItem, Driver };


