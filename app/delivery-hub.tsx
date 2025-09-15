import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { AntDesign, Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface Order {
  id: string;
  buyerCity: string;
  buyerName: string;
  totalAmount: number;
  status: string;
  items: { name: string; quantity: number }[];
}

interface GroupedOrders {
  [city: string]: Order[];
}

const DeliveryHubScreen = () => {
  const { authUser } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
  const [shipmentModalVisible, setShipmentModalVisible] = useState(false);
  const [shipmentDetails, setShipmentDetails] = useState({
    agency: '',
    trackingNumber: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('sellerId', '==', authUser.id),
        where('status', 'in', ['confirmed', 'pending'])
      );
      const querySnapshot = await getDocs(q);
      const fetchedOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
      Alert.alert("Erreur", "Impossible de charger les commandes à expédier.");
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const groupedOrders = useMemo<GroupedOrders>(() => {
    return orders.reduce((acc, order) => {
      const city = order.buyerCity || 'Ville non spécifiée';
      if (!acc[city]) {
        acc[city] = [];
      }
      acc[city].push(order);
      return acc;
    }, {} as GroupedOrders);
  }, [orders]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCreateShipment = async () => {
    if (Object.values(selectedOrders).every(v => !v)) {
      Alert.alert("Aucune commande", "Veuillez sélectionner au moins une commande.");
      return;
    }
    setShipmentModalVisible(true);
  };

  const submitShipment = async () => {
    if (!shipmentDetails.agency.trim()) {
      Alert.alert("Champ requis", "Veuillez entrer le nom de l'agence de fret.");
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const orderIdsToUpdate = Object.keys(selectedOrders).filter(id => selectedOrders[id]);

      // 1. Create a new shipment document
      await addDoc(collection(db, 'shipments'), {
        sellerId: authUser?.id,
        agency: shipmentDetails.agency,
        trackingNumber: shipmentDetails.trackingNumber,
        notes: shipmentDetails.notes,
        orderIds: orderIdsToUpdate,
        createdAt: serverTimestamp(),
        status: 'in_transit',
      });

      // 2. Update the status of each order in the shipment
      orderIdsToUpdate.forEach(orderId => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { status: 'shipped' });
      });

      await batch.commit();

      Alert.alert("Succès", "Le lot d'expédition a été créé et les commandes ont été mises à jour.");
      setShipmentModalVisible(false);
      setSelectedOrders({});
      setShipmentDetails({ agency: '', trackingNumber: '', notes: '' });
      fetchOrders(); // Refresh the list

    } catch (error) {
      console.error("Erreur création expédition:", error);
      Alert.alert("Erreur", "Impossible de créer le lot d'expédition.");
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text>Chargement des commandes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Hub de Livraison' }} />
      <View style={styles.header}>
        <Text style={styles.title}>Hub de Livraison</Text>
        <Text style={styles.subtitle}>Organisez vos expéditions interurbaines</Text>
      </View>
      <FlatList
        data={Object.keys(groupedOrders)}
        keyExtractor={city => city}
        renderItem={({ item: city }) => (
          <View style={styles.citySection}>
            <Text style={styles.cityTitle}>{city} ({groupedOrders[city].length})</Text>
            {groupedOrders[city].map(order => (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, selectedOrders[order.id] && styles.selectedCard]}
                onPress={() => toggleOrderSelection(order.id)}
              >
                <View style={styles.checkbox}>
                  <AntDesign
                    name={selectedOrders[order.id] ? 'checksquare' : 'checksquareo'}
                    size={24}
                    color={selectedOrders[order.id] ? '#6C63FF' : '#aaa'}
                  />
                </View>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderId}>ID: #{order.id.slice(0, 7)}</Text>
                  <Text style={styles.orderText}>Acheteur: {order.buyerName}</Text>
                  <Text style={styles.orderText}>Total: {order.totalAmount.toLocaleString()} CDF</Text>
                  <Text style={styles.orderStatus}>Statut: {order.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.centered}>
            <Feather name="package" size={50} color="#ccc" />
            <Text style={styles.emptyText}>Aucune commande à expédier pour le moment.</Text>
          </View>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreateShipment}>
        <Feather name="truck" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={shipmentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShipmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Créer un Lot d'Expédition</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom de l'agence de fret"
              value={shipmentDetails.agency}
              onChangeText={text => setShipmentDetails(prev => ({ ...prev, agency: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Numéro de suivi (optionnel)"
              value={shipmentDetails.trackingNumber}
              onChangeText={text => setShipmentDetails(prev => ({ ...prev, trackingNumber: text }))}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Notes (optionnel)"
              value={shipmentDetails.notes}
              onChangeText={text => setShipmentDetails(prev => ({ ...prev, notes: text }))}
              multiline
            />
            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.disabledButton]}
              onPress={submitShipment}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmer l'Expédition</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShipmentModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: '#666' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 4 },
  emptyText: { marginTop: 10, fontSize: 16, color: '#888' },
  citySection: { margin: 15, backgroundColor: '#fff', borderRadius: 10, padding: 15, elevation: 2 },
  cityTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  orderCard: { flexDirection: 'row', padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  selectedCard: { borderColor: '#6C63FF', borderWidth: 2, backgroundColor: '#f0f0ff' },
  checkbox: { marginRight: 15, justifyContent: 'center' },
  orderDetails: { flex: 1 },
  orderId: { fontWeight: 'bold', fontSize: 16 },
  orderText: { color: '#555', marginTop: 2 },
  orderStatus: { fontStyle: 'italic', color: '#888', marginTop: 4 },
  fab: { position: 'absolute', right: 30, bottom: 30, backgroundColor: '#6C63FF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalView: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: '#6C63FF', padding: 15, borderRadius: 10, alignItems: 'center', width: '100%', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#eee' },
  disabledButton: { backgroundColor: '#ccc' },
});

export default DeliveryHubScreen;
