import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
  Dimensions,
  StyleSheet,
  StatusBar,
  TextInput,
} from 'react-native';
import { query, or, where, getDocs, collection, onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SignatureScreen from 'react-native-signature-canvas';
import { db } from '../../firebase/config';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

interface SellerProfile {
  id: string;
  qrCodes: {
    airtel?: string;
    orange?: string;
    mpesa?: string;
  };
}

interface Delivery {
  id: string;
  orderId: string;
  sellerId: string;
  sellerName: string;
  sellerPhone: string;
  sellerLat?: number;
  sellerLng?: number;
  deliveryRoute?: { latitude: number; longitude: number }[];
  buyerName: string;
  buyerPhone: string;
  address: string;
  lat: number;
  lng: number;
  amount: number;
  sellerDepositId: string;
  qrCodes: {
    airtel: string;
    orange: string;
    mpesa: string;
  };
  status: string;
  driverId: string;
  signature: string;
  createdAt: any;
}

interface Driver {
  id: string;
  name: string;
  phoneNumber: string;
  isAvailable: boolean;
  liveLatitude: number;
  liveLongitude: number;
}

const MapModalWebView = ({ isVisible, onClose, delivery }: { isVisible: boolean, onClose: () => void, delivery: Delivery | null }) => {
  if (!delivery) return null;

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Détails de la course</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
            body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                font-family: Arial, sans-serif;
            }
            #map {
                width: 100%;
                height: 100%;
            }
            .gm-fullscreen-control, .gm-svpc, .gmnoprint {
                display: none !important;
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            function initMap() {
                const initialLocation = { lat: ${delivery.lat}, lng: ${delivery.lng} };
                const map = new google.maps.Map(document.getElementById("map"), {
                    zoom: 16,
                    center: initialLocation,
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
                        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
                        {
                            featureType: "administrative.land_parcel",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#bdbdbd" }],
                        },
                        {
                            featureType: "poi",
                            elementType: "geometry",
                            stylers: [{ color: "#eeeeee" }],
                        },
                        {
                            featureType: "poi",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#757575" }],
                        },
                        {
                            featureType: "poi.park",
                            elementType: "geometry",
                            stylers: [{ color: "#e5e5e5" }],
                        },
                        {
                            featureType: "poi.park",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#9e9e9e" }],
                        },
                        {
                            featureType: "road",
                            elementType: "geometry",
                            stylers: [{ color: "#ffffff" }],
                        },
                        {
                            featureType: "road.arterial",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#757575" }],
                        },
                        {
                            featureType: "road.highway",
                            elementType: "geometry",
                            stylers: [{ color: "#dadada" }],
                        },
                        {
                            featureType: "road.highway",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#616161" }],
                        },
                        {
                            featureType: "road.local",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#9e9e9e" }],
                        },
                        {
                            featureType: "transit.line",
                            elementType: "geometry",
                            stylers: [{ color: "#e5e5e5" }],
                        },
                        {
                            featureType: "transit.station",
                            elementType: "geometry",
                            stylers: [{ color: "#eeeeee" }],
                        },
                        {
                            featureType: "water",
                            elementType: "geometry",
                            stylers: [{ color: "#c9c9c9" }],
                        },
                        {
                            featureType: "water",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#9e9e9e" }],
                        },
                    ],
                });
                new google.maps.Marker({
                    position: initialLocation,
                    map: map,
                    title: "Destination de la livraison",
                    animation: google.maps.Animation.DROP,
                });
            }
        </script>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDFIO7vLUTgo-jlRT2i77uHvEqoxgJfRj4&callback=initMap"></script>
    </body>
    </html>
  `;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}>
      <View style={modalStyles.centeredView}>
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>Détails de la course</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close-circle" size={30} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={modalStyles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </View>
    </Modal>
  );
};

export default function DriverScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [qrType, setQrType] = useState<'airtel' | 'orange' | 'mpesa' | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [showMapModal, setShowMapModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeImages, setQrCodeImages] = useState<{ airtel?: string; orange?: string; mpesa?: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<Driver | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handleLogin = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'driver'),
        where('phoneNumber', '==', phone),
        where('driverCode', '==', code)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data() as Driver;
        setUser({ ...userData, id: querySnapshot.docs[0].id });
        setIsLoggedIn(true);
        
        // Save to AsyncStorage
       await AsyncStorage.setItem('driver', JSON.stringify({
  ...userData,
  id: querySnapshot.docs[0].id
}));
        // Update driver availability
        await updateDoc(doc(db, 'users', querySnapshot.docs[0].id), {
          isAvailable: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        Alert.alert('Erreur', 'Numéro de téléphone ou code incorrect');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      Alert.alert('Erreur', 'Impossible de se connecter');
    }
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const driverData = await AsyncStorage.getItem('driver');
        if (driverData) {
          const parsedData = JSON.parse(driverData);
          setUser(parsedData);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      }
    };
    checkLoginStatus();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'application a besoin de votre localisation pour fonctionner');
        return;
      }

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          setCurrentLocation(location);
          
          // Update driver location in Firestore
          if (user) {
            updateDoc(doc(db, 'users', user.id), {
              liveLatitude: location.coords.latitude,
              liveLongitude: location.coords.longitude,
              lastUpdated: serverTimestamp(),
            }).catch(error => {
              console.error('Error updating location:', error);
            });
          }
        }
      );
    })();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    const q = query(
      collection(db, 'deliveries'),
      or(
        where('driverId', '==', user.id),
        where('status', '==', 'pending')
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const deliveriesData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }) as Delivery);
      setDeliveries(deliveriesData);
      setLoading(false);
    }, (error: any) => {
      console.error("Erreur Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredDeliveries = deliveries.filter(delivery => {
    if (!user?.id) return false;

    if (activeTab === 'available') return delivery.status === 'pending';
    if (activeTab === 'active') {
      return (delivery.status === 'picked_up' || delivery.status === 'payment_ok') && delivery.driverId === user.id;
    }
    if (activeTab === 'completed') {
      return delivery.status === 'delivered' && delivery.driverId === user.id;
    }
    return false;
  });

  const handleDeliveryPress = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    // Fit map to coordinates
    if (viewMode === 'map' && mapRef.current && delivery.sellerLat && delivery.sellerLng && currentLocation) {
      const coordinates = [
        { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
        { latitude: delivery.sellerLat, longitude: delivery.sellerLng },
        { latitude: delivery.lat, longitude: delivery.lng },
      ];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const handleShowQR = async () => {
    if (!selectedDelivery) return;
    setLoading(true);
    try {
      const sellerDocRef = doc(db, 'users', selectedDelivery.sellerId);
      const sellerDocSnap = await getDoc(sellerDocRef);

      if (sellerDocSnap.exists()) {
        const sellerData = sellerDocSnap.data() as SellerProfile;
        if (sellerData.qrCodes) {
          setQrCodeImages(sellerData.qrCodes);
          setShowQRModal(true);
        } else {
          Alert.alert('Erreur', 'Aucun QR code trouvé pour ce vendeur.');
        }
      } else {
        Alert.alert('Erreur', 'Profil du vendeur introuvable.');
      }
    } catch (error) {
      console.error('Erreur de récupération des QR codes:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les QR codes.');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeDelivery = async (deliveryId: string) => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour accepter une course.');
      return;
    }
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
        driverId: user.id,
        status: 'picked_up',
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Succès', 'Course acceptée avec succès! 🚗');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de prendre la course');
      console.error('Erreur lors de l\'acceptation de la course:', error);
    }
  };

  const verifyPayment = async (depositId: string) => {
    if (!selectedDelivery) return;

    try {
      const response = await fetch(
        `https://yass-webhook.israelntalu328.workers.dev/check-payment/${depositId}`
      );
      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        await updateDoc(doc(db, 'deliveries', selectedDelivery.id), {
          status: 'payment_ok',
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Succès', 'Paiement vérifié avec succès! 💰');
        setShowQRModal(false);
        setSelectedDelivery(null);
      } else {
        Alert.alert('En attente', 'Paiement non encore confirmé ou échoué.');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la vérification du paiement. Veuillez réessayer.');
      console.error('Erreur lors de la vérification du paiement:', error);
    }
  };

  const handleSignatureOk = async (signature: string) => {
    if (!selectedDelivery) return;

    try {
      await updateDoc(doc(db, 'deliveries', selectedDelivery.id), {
        status: 'delivered',
        signature,
        deliveredAt: serverTimestamp(),
      });
      setShowSignatureModal(false);
      setSelectedDelivery(null);
      Alert.alert('Livraison terminée!', 'La signature a été enregistrée. ✅');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la signature');
      console.error('Erreur lors de la signature:', error);
    }
  };

  const DeliveryCard = ({ delivery }: { delivery: Delivery }) => {
    const statusInfo = {
      pending: { text: 'Disponible', bg: Colors.statusPendingBg, text_color: Colors.statusPendingText },
      picked_up: { text: 'En cours', bg: Colors.statusPickedUpBg, text_color: Colors.statusPickedUpText },
      payment_ok: { text: 'Paiement OK', bg: Colors.statusPaymentOkBg, text_color: Colors.statusPaymentOkText },
      delivered: { text: 'Livré', bg: Colors.statusDeliveredBg, text_color: Colors.statusDeliveredText },
    };

    const currentStatus = statusInfo[delivery.status as keyof typeof statusInfo] || statusInfo.pending;

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Course #{delivery.orderId.slice(-5).toUpperCase()}</Text>
          <View style={styles.amountBadge}>
            <Text style={styles.amountText}>{delivery.amount} FC</Text>
          </View>
        </View>

        {/* Pickup */}
        <View style={styles.locationBlock}>
          <View style={[styles.locationIconContainer, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="storefront-outline" size={24} color={Colors.primary} />
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>RÉCUPÉRATION</Text>
            <Text style={styles.locationName}>{delivery.sellerName}</Text>
            <Text style={styles.locationAddress}>Contacter pour l'adresse exacte</Text>
          </View>
          <TouchableOpacity 
            style={styles.navigateButton} 
            onPress={() => openNavigation(delivery.sellerLat, delivery.sellerLng, `Pickup ${delivery.sellerName}`)}
          >
            <Ionicons name="navigate-outline" size={28} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        {/* Destination */}
        <View style={styles.locationBlock}>
          <View style={[styles.locationIconContainer, { backgroundColor: '#E0FBEA' }]}>
            <Ionicons name="home-outline" size={24} color={Colors.success} />
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>DESTINATION</Text>
            <Text style={styles.locationName}>{delivery.buyerName}</Text>
            <Text style={styles.locationAddress}>{delivery.address}</Text>
          </View>
          <TouchableOpacity 
            style={styles.navigateButton} 
            onPress={() => openNavigation(delivery.lat, delivery.lng, `Destination ${delivery.buyerName}`)}
          >
            <Ionicons name="navigate-outline" size={28} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}>
            <Text style={[styles.statusText, { color: currentStatus.text_color }]}>
              {currentStatus.text}
            </Text>
          </View>
          
          {delivery.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => handleTakeDelivery(delivery.id)}>
              <Ionicons name="car-sport" size={20} color="white" />
              <Text style={styles.actionButtonText}>Accepter la course</Text>
            </TouchableOpacity>
          )}

          {delivery.status === 'picked_up' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => {
                setSelectedDelivery(delivery);
                setShowQRModal(true);
              }}>
              <Ionicons name="qr-code" size={20} color="white" />
              <Text style={styles.actionButtonText}>Confirmer Paiement</Text>
            </TouchableOpacity>
          )}

          {delivery.status === 'payment_ok' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSuccess]}
              onPress={() => {
                setSelectedDelivery(delivery);
                setShowSignatureModal(true);
              }}>
              <FontAwesome name="pencil" size={20} color="white" />
              <Text style={styles.actionButtonText}>Confirmer Livraison</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const calculateDistance = (lat: number, lng: number) => {
    if (!currentLocation) return '0.0';
    const R = 6371; // Rayon de la Terre en km
    const dLat = deg2rad(lat - currentLocation.coords.latitude);
    const dLon = deg2rad(lng - currentLocation.coords.longitude);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(currentLocation.coords.latitude)) * Math.cos(deg2rad(lat)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return (R * c).toFixed(1);
  };

  const deg2rad = (deg: number) => deg * (Math.PI/180);

  const openNavigation = (lat?: number, lng?: number, label: string = 'Destination') => {
    if (typeof lat === 'undefined' || typeof lng === 'undefined') {
      Alert.alert("Erreur", "Coordonnées non disponibles.");
      return;
    }
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    
    if (url) {
      Linking.openURL(url);
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <Ionicons name="car-sport" size={60} color={Colors.primary} />
            <Text style={styles.loginTitle}>FASTGO Driver</Text>
            <Text style={styles.loginSubtitle}>Connectez-vous pour commencer</Text>
          </View>
          
          <View style={styles.loginForm}>
            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                placeholderTextColor={Colors.textLight}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Ionicons name="key" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Code d'accès"
                placeholderTextColor={Colors.textLight}
                value={code}
                onChangeText={setCode}
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Localisation en cours...</Text>
          <Text style={styles.loadingSubText}>
            Activation de votre GPS pour localiser les courses disponibles
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>FASTGO Driver</Text>
          <Text style={styles.headerSubtitle}>Bonjour, {user?.name?.split(' ')[0] || 'Livreur'} 👋</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications" size={24} color={Colors.primary} />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          onPress={() => setActiveTab('available')}
          style={[styles.tabButton, activeTab === 'available' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            Disponibles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('active')}
          style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            En cours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('completed')}
          style={[styles.tabButton, activeTab === 'completed' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Terminées
          </Text>
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity 
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
          style={styles.viewToggleButton}>
          <Ionicons 
            name={viewMode === 'map' ? 'list' : 'map'} 
            size={20} 
            color={Colors.primary} 
          />
          <Text style={styles.viewToggleButtonText}>
            {viewMode === 'map' ? 'Vue liste' : 'Vue carte'}
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={
              currentLocation
                ? {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }
                : undefined
            }
            showsUserLocation={true}
            userInterfaceStyle="dark"
          >
            {/* Markers for all available deliveries */}
            {filteredDeliveries.map((delivery) => (
              <Marker
                key={delivery.id}
                coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
                onPress={() => handleDeliveryPress(delivery)}
                tracksViewChanges={false}
              >
                <View style={[styles.markerDot, { backgroundColor: delivery.id === selectedDelivery?.id ? Colors.primary : Colors.textSecondary }]} />
              </Marker>
            ))}

            {/* Route for the selected delivery */}
            {selectedDelivery && selectedDelivery.sellerLat && selectedDelivery.sellerLng && (
              <>
                <Marker
                  coordinate={{ latitude: selectedDelivery.sellerLat, longitude: selectedDelivery.sellerLng }}
                  title={`Récupérer chez: ${selectedDelivery.sellerName}`}
                  tracksViewChanges={false}
                >
                  <View style={styles.routeMarker}>
                    <Ionicons name="storefront-outline" size={24} color={Colors.warning} />
                  </View>
                </Marker>
                <Marker
                  coordinate={{ latitude: selectedDelivery.lat, longitude: selectedDelivery.lng }}
                  title={`Livrer à: ${selectedDelivery.buyerName}`}
                  tracksViewChanges={false}
                >
                  <View style={styles.routeMarker}>
                    <Ionicons name="home-outline" size={24} color={Colors.success} />
                  </View>
                </Marker>

                {currentLocation && (
                  <Polyline
                    coordinates={[
                      { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
                      { latitude: selectedDelivery.sellerLat, longitude: selectedDelivery.sellerLng },
                    ]}
                    strokeColor={Colors.primary}
                    strokeWidth={4}
                    lineDashPattern={[5, 5]}
                  />
                )}
                <Polyline
                  coordinates={[
                    { latitude: selectedDelivery.sellerLat, longitude: selectedDelivery.sellerLng },
                    { latitude: selectedDelivery.lat, longitude: selectedDelivery.lng },
                  ]}
                  strokeColor={Colors.success}
                  strokeWidth={4}
                />
              </>
            )}
          </MapView>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredDeliveries.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="car-outline" size={80} color={Colors.textLight} />
              <Text style={styles.emptyStateText}>
                {activeTab === 'available' ? 'Aucune course disponible' : 
                 activeTab === 'active' ? 'Aucune course en cours' : 
                 'Aucune course terminée'}
              </Text>
              <Text style={styles.emptyStateSubText}>
                Revenez plus tard, de nouvelles courses peuvent apparaître à tout moment.
              </Text>
            </View>
          ) : (
            filteredDeliveries.map((delivery) => (
              <TouchableOpacity key={delivery.id} onPress={() => handleDeliveryPress(delivery)}>
                <DeliveryCard delivery={delivery} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* QR Code Images Modal */}
      <Modal visible={showQRModal} animationType="fade" transparent onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QR Codes du vendeur</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {qrCodeImages ? (
              <ScrollView>
                {qrCodeImages.airtel && (
                  <View style={styles.qrImageContainer}>
                    <Text style={styles.qrLabel}>Airtel Money</Text>
                    <Image
                      source={{ uri: qrCodeImages.airtel }}
                      style={styles.qrImage}
                    />
                  </View>
                )}
                {qrCodeImages.orange && (
                  <View style={styles.qrImageContainer}>
                    <Text style={styles.qrLabel}>Orange Money</Text>
                    <Image
                      source={{ uri: qrCodeImages.orange }}
                      style={styles.qrImage}
                    />
                  </View>
                )}
                {qrCodeImages.mpesa && (
                  <View style={styles.qrImageContainer}>
                    <Text style={styles.qrLabel}>M-Pesa</Text>
                    <Image
                      source={{ uri: qrCodeImages.mpesa }}
                      style={styles.qrImage}
                    />
                  </View>
                )}
              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color="#6C63FF" />
            )}
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide" transparent>
        <View style={modalStyles.signatureModalContainer}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>Signature du client</Text>
            <TouchableOpacity 
              onPress={() => setShowSignatureModal(false)}
              style={modalStyles.closeButton}>
              <Ionicons name="close-circle" size={30} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          
          <SignatureScreen
            onOK={handleSignatureOk}
            onClear={() => console.log('Signature effacée')}
            autoClear={true}
            descriptionText="Veuillez signer dans le cadre ci-dessous"
            clearText="Effacer"
            confirmText="Enregistrer"
            webStyle={`
              .m-signature-pad {box-shadow: none; border: none; background: #f9fafb;} 
              .m-signature-pad--body {border: 2px dashed ${Colors.border}; border-radius: 12px; background: white;}
              .m-signature-pad--footer {display: flex; justify-content: space-between; padding: 16px;}
              .m-signature-pad--footer button {background: ${Colors.primary}; color: white; padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 16px;}
              .m-signature-pad--footer .button-clear {background: ${Colors.danger};}
            `}
          />
        </View>
      </Modal>

      {/* Map WebView Modal */}
      <MapModalWebView
        isVisible={showMapModal}
        onClose={() => setShowMapModal(false)}
        delivery={selectedDelivery}
      />
    </SafeAreaView>
  );
}

const Colors = {
  primary: '#007AFF',
  secondary: '#5AC8FA',
  background: '#F8F9FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#212529',
  textSecondary: '#6C757D',
  textLight: '#ADB5BD',
  border: '#DEE2E6',
  shadow: 'rgba(0,0,0,0.1)',
  danger: '#DC3545',
  success: '#28A745',
  info: '#17A2B8',
  warning: '#FFC107',

  statusPendingBg: '#FFF3CD',
  statusPendingText: '#856404',
  statusPickedUpBg: '#D1ECF1',
  statusPickedUpText: '#0C5460',
  statusPaymentOkBg: '#D4EDDA',
  statusPaymentOkText: '#155724',
  statusDeliveredBg: '#E2E3E5',
  statusDeliveredText: '#343A40',

  airtel: '#FF3B30',
  orange: '#FF9500',
  mpesa: '#28CD41',
  
  markerPending: 'red',
  markerPickedUp: 'orange',
  markerDelivered: 'green',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  loginSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  loginForm: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: Colors.cardBackground,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingContent: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 15,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  header: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
    position: 'relative',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  notificationBadge: {
    width: 10,
    height: 10,
    backgroundColor: Colors.danger,
    borderRadius: 5,
    position: 'absolute',
    top: 5,
    right: 5,
    borderWidth: 1.5,
    borderColor: Colors.cardBackground,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 15,
    padding: 5,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.cardBackground,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  viewToggleButton: {
    backgroundColor: Colors.cardBackground,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  viewToggleButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
    marginTop: 15,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  map: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 15,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  amountText: {
    color: Colors.cardBackground,
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  navigateButton: {
    padding: 8,
  },
  separator: {
    height: 20,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    borderStyle: 'dashed',
    marginLeft: 23,
    marginVertical: -6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
  },

  qrModalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 25,
    width: '90%',
    padding: 25,
    alignItems: 'center',
  },
  qrImageContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.warning,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  routeMarker: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginTop: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  calloutContainer: {
    backgroundColor: Colors.cardBackground,
    padding: 15,
    borderRadius: 15,
    width: width * 0.7,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calloutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  calloutAddress: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 10,
  },
  calloutActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  calloutActionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minWidth: '48%',
    justifyContent: 'center',
  },
  calloutActionButtonText: {
    color: Colors.cardBackground,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
});

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 25,
    width: '90%',
    height: '85%',
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 5,
  },
  webView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  qrModalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 25,
    width: '90%',
    padding: 25,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  qrModalSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 22,
  },
  qrTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 25,
    width: '100%',
  },
  qrTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
    backgroundColor: Colors.background,
    marginHorizontal: 5,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  qrTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  qrTypeText: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  qrTypeTextActive: {
    color: Colors.cardBackground,
  },
  qrCodeDisplay: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
    borderRadius: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  qrCodeCaption: {
    marginTop: 15,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.cardBackground,
  },
  signatureModalContainer: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
  },
});