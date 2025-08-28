import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, collection, query, where, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import MapView, { Marker, Polyline, Circle, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';

// Définir les interfaces pour les coordonnées et la caméra afin d'éviter les erreurs TypeScript
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Camera {
  center: Coordinates;
  pitch: number;
  heading: number;
  zoom: number;
  altitude: number;
}

// Helper function pour simuler une distance et un temps de trajet
const haversineDistance = (coords1: Coordinates, coords2: Coordinates): number => {
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const R = 6371; // Rayon de la Terre en km

  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.latitude)) *
      Math.cos(toRad(coords2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance en km
};

// Définir le type UserType
interface UserType {
  id: string;
  role: string;
  isSellerVerified?: boolean;
}

// Définir la structure d'une commande
interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLocation: string;
  deliveryCoordinates: { latitude: number; longitude: number };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: string;
  deliveryType: string;
  createdAt: any;
  deliveryMethod?: 'app_delivery' | 'seller_delivery';
  paymentStatus?: string;
  sellerId?: string;
}

// Définir les types des props pour le composant de la modale de carte
interface MapModalProps {
  order: Order | null;
  onClose: () => void;
}

// Définir les types des props pour le composant de la modale de confirmation
interface ConfirmationModalProps {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const { width, height } = Dimensions.get('window');

const SellerDeliveryManagement = () => {
  const { authUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  // Récupérer la localisation de l'utilisateur
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Permission de localisation refusée');
          return;
        }
        const locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (newLocation) => {
            setCurrentLocation(newLocation);
          }
        );
        return () => {
          if (locationSubscription) {
            locationSubscription.remove();
          }
        };
      } catch (error) {
        console.error("Erreur lors de la récupération de la localisation:", error);
      }
    })();
  }, []);

  // Chargement et écoute des commandes
  useEffect(() => {
    if (authLoading || !authUser) {
      setLoading(true);
      return;
    }
    
    // Assurez-vous que l'utilisateur est un vendeur
    if (authUser.isSellerVerified !== true) {
        setLoading(false);
        setOrders([]);
        return;
    }

    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', authUser.id),
      where('status', 'in', ['confirmed', 'seller_delivering']),
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData: Order[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Order));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Erreur lors de la récupération des commandes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, authUser, authLoading]);

  const handleConfirmDelivery = (order: Order) => {
    setSelectedOrder(order);
    setIsConfirmationModalVisible(true);
  };

  const handleDeliveryCompletion = async () => {
    if (!selectedOrder) return;

    try {
      setProcessingOrder(selectedOrder.id);
      const orderRef = doc(db, 'orders', selectedOrder.id);

      await updateDoc(orderRef, {
        status: 'delivered',
        paymentStatus: 'paid',
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Réinitialiser les états après succès
      setProcessingOrder(null);
      setSelectedOrder(null);
      setIsConfirmationModalVisible(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la commande:', error);
      setProcessingOrder(null);
    }
  };

  // Composant de modale de carte
  const MapModalComponent = ({ order, onClose }: MapModalProps) => {
    if (!order || !currentLocation) return null;

    const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');
    const [showTraffic, setShowTraffic] = useState(false);

    const deliveryCoords = order.deliveryCoordinates;
    const driverCoords = currentLocation.coords;

    // Correction de l'erreur TypeScript en s'assurant que `driverCoords` et `deliveryCoords` sont du bon type
    const distanceKm = haversineDistance(driverCoords, deliveryCoords).toFixed(2);
    // Simule une vitesse moyenne de 30 km/h
    const etaMinutes = Math.round((parseFloat(distanceKm) / 30) * 60);

    // Fonction pour appeler le client
    const handleCallCustomer = () => {
      if (order.customerPhone) {
        Linking.openURL(`tel:${order.customerPhone}`);
      }
    };

    // Corrections d'erreurs: Utiliser await pour obtenir les données de la caméra de manière asynchrone
    const handleZoomIn = async () => {
      const camera = await mapRef.current?.getCamera();
      if (camera && camera.zoom !== undefined) {
        mapRef.current?.animateCamera({
          zoom: camera.zoom + 1,
        }, { duration: 500 });
      }
    };

    const handleZoomOut = async () => {
      const camera = await mapRef.current?.getCamera();
      if (camera && camera.zoom !== undefined) {
        mapRef.current?.animateCamera({
          zoom: camera.zoom - 1,
        }, { duration: 500 });
      }
    };

    const handleRecenter = () => {
        mapRef.current?.animateToRegion({
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        });
    };

    // Pour simuler un itinéraire plus réaliste, ajoutez des coordonnées intermédiaires
    // Dans une application réelle, vous utiliseriez un service d'itinéraire (Google Directions, etc.)
    const simulatedRoute = [
      { latitude: driverCoords.latitude, longitude: driverCoords.longitude },
      { latitude: driverCoords.latitude + (deliveryCoords.latitude - driverCoords.latitude) * 0.3, longitude: driverCoords.longitude + (deliveryCoords.longitude - driverCoords.longitude) * 0.1 },
      { latitude: driverCoords.latitude + (deliveryCoords.latitude - driverCoords.latitude) * 0.7, longitude: driverCoords.longitude + (deliveryCoords.longitude - driverCoords.longitude) * 0.9 },
      { latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude }
    ];

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!order}
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Suivi de la livraison</Text>
          </View>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: (driverCoords.latitude + deliveryCoords.latitude) / 2,
                longitude: (driverCoords.longitude + deliveryCoords.longitude) / 2,
                latitudeDelta: Math.abs(driverCoords.latitude - deliveryCoords.latitude) * 2,
                longitudeDelta: Math.abs(driverCoords.longitude - deliveryCoords.longitude) * 2,
              }}
              mapType={mapType}
              showsTraffic={showTraffic}
              onMapReady={() => {
                if (mapRef.current) {
                  const coordinates = [
                    { latitude: driverCoords.latitude, longitude: driverCoords.longitude },
                    { latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude }
                  ];
                  mapRef.current.fitToCoordinates(coordinates, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                  });
                }
              }}
            >
              {/* Cercle de précision de la position */}
              <Circle
                center={driverCoords}
                radius={currentLocation?.coords.accuracy || 20}
                fillColor="rgba(108, 99, 255, 0.2)"
                strokeColor="rgba(108, 99, 255, 0.5)"
              />
              
              {/* Marqueur du livreur */}
              <Marker
                coordinate={{ latitude: driverCoords.latitude, longitude: driverCoords.longitude }}
                title="Votre position"
                description="Position actuelle du livreur"
              >
                <View style={styles.markerContainer}>
                  <Ionicons name="car-sport" size={32} color="#6C63FF" />
                </View>
                <Callout tooltip>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutText}>Vous êtes ici</Text>
                  </View>
                </Callout>
              </Marker>
              
              {/* Marqueur du client */}
              <Marker
                coordinate={{ latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude }}
                title="Client"
                description="Adresse de livraison du client"
              >
                <View style={styles.markerContainer}>
                  <Ionicons name="home" size={32} color="#28a745" />
                </View>
                <Callout tooltip>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutText}>Livraison</Text>
                    <Text style={styles.calloutText}>Client: {order.customerName}</Text>
                  </View>
                </Callout>
              </Marker>

              {/* Ligne de route */}
              <Polyline
                coordinates={simulatedRoute}
                strokeColor="#6C63FF"
                strokeWidth={5}
                lineDashPattern={[10, 5]}
              />
            </MapView>

            {/* Contrôles de la carte */}
            <View style={styles.mapControls}>
                <View style={styles.zoomControls}>
                    <TouchableOpacity style={styles.controlButton} onPress={handleZoomIn}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlButton} onPress={handleZoomOut}>
                        <Ionicons name="remove" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.controlButton} onPress={handleRecenter}>
                    <Ionicons name="locate" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Type de carte et trafic */}
            <View style={styles.mapOptions}>
                <TouchableOpacity
                    style={[styles.mapOptionButton, mapType === 'standard' && styles.mapOptionButtonActive]}
                    onPress={() => setMapType('standard')}
                >
                    <Text style={styles.mapOptionText}>Standard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.mapOptionButton, mapType === 'satellite' && styles.mapOptionButtonActive]}
                    onPress={() => setMapType('satellite')}
                >
                    <Text style={styles.mapOptionText}>Satellite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.mapOptionButton, showTraffic && styles.mapOptionButtonActive]}
                    onPress={() => setShowTraffic(!showTraffic)}
                >
                    <Text style={styles.mapOptionText}>Trafic</Text>
                </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mapDetails}>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>Client:</Text> {order.customerName}</Text>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>Adresse:</Text> {order.deliveryAddress}</Text>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>Total à encaisser:</Text> {order.totalAmount} CDF</Text>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>Distance:</Text> {distanceKm} km</Text>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>ETA:</Text> {etaMinutes} min</Text>
            <Text style={styles.mapDetailText}><Text style={styles.boldText}>Articles:</Text></Text>
            {order.items.map((item, index) => (
                <Text key={index} style={styles.itemText}>- {item.name} ({item.quantity})</Text>
            ))}

            <View style={styles.detailButtons}>
              <TouchableOpacity
                onPress={handleCallCustomer}
                style={[styles.detailButton, styles.callButton]}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.detailButtonText}>Appeler le client</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleConfirmDelivery(order)}
                style={[styles.detailButton, styles.confirmButton]}
                disabled={processingOrder === order.id}
              >
                <Text style={styles.detailButtonText}>Confirmer la livraison</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // Composant de modale de confirmation
  const ConfirmationModal = ({ order, visible, onClose, onConfirm }: ConfirmationModalProps) => {
    if (!order) return null;
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Confirmer la livraison</Text>
            <Text style={styles.modalText}>
              Êtes-vous sûr de vouloir marquer cette commande comme livrée ?
            </Text>
            <Text style={styles.modalText}>
              Client: <Text style={styles.boldText}>{order.customerName}</Text>
            </Text>
            <Text style={styles.modalText}>
              Total: <Text style={styles.boldText}>{order.totalAmount} CDF</Text>
            </Text>
            <Text style={styles.modalText}>
              Articles: <Text style={styles.boldText}>{order.items.map(i => i.name).join(', ')}</Text>
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonClose]}
                onPress={onClose}
              >
                <Text style={styles.textStyle}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonConfirm]}
                onPress={onConfirm}
                disabled={processingOrder === order.id}
              >
                {processingOrder === order.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.textStyle}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <Text style={styles.orderId}>Commande #{item.id.slice(-6)}</Text>
      <Text style={styles.customerName}>Client: {item.customerName}</Text>
      <Text style={styles.deliveryAddress}>Livraison à: {item.deliveryAddress}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.totalAmount}>Total: {item.totalAmount} CDF</Text>
        {item.deliveryMethod === 'seller_delivery' && item.status === 'seller_delivering' && (
          <TouchableOpacity
            onPress={() => setSelectedOrder(item)}
            style={styles.mapButton}
          >
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapButtonText}>Voir la carte</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement en cours...</Text>
      </SafeAreaView>
    );
  }

  // Vérifier si l'utilisateur est un vendeur et a le rôle approprié
  if (!authUser || authUser.isSellerVerified !== true) {
    return (
      <SafeAreaView style={styles.noOrdersContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#999" />
        <Text style={styles.noOrdersText}>Accès non autorisé</Text>
        <Text style={styles.noOrdersSubText}>Cette page est réservée aux vendeurs vérifiés.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Livraisons</Text>
      </View>
      {orders.length === 0 ? (
        <View style={styles.noOrdersContainer}>
          <Ionicons name="cart-outline" size={64} color="#999" />
          <Text style={styles.noOrdersText}>Aucune commande à livrer</Text>
          <Text style={styles.noOrdersSubText}>Les commandes de vos clients apparaîtront ici une fois confirmées.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
      <MapModalComponent order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <ConfirmationModal
        visible={isConfirmationModalVisible}
        order={selectedOrder}
        onClose={() => setIsConfirmationModalVisible(false)}
        onConfirm={handleDeliveryCompletion}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    padding: 10,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noOrdersText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  noOrdersSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 10,
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    width: '100%',
    height: '60%',
    alignSelf: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapDetails: {
    padding: 15,
  },
  mapDetailText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  // Styles pour les modales personnalisées
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalButton: {
    borderRadius: 20,
    padding: 12,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonClose: {
    backgroundColor: '#888',
  },
  buttonConfirm: {
    backgroundColor: '#6C63FF',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Nouveaux styles pour les contrôles de la carte
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  zoomControls: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    marginBottom: 10,
  },
  controlButton: {
    padding: 10,
  },
  mapOptions: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  mapOptionButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  mapOptionButtonActive: {
    backgroundColor: '#6C63FF',
  },
  mapOptionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
    alignItems: 'center',
  },
  calloutText: {
    fontSize: 14,
    color: '#333',
  },
  detailButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 25,
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  detailButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  callButton: {
    backgroundColor: '#6C63FF',
  },
  itemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
});

export default SellerDeliveryManagement;
