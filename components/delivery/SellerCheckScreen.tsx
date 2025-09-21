import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase/config';
import { useAppState } from '../../hooks/useAppState';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Linking,
    Modal,
    PanResponder,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import uuid from 'react-native-uuid';
import { WebView } from 'react-native-webview';
import ConnectionStatusBar from './ConnectionStatusBar';
import DriverModal from './DriverModal';
import OrderCard, {
    DeliveryMethod,
    Driver,
    formatCurrency,
    Order,
    OrderStatus,
} from './OrderCard';
import PaymentModal from './PaymentModal';
import SignatureModal from './SignatureModal';

// Conditional import for react-native-maps
let MapView: any;
let Marker: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} else {
  // Provide a mock component for the web
  MapView = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>La vue de la carte n'est pas disponible sur le web.</Text>
    </View>
  );
  Marker = () => null;
  PROVIDER_GOOGLE = null;
}

const { height } = Dimensions.get('window');

// Main Component
const SellerCheckScreen: React.FC = () => {
  const { authUser, loading: authLoading } = useAuth();
  const { location, error: locationError } = useLiveLocation(true);
  const appState = useAppState();
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const mapRef = useRef<typeof MapView>(null);
  const [highlightedDriver, setHighlightedDriver] = useState<Driver | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverDepositId, setDriverDepositId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isPaymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
  const [isSignatureModalVisible, setSignatureModalVisible] = useState<boolean>(false);
  const [isDriverModalVisible, setDriverModalVisible] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const focusOnDriver = (driver: Driver) => {
    if (!driver.liveLatitude || !driver.liveLongitude) return;

    setDriverModalVisible(false);

    mapRef.current?.animateToRegion({
      latitude: driver.liveLatitude,
      longitude: driver.liveLongitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    setHighlightedDriver(driver);
  };

  const sheetAnim = useRef(new Animated.Value(height)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeBottomSheet();
        } else {
          openBottomSheet();
        }
      },
    })
  ).current;

  const openBottomSheet = useCallback(() => {
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start();
  }, [sheetAnim]);

  const closeBottomSheet = useCallback(() => {
    Animated.spring(sheetAnim, {
      toValue: height,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start(() => setSelectedOrder(null));
  }, [sheetAnim]);

  useEffect(() => {
    if (selectedOrder) {
      openBottomSheet();
    } else {
      closeBottomSheet();
    }
  }, [selectedOrder, openBottomSheet, closeBottomSheet]);

  // Load orders
  useEffect(() => {
    if (!authUser?.id) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', authUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      snapshot => {
        const ordersData: Order[] = [];
        snapshot.forEach(doc => {
          ordersData.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(ordersData);
        setLoading(false);
        setRefreshing(false);
      },
      error => {
        console.error('Firestore orders error', error)
        Alert.alert('Erreur', 'Erreur de chargement des commandes');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [authUser]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);
  // Load available drivers
  useEffect(() => {
    if (!authUser?.id || !location) return;

    const driversQuery = query(
      collection(db, 'users'),
      where('role', '==', 'driver'),
      where('isAvailable', '==', true)
    );

    const unsubscribe = onSnapshot(driversQuery, snapshot => {
      const driversData: Driver[] = [];
      snapshot.forEach(doc => {
        const driverData = doc.data();
        if (driverData.liveLatitude && driverData.liveLongitude) {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            driverData.liveLatitude,
            driverData.liveLongitude
          ).toFixed(1);

          if (parseFloat(distance) < 5) {
            // Only within 5km radius
            driversData.push({
              id: doc.id,
              name: driverData.name || 'Livreur',
              phoneNumber: driverData.phoneNumber || '',
              liveLatitude: driverData.liveLatitude,
              liveLongitude: driverData.liveLongitude,
              distance,
              isAvailable: driverData.isAvailable || false,
            });
          }
        }
      });
      setAvailableDrivers(driversData);
    });

    return unsubscribe;
  }, [authUser, location]);

  // Update seller location for active deliveries
  useEffect(() => {
    if (!location || !authUser?.id || orders.length === 0) return;

    const updatePromises = orders
      .filter(
        order =>
          order.status === OrderStatus.SellerDelivering ||
          order.status === OrderStatus.AppDelivering
      )
      .map(order =>
        updateDoc(doc(db, 'orders', order.id), {
          sellerLiveLatitude: location.coords.latitude,
          sellerLiveLongitude: location.coords.longitude,
          updatedAt: serverTimestamp(),
        }).catch(error => {
          console.error('Error updating location for order:', order.id, error);
        })
      );

    Promise.all(updatePromises).catch(error => {
      console.error('Error updating locations:', error);
    });
  }, [location, orders, authUser]);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedOrder?.driverId) return;

    const unsub = onSnapshot(doc(db, 'users', selectedOrder.driverId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.liveLatitude && data.liveLongitude) {
          setDriverLocation({
            latitude: data.liveLatitude,
            longitude: data.liveLongitude,
          });
        }
      }
    });

    return () => unsub();
  }, [selectedOrder?.driverId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const WORKER_ROOT = 'https://yass-webhook.israelntalu328.workers.dev';

  const startPayment = () => {
    if (!authUser?.id) return Alert.alert('Erreur', 'Non connecté');
    setPaymentVisible(true);
  };

  const handleNavChange = (nav: any) => {
    const { url } = nav;
    if (url.includes(`${WORKER_ROOT}/payment-return`)) {
      const id = new URL(url).searchParams.get('depositId');
      if (id) {
        setDepositId(id);
        setPaymentVisible(false);
        pollStatus(id);
      }
    }
  };

  const pollStatus = (id: string) => {
    let tries = 0;
    const max = 20;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const r = await fetch(`${WORKER_ROOT}/check-payment/${id}`);
        if (!r.ok) throw new Error('net');
        const { status } = await r.json();
        const st = String(status).toUpperCase();

        if (['SUCCESS', 'SUCCESSFUL'].includes(st)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }

          if (selectedOrder?.id) {
            await updateDoc(doc(db, 'orders', selectedOrder.id), {
              status: 'payment_ok',
              updatedAt: serverTimestamp(),
            });
            Alert.alert('✅ Paiement confirmé', 'La course est payée.');
          } else {
            console.error(
              'pollStatus: selectedOrder or its ID is missing when trying to update payment status.'
            );
            Alert.alert('Erreur', 'Impossible de mettre à jour la commande, ID manquant.');
          }
          return;
        }

        if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'ERROR'].includes(st)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          Alert.alert('Paiement échoué', 'Le paiement a été refusé/annulé.');
          return;
        }
      } catch {
        // ignore
      }

      if (tries >= max) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        Alert.alert('⏱ Délai dépassé', 'Paiement non confirmé.');
      }
    }, 3000);
  };

  const handleAppDeliverySelection = useCallback(async () => {
    if (!selectedOrder || !authUser?.id) return;

    if (!selectedOrder.deliveryCoordinates) {
      Alert.alert('Erreur de données', 'Les coordonnées de livraison pour cette commande sont manquantes.');
      return;
    }

    const depositId = uuid.v4() as string;

    try {
      await runTransaction(db, async transaction => {
        const orderRef = doc(db, 'orders', selectedOrder.id);
        const snap = await transaction.get(orderRef);

        if (!snap.exists()) throw new Error('La commande n’existe plus');
        const data = snap.data() as Order;

        if (data.status !== OrderStatus.PendingDeliveryChoice) {
          throw new Error('Le statut de la commande a changé');
        }

        transaction.update(orderRef, {
          status: OrderStatus.AppDelivering,
          deliveryMethod: DeliveryMethod.AppDelivery,
          sellerDepositId: depositId,
          updatedAt: serverTimestamp(),
        });

        const deliveryRef = doc(collection(db, 'deliveries'));
        transaction.set(deliveryRef, {
          orderId: selectedOrder.id,
          sellerId: authUser.id,
          sellerName: authUser.email || 'Vendeur',
          sellerPhone: authUser.phoneNumber || 'N/A',
          sellerLat: location?.coords.latitude,
          sellerLng: location?.coords.longitude,
          buyerName: selectedOrder.customerName,
          customerPhone: selectedOrder.customerPhone,
          address: selectedOrder.deliveryAddress,
          lat: selectedOrder.deliveryCoordinates.latitude,
          lng: selectedOrder.deliveryCoordinates.longitude,
          amountCDF: selectedOrder.totalAmountCDF,
          sellerDepositId: depositId,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      });

      setOrders(prev =>
        prev.map(o =>
          o.id === selectedOrder.id
            ? {
                ...o,
                status: OrderStatus.AppDelivering,
                deliveryMethod: DeliveryMethod.AppDelivery,
                sellerDepositId: depositId,
              }
            : o
        )
      );

      closeBottomSheet();
      startPayment();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  }, [selectedOrder, authUser, closeBottomSheet, location]);

  const handleSellerDeliverySelection = useCallback(async () => {
    if (!selectedOrder) return;

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        status: OrderStatus.SellerDelivering,
        deliveryMethod: DeliveryMethod.SellerDelivery,
        updatedAt: serverTimestamp(),
      });

      setOrders(prev =>
        prev.map(o =>
          o.id === selectedOrder.id
            ? { ...o, status: OrderStatus.SellerDelivering, deliveryMethod: DeliveryMethod.SellerDelivery }
            : o
        )
      );

      closeBottomSheet();
      Alert.alert('Succès', 'Vous allez maintenant livrer cette commande vous-même.');
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de sélectionner la livraison personnelle.');
    }
  }, [selectedOrder, closeBottomSheet]);

  const handleAssignDriver = useCallback(
    async (driver: Driver) => {
      if (!selectedOrder || !authUser?.id) return;

      if (!selectedOrder.deliveryCoordinates) {
        Alert.alert('Erreur de données', 'Les coordonnées de livraison pour cette commande sont manquantes.');
        return;
      }

      try {
        await addDoc(collection(db, 'deliveries'), {
          orderId: selectedOrder.id,
          sellerId: authUser.id,
          sellerName: authUser.email || 'Vendeur',
          sellerPhone: authUser.phoneNumber || 'N/A',
          sellerLat: location?.coords.latitude,
          sellerLng: location?.coords.longitude,
          driverId: driver.id,
          driverName: driver.name,
          driverPhone: driver.phoneNumber,
          buyerName: selectedOrder.customerName,
          customerPhone: selectedOrder.customerPhone,
          address: selectedOrder.deliveryAddress,
          lat: selectedOrder.deliveryCoordinates.latitude,
          lng: selectedOrder.deliveryCoordinates.longitude,
          amountCDF: selectedOrder.totalAmountCDF ?? 0,
          status: 'pending',
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'orders', selectedOrder.id), {
          status: OrderStatus.PaymentOK,
          updatedAt: serverTimestamp(),
        });

        setOrders(prev =>
          prev.map(order =>
            order.id === selectedOrder.id ? { ...order, status: OrderStatus.PaymentOK } : order
          )
        );

        setDriverModalVisible(false);
        closeBottomSheet();
        Alert.alert('Succès', `Le livreur ${driver.name} a été assigné à la commande.`);
      } catch (error) {
        Alert.alert("Erreur", "Impossible d'assigner le livreur.");
      }
    },
    [selectedOrder, authUser, closeBottomSheet, location]
  );

  const handlePaymentSuccess = useCallback(async () => {
    if (!selectedOrder) return;

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        status: OrderStatus.PaymentOK,
        updatedAt: serverTimestamp(),
      });

      setOrders(prev =>
        prev.map(order =>
          order.id === selectedOrder.id ? { ...order, status: OrderStatus.PaymentOK } : order
        )
      );

      Alert.alert('Paiement confirmé', 'La course est maintenant disponible pour les livreurs.');
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Paiement réussi mais erreur de mise à jour. Contactez le support.'
      );
    }
  }, [selectedOrder]);

  const handlePaymentFailure = useCallback((error: string) => {
    Alert.alert('Échec du paiement', error);
  }, []);

  const handleDeliveryProof = useCallback(async () => {
    if (!selectedOrder || isUploading) return;

    // Import ImagePicker from expo-image-picker at the top of your file:
    // import * as ImagePicker from 'expo-image-picker';

    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      Alert.alert(
        'Permission requise',
        "L'application a besoin d'accéder à votre caméra pour prendre une preuve de livraison."
      );
      return;
    }

    setIsUploading(true);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        setIsUploading(false);
        return;
      }

      const imageUri = result.assets[0].uri;
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const imageName = `delivery_proofs/${selectedOrder.id}_${Date.now()}.jpg`;
      const storageRef = ref(storage, imageName);

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      setSignatureModalVisible(true);

      const completeDeliveryProof = async (signature: string) => {
        try {
          await updateDoc(doc(db, 'orders', selectedOrder.id), {
            status: OrderStatus.Delivered,
            proofImageUrl: downloadUrl,
            proofSignatureUrl: signature,
            proofGpsTimestamp: serverTimestamp(),
            deliveredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setOrders(prev =>
            prev.map(order =>
              order.id === selectedOrder.id
                ? {
                    ...order,
                    status: OrderStatus.Delivered,
                    proofImageUrl: downloadUrl,
                    proofSignatureUrl: signature,
                    deliveredAt: Timestamp.now(),
                  }
                : order
            )
          );

          closeBottomSheet();
          Alert.alert(
            'Livraison confirmée',
            'La preuve de livraison a été enregistrée avec succès.'
          );
        } catch (error) {
          Alert.alert(
            'Erreur',
            "Erreur lors de l'enregistrement de la preuve de livraison."
          );
        } finally {
          setIsUploading(false);
        }
      };

      // Simulating signature for now
      setTimeout(() => {
        setSignatureModalVisible(false);
        completeDeliveryProof('Signature client');
      }, 2000);
    } catch (error) {
      setIsUploading(false);
      Alert.alert(
        'Erreur',
        'Erreur lors de la prise de photo. Veuillez réessayer.'
      );
    }
  }, [selectedOrder, isUploading, closeBottomSheet]);

  const handleContactCustomer = useCallback((phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Erreur', 'Impossible de passer un appel');
    });
  }, []);

  const getMarkerColor = (status: OrderStatus): string => {
    switch (status) {
      case OrderStatus.PendingDeliveryChoice: return '#F59E0B'; // Amber
      case OrderStatus.SellerDelivering: return '#3B82F6'; // Blue
      case OrderStatus.AppDelivering: return '#8B5CF6'; // Violet
      case OrderStatus.PaymentOK: return '#10B981'; // Emerald
      case OrderStatus.Delivered: return '#059669'; // Green
      case OrderStatus.Cancelled: return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Vérification de l'authentification...</Text>
      </View>
    );
  }

  if (!authUser) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="log-in-outline" size={64} color="#CBD5E1" />
        <Text style={styles.emptyStateText}>Connexion requise</Text>
        <Text style={styles.emptyStateSubtext}>
          Veuillez vous connecter pour accéder à cet écran.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Chargement des commandes...</Text>
        {locationError && <Text style={styles.warningText}>{locationError}</Text>}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <ConnectionStatusBar isOnline={appState.isOnline} isBatteryLow={appState.isBatteryLow} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={() => setViewMode(prev => (prev === 'map' ? 'list' : 'map'))}
          >
            <Ionicons name={viewMode === 'map' ? 'list' : 'map'} size={24} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
           <Text>La carte est temporairement désactivée pour le débogage.</Text>
           {/*
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={{
              latitude: location?.coords.latitude || -4.322447,
              longitude: location?.coords.longitude || 15.307045,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            followsUserLocation={true}
          >
            {availableDrivers
              .filter(d => d.id !== highlightedDriver?.id)
              .map(driver => (
                <Marker
                  key={driver.id}
                  coordinate={{
                    latitude: driver.liveLatitude,
                    longitude: driver.liveLongitude,
                  }}
                  title={driver.name}
                  description={`Tel: ${driver.phoneNumber}`}
                  onPress={() => {
                    setHighlightedDriver(driver);
                    mapRef.current?.animateToRegion(
                      {
                        latitude: driver.liveLatitude,
                        longitude: driver.liveLongitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      },
                      500
                    );
                  }}
                >
                  <View style={styles.driverMapMarker}>
                    <Ionicons name="car-sport" size={20} color="#FFF" />
                  </View>
                </Marker>
              ))}

            {highlightedDriver && (
              <Marker
                coordinate={{
                  latitude: highlightedDriver.liveLatitude,
                  longitude: highlightedDriver.liveLongitude,
                }}
                title={`${highlightedDriver.name} (sélectionné)`}
                pinColor="gold"
                zIndex={999}
              >
                <View style={styles.highlightedMarker}>
                  <Ionicons name="star" size={24} color="#FFF" />
                </View>
              </Marker>
            )}
            {driverLocation && (
              <Marker coordinate={driverLocation} title="Livreur en route" pinColor="#10B981">
                <View style={styles.driverMarker}>
                  <Ionicons name="car" size={20} color="#FFF" />
                </View>
              </Marker>
            )}
            {orders.map(order => (
              <Marker
                key={order.id}
                coordinate={order.deliveryCoordinates}
                pinColor={getMarkerColor(order.status)}
                onPress={() => setSelectedOrder(order)}
              >
                <View style={styles.markerContainer}>
                  <View style={[styles.marker, { backgroundColor: getMarkerColor(order.status) }]}>
                    <Text style={styles.markerText}>
                      {formatCurrency(order.totalAmountCDF / 1000)}K
                    </Text>
                  </View>
                  <View
                    style={[styles.markerArrow, { borderTopColor: getMarkerColor(order.status) }]}
                  />
                </View>
              </Marker>
            ))}
          </MapView>
          */}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedOrder(item)}>
              <OrderCard
                order={item}
                onAppDeliverySelected={handleAppDeliverySelection}
                onSellerDeliverySelected={handleSellerDeliverySelection}
                onDeliveryProof={handleDeliveryProof}
                onContactCustomer={() => handleContactCustomer(item.customerPhone)}
                onAssignDriver={() => {
                  setSelectedOrder(item);
                  setDriverModalVisible(true);
                }}
                setSelectedDriver={setSelectedDriver}
                setDriverDepositId={setDriverDepositId}
                setPaymentVisible={setPaymentVisible}
                availableDrivers={availableDrivers}
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>Aucune commande</Text>
              <Text style={styles.emptyStateSubtext}>
                Vous n'avez aucune commande en cours pour le moment.
              </Text>
            </View>
          }
        />
      )}

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: sheetAnim }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.sheetHandleArea}>
          <View style={styles.sheetHandle} />
        </View>

        {selectedOrder && (
          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <OrderCard
              order={selectedOrder}
              onAppDeliverySelected={handleAppDeliverySelection}
              onSellerDeliverySelected={handleSellerDeliverySelection}
              onDeliveryProof={handleDeliveryProof}
              onContactCustomer={() => handleContactCustomer(selectedOrder.customerPhone)}
              onAssignDriver={() => {
                setSelectedOrder(selectedOrder);
                setDriverModalVisible(true);
              }}
              setSelectedDriver={setSelectedDriver}
              setDriverDepositId={setDriverDepositId}
              setPaymentVisible={setPaymentVisible}
              availableDrivers={availableDrivers}
              driverLocation={driverLocation}
            />
          </ScrollView>
        )}
      </Animated.View>

      {selectedOrder && (
        <PaymentModal
          visible={isPaymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
          order={selectedOrder}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      )}

      <SignatureModal
        visible={isSignatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={signature => {
          console.log('Signature saved:', signature);
          setSignatureModalVisible(false);
        }}
      />

<DriverModal
  visible={isDriverModalVisible}
  onClose={() => setDriverModalVisible(false)}
  drivers={availableDrivers}
  onAssignDriver={(driver) => {
    if (selectedOrder?.status === OrderStatus.PendingDeliveryChoice) {
      // 🔥 Si pas encore payé → demander paiement avant assignation
      setSelectedDriver(driver);
      setDriverDepositId(uuid.v4() as string);
      setPaymentVisible(true);
    } else {
      // ✅ Si déjà payé → assigner direct
      handleAssignDriver(driver);
    }
  }}
  onFocusDriver={focusOnDriver}
/>

      {isUploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.uploadText}>Traitement de la preuve...</Text>
        </View>
      )}

      {paymentVisible && (
        <Modal
          visible={paymentVisible}
          animationType="slide"
          onRequestClose={() => setPaymentVisible(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#eee',
              }}
            >
              <TouchableOpacity onPress={() => setPaymentVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text
                style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' }}
              >
                Paiement course
              </Text>
              <View style={{ width: 26 }} />
            </View>

            <WebView
              source={{
                uri: `${WORKER_ROOT}/payment-page?amount=2000&currency=CDF`,
              }}
              onNavigationStateChange={handleNavChange}
              onError={e => {
                console.log('WebView error :', e.nativeEvent);
                Alert.alert('Erreur réseau', 'Impossible de joindre le serveur de paiement.');
                setPaymentVisible(false);
              }}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              renderLoading={() => (
                <View
                  style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                >
                  <ActivityIndicator size="large" color="#6C63FF" />
                  <Text>Redirection vers PawaPay…</Text>
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  warningText: {
    marginTop: 8,
    fontSize: 14,
    color: '#F59E0B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  driverMapMarker: {
    backgroundColor: '#8B5CF6', // Violet
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  driverMarker: {
    backgroundColor: '#10B981',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
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

  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  markerText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4F46E5',
    transform: [{ translateY: -2 }],
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
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
  highlightedMarker: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
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
    marginLeft: 6,
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
  appDeliveryButton: {
    backgroundColor: '#8B5CF6',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  sheetHandleArea: {
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SellerCheckScreen;