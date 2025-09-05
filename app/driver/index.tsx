import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { query, or, where } from 'firebase/firestore';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { collection } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import SignatureScreen from 'react-native-signature-canvas';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
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


type Delivery = {
  id: string;
  orderId: string;
  sellerId: string;
  sellerName: string;
  sellerPhone: string;
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
};


interface SellerProfile {
  id: string;
  qrCodes: {
    airtel?: string;
    orange?: string;
    mpesa?: string;
  };
}

// --- Composant Modale de la Carte Google Maps (WebView) ---
const MapModalWebView = ({ isVisible, onClose, delivery }: { isVisible: boolean, onClose: () => void, delivery: Delivery | null }) => {
  if (!delivery) return null;

  // HTML pour la WebView, avec des styles minimalistes pour s'intégrer
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
                overflow: hidden; /* Empêche le défilement de la page HTML */
                font-family: Arial, sans-serif;
            }
            #map {
                width: 100%;
                height: 100%;
            }
            /* Masque les contrôles par défaut de Google Maps pour une intégration plus propre */
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
                    disableDefaultUI: true, // Désactive tous les contrôles par défaut
                    zoomControl: true, // Mais réactive le zoom pour l'utilisateur
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

// --- Composant Principal de l'Application ---
export default function DriverScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [qrType, setQrType] = useState<'airtel' | 'orange' | 'mpesa' | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [showMapModal, setShowMapModal] = useState(false); // État pour la modale WebView
  const { authUser } = useAuth();

 
  const [modalVisible, setModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [qrCodeImages, setQrCodeImages] = useState<{ airtel?: string; orange?: string; mpesa?: string } | null>(null); // ✅ Utilisation de qrCodeImages

const handleDeliveryPress = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setModalVisible(true);
  };
  const filteredDeliveries = deliveries.filter(delivery => {
    if (!authUser?.id) return false; // S'assurer que l'utilisateur est authentifié

    if (activeTab === 'available') return delivery.status === 'pending';
    if (activeTab === 'active') {
      return (delivery.status === 'picked_up' || delivery.status === 'payment_ok') && delivery.driverId === authUser.id;
    }
    if (activeTab === 'completed') {
      return delivery.status === 'delivered' && delivery.driverId === authUser.id;
    }
    return false;
  });

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
        }
      );
    })();
  }, []);

  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);

    const q = query(
      collection(db, 'deliveries'),
      or(
        where('driverId', '==', authUser.id),
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
}, [authUser]);




  const handleShowQR = async () => {
    if (!selectedDelivery) return;
    setLoading(true);
    try {
      // 🎯 On va chercher le profil du vendeur dans la collection `users`
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
    if (!authUser?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour accepter une course.');
      return;
    }
    try {
      await updateDoc(doc(db, 'fastgo_deliveries', deliveryId), {
        driverId: authUser.id,
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
        await updateDoc(doc(db, 'fastgo_deliveries', selectedDelivery.id), {
          status: 'payment_ok',
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Succès', 'Paiement vérifié avec succès! 💰');
        setShowQRModal(false);
        setSelectedDelivery(null); // Réinitialiser pour éviter des états incohérents
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
      await updateDoc(doc(db, 'fastgo_deliveries', selectedDelivery.id), {
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

  const DeliveryCard = ({ delivery }: { delivery: Delivery }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{delivery.buyerName}</Text>
          <View style={styles.cardLocation}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.cardAddress}>{delivery.address}</Text>
          </View>
        </View>
        <View style={styles.amountBadge}>
          <Text style={styles.amountText}>{delivery.amount} FC</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <Ionicons name="time" size={16} color={Colors.textSecondary} />
          <Text style={styles.cardDetailText}>
            {calculateDistance(delivery.lat, delivery.lng)} km
          </Text>
        </View>
        <View style={[styles.statusBadge, { 
          backgroundColor: delivery.status === 'pending' ? Colors.statusPendingBg : 
                           delivery.status === 'picked_up' ? Colors.statusPickedUpBg : 
                           delivery.status === 'payment_ok' ? Colors.statusPaymentOkBg : Colors.statusDeliveredBg 
        }]}>
          <Text style={[styles.statusText, { 
            color: delivery.status === 'pending' ? Colors.statusPendingText : 
                   delivery.status === 'picked_up' ? Colors.statusPickedUpText : 
                   delivery.status === 'payment_ok' ? Colors.statusPaymentOkText : Colors.statusDeliveredText 
          }]}>
            {delivery.status === 'pending' ? 'Disponible' : 
             delivery.status === 'picked_up' ? 'En cours' : 
             delivery.status === 'payment_ok' ? 'Paiement OK' : 'Livré'}
          </Text>
        </View>
      </View>
      
      {delivery.status === 'pending' && (
        <TouchableOpacity
          style={styles.actionButtonPrimary}
          onPress={() => handleTakeDelivery(delivery.id)}>
          <Ionicons name="car-sport" size={20} color="white" />
          <Text style={styles.actionButtonText}>Accepter la course</Text>
        </TouchableOpacity>
      )}

      {delivery.status === 'picked_up' && (
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={() => {
            setSelectedDelivery(delivery);
            setShowQRModal(true);
          }}>
          <Ionicons name="qr-code" size={20} color="white" />
          <Text style={styles.actionButtonText}>Afficher QR codes</Text>
        </TouchableOpacity>
      )}

      {delivery.status === 'payment_ok' && (
        <TouchableOpacity
          style={styles.actionButtonSuccess}
          onPress={() => {
            setSelectedDelivery(delivery);
            setShowSignatureModal(true);
          }}>
          <FontAwesome name="pencil" size={20} color="white" />
          <Text style={styles.actionButtonText}>Faire signer</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
          <Text style={styles.headerSubtitle}>Bonjour, {authUser?.name?.split(' ')[0] || 'Livreur'} 👋</Text>
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
          >
            {currentLocation && (
              <Marker
                coordinate={{
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                }}
                title="Ma position"
                pinColor="blue"
              />
            )}
            {deliveries.map((delivery) => {
              // ✅ Sécurité : Vérifier que les coordonnées existent avant de rendre le marqueur
              if (delivery.lat && delivery.lng) {
                return (
                  <Marker
                    key={delivery.id}
                    coordinate={{
                      latitude: delivery.lat,
                      longitude: delivery.lng,
                    }}
                    title={delivery.orderId}
                    onPress={() => handleDeliveryPress(delivery)}
                  >
                    <Callout>
                      <View>
                        <Text style={styles.calloutTitle}>Commande #{delivery.orderId}</Text>
                        <Text>Client: {delivery.buyerName}</Text>
                        <Text>Montant: {delivery.amount} $</Text>
                        <Text>Statut: {delivery.status}</Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              }
              return null; // Ne rien rendre si les coordonnées sont manquantes
            })}
            {selectedDelivery && selectedDelivery.deliveryRoute && (
              <Polyline
                coordinates={selectedDelivery.deliveryRoute}
                strokeColor="#6C63FF"
                strokeWidth={4}
              />
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
              <DeliveryCard key={delivery.id} delivery={delivery} />
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

// --- Styles de l'Application ---
const Colors = {
  primary: '#007AFF',       // Bleu vif pour les actions principales
  secondary: '#5AC8FA',     // Bleu clair
  background: '#F8F9FA',    // Arrière-plan général léger
  cardBackground: '#FFFFFF', // Fond des cartes
  textPrimary: '#212529',   // Texte principal sombre
  textSecondary: '#6C757D', // Texte secondaire gris
  textLight: '#ADB5BD',     // Texte très clair pour les états vides
  border: '#DEE2E6',        // Bordures légères
  shadow: 'rgba(0,0,0,0.1)',// Ombre subtile
  danger: '#DC3545',        // Rouge pour les actions dangereuses ou fermer
  success: '#28A745',       // Vert pour le succès
  info: '#17A2B8',          // Bleu-vert pour l'information
  warning: '#FFC107',       // Jaune pour les avertissements

  // Statuts des livraisons
  statusPendingBg: '#FFF3CD',
  statusPendingText: '#856404',
  statusPickedUpBg: '#D1ECF1',
  statusPickedUpText: '#0C5460',
  statusPaymentOkBg: '#D4EDDA',
  statusPaymentOkText: '#155724',
  statusDeliveredBg: '#E2E3E5',
  statusDeliveredText: '#343A40',

  // Couleurs des opérateurs mobiles
  airtel: '#FF3B30',  // Rouge
  orange: '#FF9500',  // Orange
  mpesa: '#28CD41',   // Vert
  
  // Couleurs des marqueurs de carte
  markerPending: 'red',
  markerPickedUp: 'orange',
  markerDelivered: 'green',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    overflow: 'hidden', // Pour que le borderRadius s'applique
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
    padding: 20,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
    flexShrink: 1,
  },
  amountBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  amountText: {
    color: Colors.cardBackground,
    fontWeight: 'bold',
    fontSize: 14,
  },
  qrModalContent: {
  backgroundColor: '#fff',
  padding: 24,
  borderRadius: 16,
  width: '90%',
  alignSelf: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
},
qrImageContainer: {
  alignItems: 'center',
  marginBottom: 24,
  borderWidth: 1,
  borderColor: '#e5e5e5',
  borderRadius: 12,
  padding: 16,
},
qrLabel: {
  fontSize: 16,
  fontWeight: 'bold',
  marginBottom: 8,
},
qrImage: {
  width: 200,
  height: 200,
  resizeMode: 'contain',
},
signatureModalContainer: {
  flex: 1,
  backgroundColor: '#fff',
},
signatureHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  backgroundColor: '#f3f4f6',
},
signatureTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#1f2937',
},
closeButton: {
  padding: 8,
},
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  cardDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonSecondary: {
    backgroundColor: '#8E24AA', // Violet distinct
    paddingVertical: 16,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    color: Colors.cardBackground,
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
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
    width: width * 0.7, // 70% de la largeur de l'écran
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
    flexWrap: 'wrap', // Permet aux boutons de passer à la ligne
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
    marginBottom: 8, // Marge pour l'espacement si les boutons passent à la ligne
    minWidth: '48%', // Pour avoir 2 boutons par ligne
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
    backgroundColor: 'rgba(0,0,0,0.6)', // Fond assombri pour la modale
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
    backgroundColor: Colors.background, // Empêche le flash blanc au chargement
  },
  // Styles spécifiques pour la modale QR Code
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
  // Styles spécifiques pour la modale de signature
  signatureModalContainer: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
  },
});

// Style personnalisé pour la carte Google Maps (mode clair)
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];