// PayScreen.tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';

import * as Crypto from 'expo-crypto';
import { WebView } from 'react-native-webview';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface MapCoordinates {
  latitude: number;
  longitude: number;
}
interface SellerInfo {
  email: string;
  name?: string;
  photoUrl?: string;
  phoneNumber?: string;
  shopName?: string;
}
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}
interface PromoCode {
  code: string;
  discountPercentage: number;
}
type PaymentStatus =
  | 'IDLE'
  | 'INITIATING'
  | 'PENDING_USER_ACTION'
  | 'CONFIRMING'
  | 'SUCCESS'
  | 'FAILED';

// ------------------------------------------------------------------
// Constantes
// ------------------------------------------------------------------
const PAYMENT_WORKER_URL = 'https://yass-webhook.israelntalu328.workers.dev';
const GOOGLE_MAPS_API_KEY = 'AIzaSyDFIO7vLUTgo-jlRT2i77uHvEqoxgJfRj4';

const APP_FEE_PERCENTAGE = 0.005; // 5 %
const DELIVERY_FEE = 1000;
const DEPOSIT_PERCENTAGE = 0.0009; 

const PICKUP_HOUSES = ['Kananga azda', 'biancky'];
const PROMO_CODES: PromoCode[] = [{ code: 'YASS20', discountPercentage: 20 }];

// ------------------------------------------------------------------
// HTML carte Google Maps (inchangé)
// ------------------------------------------------------------------
const htmlMapSource = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
    <meta charset="utf-8" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; font-family: sans-serif; }
      #search-container { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 90%; z-index: 5; }
      #pac-input { background-color: #fff; font-size: 16px; width: 100%; padding: 12px 18px; border: none; border-radius: 25px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    </style>
  </head>
  <body>
    <div id="search-container"><input id="pac-input" type="text" placeholder="Rechercher une adresse..." /></div>
    <div id="map"></div>
    <script>
      let map, marker, geocoder;
      const initialLocation = { lat: -4.325, lng: 15.3222 }; // Kinshasa
      function initMap() {
        map = new google.maps.Map(document.getElementById('map'), { center: initialLocation, zoom: 15, mapTypeId: 'roadmap', disableDefaultUI: true, zoomControl: true });
        geocoder = new google.maps.Geocoder();
        marker = new google.maps.Marker({ position: initialLocation, map: map, draggable: true });
        const updatePositionAndNotify = (latLng) => {
          marker.setPosition(latLng);
          geocoder.geocode({ location: latLng }, (results, status) => {
            if (status === 'OK' && results[0]) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: latLng.lat(), longitude: latLng.lng(), address: results[0].formatted_address }));
            }
          });
        };
        marker.addListener('dragend', (e) => updatePositionAndNotify(e.latLng));
        map.addListener('click', (e) => updatePositionAndNotify(e.latLng));
        const input = document.getElementById('pac-input');
        const searchBox = new google.maps.places.SearchBox(input);
        searchBox.addListener('places_changed', () => {
          const places = searchBox.getPlaces();
          if (places.length > 0) {
            const place = places[0];
            map.setCenter(place.geometry.location);
            updatePositionAndNotify(place.geometry.location);
          }
        });
        window.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          if (data.action === 'set_location') {
            const newPos = { lat: data.latitude, lng: data.longitude };
            map.setCenter(newPos);
            updatePositionAndNotify(new google.maps.LatLng(newPos));
          }
        });
        updatePositionAndNotify(new google.maps.LatLng(initialLocation));
      }
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places" async defer></script>
  </body>
</html>`;

// ------------------------------------------------------------------
// MapModal (inchangé)
// ------------------------------------------------------------------
interface MapModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLocationSelect: (coords: MapCoordinates, address: string) => void;
  onGetLocation: () => Promise<void>;
  isGettingLocation: boolean;
}
const MapModal: React.FC<MapModalProps> = ({
  isVisible,
  onClose,
  onLocationSelect,
  onGetLocation,
  isGettingLocation,
}) => {
  const webviewRef = useRef<WebView>(null);
  const [tempLocation, setTempLocation] = useState<{
    coords: MapCoordinates;
    address: string;
  } | null>(null);

  const handleConfirm = () => {
    if (tempLocation) {
      onLocationSelect(tempLocation.coords, tempLocation.address);
      onClose();
    } else {
      Alert.alert('Aucune position', 'Veuillez sélectionner un point sur la carte.');
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.mapModalContainer}>
        <View style={styles.mapHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Feather name="x" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.mapTitle}>Sélectionnez la position</Text>
        </View>
        <WebView
          ref={webviewRef}
          source={{ html: htmlMapSource }}
          onMessage={(event) =>
            setTempLocation(JSON.parse(event.nativeEvent.data))
          }
          style={styles.mapWebView}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color="#6C63FF"
              style={StyleSheet.absoluteFill}
            />
          )}
        />
        <View style={styles.addressContainer}>
          <Text style={styles.addressText} numberOfLines={2}>
            {tempLocation?.address ||
              'Déplacez la carte pour choisir...'}
          </Text>
        </View>
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={onGetLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Feather name="crosshair" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapConfirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.mapConfirmButtonText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ------------------------------------------------------------------
// PayScreen
// ------------------------------------------------------------------
const PayScreen = () => {
  const router = useRouter();
  const { authUser } = useAuth();
  const { orderId, totalAmount, sellerId } = useLocalSearchParams<{
    orderId: string;
    totalAmount: string;
    sellerId: string;
  }>();

  // ----------------------------------------------------------------
  // États
  // ----------------------------------------------------------------

  // NOUVEAUX ÉTATS pour la page web
  // ← remets-le

  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDelivery, setIsDelivery] = useState(true);
  
  const [deliveryDetails, setDeliveryDetails] = useState<{
    location: string;
    address: string;
    coordinates: MapCoordinates | null;
  }>({ location: '', address: '', coordinates: null });
  const [selectedPickupHouse, setSelectedPickupHouse] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [customerMessage, setCustomerMessage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('IDLE');
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // NOUVEAUX ÉTATS pour la page web
  const [htmlContent, setHtmlContent] = useState('');
  const [depositId, setDepositId] = useState<string | null>(null);
  const [webModalVisible, setWebModalVisible] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----------------------------------------------------------------
  // Calculs
  // ----------------------------------------------------------------
  const parsedTotalAmount = useMemo(
    () => parseFloat(totalAmount || '0'),
    [totalAmount]
  );
  const appFee = useMemo(
    () => parsedTotalAmount * APP_FEE_PERCENTAGE,
    [parsedTotalAmount]
  );
  const finalDeliveryFee = useMemo(
    () => (isDelivery ? DELIVERY_FEE : 0),
    [isDelivery]
  );
  const totalBeforeDiscount = useMemo(
    () => parsedTotalAmount + appFee + finalDeliveryFee,
    [parsedTotalAmount, appFee, finalDeliveryFee]
  );
  const finalTotal = useMemo(
    () => totalBeforeDiscount - discount,
    [totalBeforeDiscount, discount]
  );
  const depositAmount = useMemo(
    () => (isDelivery ? finalTotal * DEPOSIT_PERCENTAGE + DELIVERY_FEE : 0),
    [isDelivery, finalTotal]
  );

  // ----------------------------------------------------------------
  // Chargement initial
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!sellerId || !orderId) return;
    const fetchInitialData = async () => {
      try {
        const [sellerDoc, orderDoc] = await Promise.all([
          getDoc(doc(db, 'users', sellerId)),
          getDoc(doc(db, 'orders', orderId)),
        ]);
        if (sellerDoc.exists()) {
          const d = sellerDoc.data();
          setSellerInfo({
            email: d.email,
            name: d.name,
            photoUrl: d.photoUrl,
            phoneNumber: d.sellerForm?.phoneNumber,
            shopName: d.sellerForm?.shopName,
          });
        }
        if (orderDoc.exists()) setOrderItems(orderDoc.data().items || []);
      } catch (e) {
        console.error(e);
        Alert.alert('Erreur', 'Impossible de charger les détails.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [sellerId, orderId]);

  // ----------------------------------------------------------------
  // Écoute du statut Firestore
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
      if (!snap.exists()) return;
      const ds = snap.data().depositStatus;
      if (ds === 'PAID') {
        setPaymentStatus('SUCCESS');
        Alert.alert(
          'Paiement réussi',
          'Votre commande est confirmée !',
          [{ text: 'OK', onPress: () => router.replace(`/order-confirmation/${orderId}`) }]
        );
      } else if (ds === 'FAILED') {
        setPaymentStatus('FAILED');
        Alert.alert('Paiement échoué', 'Le paiement a échoué. Réessayez.');
      }
    });
    return unsub;
  }, [orderId, router]);

  // ----------------------------------------------------------------
  // Utils
  // ----------------------------------------------------------------
  const applyPromoCode = () => {
    const pc = PROMO_CODES.find(
      (p) => p.code.toUpperCase() === promoCode.toUpperCase()
    );
    if (pc) {
      setDiscount(totalBeforeDiscount * (pc.discountPercentage / 100));
      Alert.alert('Succès', `Code promo appliqué : ${pc.discountPercentage} %`);
    } else {
      setDiscount(0);
      Alert.alert('Erreur', 'Code promo invalide.');
    }
  };

  const getLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Accès à la localisation requis.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const addr = await Location.reverseGeocodeAsync(loc.coords);
      const address = addr[0]
        ? `${addr[0].name}, ${addr[0].city}`
        : 'Adresse non trouvée';
      handleLocationSelect(loc.coords, address);
      setMapModalVisible(false);
      Alert.alert('Position trouvée', address);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible d’obtenir la localisation.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationSelect = (coords: MapCoordinates, address: string) => {
    setDeliveryDetails((p) => ({ ...p, coordinates: coords, address }));
  };

  // ----------------------------------------------------------------
  // NOUVELLE LOGIQUE PAIEMENT (via page web + polling)
  // ----------------------------------------------------------------
  // ----------------------------------------------------------------
// NOUVELLE LOGIQUE PAIEMENT (via page web + polling)
// ----------------------------------------------------------------



const orderRef = doc(db, 'orders', orderId);
/* ---------- interception retour ---------- */
const handleNavChange = (nav: any) => {
  const { url } = nav;
  if (url.includes('yass-webhook.israelntalu328.workers.dev/payment-return')) {
    const id = Crypto.randomUUID();
    if (id) {
      setDepositId(id);       
      setWebModalVisible(false);
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
      const r = await fetch(`https://yass-webhook.israelntalu328.workers.dev/check-payment/${id}`);
      if (!r.ok) throw new Error('net');
      const { status } = await r.json();
      const st = String(status).toUpperCase();

      if (['SUCCESS', 'SUCCESSFUL'].includes(st)) {
        clearInterval(pollRef.current!); pollRef.current = null;

        // 🔥 Mets à jour la commande avec toutes les infos dont le vendeur a besoin
        const updates: any = {
          depositStatus: 'PAID',
          status: 'confirmed',
          buyerId: authUser!.uid,
          buyerName: authUser!.name || authUser!.email!.split('@')[0],
          buyerEmail: authUser!.email,
          buyerPhone: authUser!.phoneNumber || null,
          deliveryDetails: isDelivery
            ? {
                location: deliveryDetails.location.trim(),
                address: deliveryDetails.address.trim(),
                coordinates: deliveryDetails.coordinates,
              }
            : null,
          pickupHouse: !isDelivery ? selectedPickupHouse : null,
          depositAmount: depositAmount,
          finalTotal: finalTotal,
          promoCode: promoCode.trim().toUpperCase() || null,
          discount: discount,
          customerMessage: customerMessage.trim() || null,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(doc(db, 'orders', orderId), updates);

        Alert.alert('✅ Paiement confirmé', 'Votre commande est confirmée !');
        router.replace(`/order-confirmation/${orderId}`);
        return;
      }
      if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'ERROR'].includes(st)) {
        clearInterval(pollRef.current!); pollRef.current = null;
        updateDoc(doc(db, 'orders', orderId), { depositStatus: 'FAILED', status: 'payment_failed' });
        Alert.alert('Paiement échoué', 'Le paiement a été refusé/annulé.');
        setPaymentStatus('FAILED');
        return;
      }
    } catch {/* ignore */}
    if (tries >= max) {
      clearInterval(pollRef.current!); pollRef.current = null;
      updateDoc(doc(db, 'orders', orderId), { depositStatus: 'FAILED', status: 'payment_failed' });
      Alert.alert('⏱ Délai dépassé', 'Paiement non confirmé.');
      setPaymentStatus('FAILED');
    }
  }, 3000);
};






const handlePayment = () => {
  if (!isDelivery) {
    Alert.alert('Commande confirmée', 'Vous paierez sur place.', [
      { text: 'OK', onPress: () => router.replace(`/order-confirmation/${orderId}`) },
    ]);
    return;
  }
  const id = Crypto.randomUUID();
  setDepositId(id);            // ← set ici
  setWebModalVisible(true);
};







  // Nettoyage polling si l'écran se démonte
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------
  if (isLoading)
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#6C63FF" />
      </SafeAreaView>
    );

  const isButtonDisabled =
    paymentStatus !== 'IDLE' && paymentStatus !== 'FAILED';
  const getButtonText = () => {
    switch (paymentStatus) {
      case 'INITIATING':
        return 'Initialisation...';
      case 'PENDING_USER_ACTION':
        return 'Confirmez sur votre téléphone...';
      case 'SUCCESS':
        return 'Paiement Réussi !';
      case 'FAILED':
        return 'Réessayer le paiement';
      default:
        return isDelivery
          ? `Payer l'acompte (${depositAmount.toFixed(0)} CDF)`
          : 'Confirmer la commande';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finalisation</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          {/* Vendeur */}
          {sellerInfo && (
  <View style={styles.sellerCard}>
    <Image
      source={{ uri: sellerInfo.photoUrl || 'https://placehold.co/100' }}
      style={styles.sellerCardImage}
    />
    <View style={styles.sellerCardText}>
      <Text style={styles.sellerCardShopName}>
        {sellerInfo.shopName || 'Boutique du vendeur'}
      </Text>
      <Text style={styles.sellerCardName}>
        {sellerInfo.name || 'Vendeur'}
      </Text>
      {sellerInfo.phoneNumber && (
        <Text style={styles.sellerCardPhone}> {sellerInfo.phoneNumber}</Text>
      )}
      {sellerInfo.email && (
        <Text style={styles.sellerCardEmail}> {sellerInfo.email}</Text>
      )}
    </View>
  </View>
)}


          {/* Type commande */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Type de commande</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Retrait</Text>
              <Switch
                value={isDelivery}
                onValueChange={setIsDelivery}
                trackColor={{ false: '#ccc', true: '#8e88ff' }}
                thumbColor="#fff"
              />
              <Text style={styles.switchText}>Livraison</Text>
            </View>
          </View>

          {/* Détails livraison / retrait */}
          {isDelivery ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Détails de la livraison</Text>
              <TextInput
                style={styles.input}
                placeholder="Lieu (ex: Bumbu, Limete...)"
                value={deliveryDetails.location}
                onChangeText={(t) =>
                  setDeliveryDetails((p) => ({ ...p, location: t }))
                }
              />
              <TextInput
                style={styles.input}
                placeholder="Adresse détaillée (Av, N°, Réf)"
                value={deliveryDetails.address}
                onChangeText={(t) =>
                  setDeliveryDetails((p) => ({ ...p, address: t }))
                }
              />
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => setMapModalVisible(true)}
              >
                <Feather name="map-pin" size={18} color="#fff" />
                <Text style={styles.mapButtonText}>
                  {deliveryDetails.coordinates
                    ? 'Position choisie'
                    : 'Choisir sur la carte'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Point de retrait</Text>
              {PICKUP_HOUSES.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.providerButton,
                    selectedPickupHouse === h && styles.selectedProviderButton,
                  ]}
                  onPress={() => setSelectedPickupHouse(h)}
                >
                  <Text
                    style={[
                      styles.providerText,
                      selectedPickupHouse === h && styles.selectedProviderText,
                    ]}
                  >
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

    
            
      

          {/* Récap */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            <View style={styles.summaryItem}>
              <Text>Sous-total</Text>
              <Text>{parsedTotalAmount.toFixed(0)} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text>Frais de service</Text>
              <Text>{appFee.toFixed(0)} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text>Livraison</Text>
              <Text>{finalDeliveryFee.toFixed(0)} CDF</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryItem}>
                <Text style={{ color: 'green' }}>Réduction</Text>
                <Text style={{ color: 'green' }}>-{discount.toFixed(0)} CDF</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={[styles.summaryItem, styles.totalItem]}>
              <Text style={styles.summaryTotalText}>Total</Text>
              <Text style={styles.summaryTotalValue}>{finalTotal.toFixed(0)} CDF</Text>
            </View>
            {isDelivery && (
              <View style={styles.summaryItem}>
                <Text style={styles.depositText}>Acompte à payer</Text>
                <Text style={styles.depositValue}>{depositAmount.toFixed(0)} CDF</Text>
              </View>
            )}
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message au vendeur (optionnel)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Instructions spéciales..."
              value={customerMessage}
              onChangeText={setCustomerMessage}
              multiline
            />
          </View>
        </ScrollView>

        {/* Bouton payer */}
        <View style={styles.payButtonContainer}>
          <TouchableOpacity
            style={[styles.payButton, isButtonDisabled && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={isButtonDisabled}
          >
            {paymentStatus === 'INITIATING' ||
            paymentStatus === 'PENDING_USER_ACTION' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modales */}
      <MapModal
        isVisible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onLocationSelect={handleLocationSelect}
        onGetLocation={getLocation}
        isGettingLocation={isGettingLocation}
      />

<Modal visible={webModalVisible} animationType="slide" onRequestClose={() => setWebModalVisible(false)}>
  <View style={{ flex: 1 }}>
    <TouchableOpacity style={{ padding: 16 }} onPress={() => setWebModalVisible(false)}>
      <Text style={{ fontSize: 18 }}>✕ Fermer</Text>
    </TouchableOpacity>
    <WebView
      source={{ uri: `${PAYMENT_WORKER_URL}/payment-page?depositId=${depositId}&amount=${depositAmount.toFixed(0)}&currency=CDF` }}
      onNavigationStateChange={handleNavChange}
      startInLoadingState
      javaScriptEnabled={true}
      domStorageEnabled={true}
      originWhitelist={['*']}
      renderLoading={() => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text>Redirection vers PawaPay…</Text>
        </View>
      )}
    />
  </View>
</Modal>

    </SafeAreaView>
  );
};

// ------------------------------------------------------------------
// Styles (inchangés)
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, backgroundColor: '#f7f7f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: { padding: 10 },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  sellerInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  shopNameText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sellerNameText: { fontSize: 14, color: '#666' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  messageInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    minHeight: 80,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  providerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  providerButton: {
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingVertical: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedProviderButton: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  providerText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  selectedProviderText: { color: '#fff' },
  payButtonContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  payButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  payButtonDisabled: { backgroundColor: '#ccc' },
  payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  mapModalContainer: { flex: 1, backgroundColor: '#f7f7f7' },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  mapWebView: { flex: 1 },
  mapControls: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  mapConfirmButton: {
    flex: 3,
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  mapConfirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  locationButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  switchText: { fontSize: 16, color: '#333', marginHorizontal: 15, fontWeight: '500' },
  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  mapButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 16,
  },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  totalItem: { marginTop: 10, paddingTop: 10 },
  summaryTotalText: { fontSize: 18, fontWeight: 'bold' },
  summaryTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#6C63FF' },
  depositText: { fontSize: 16, fontWeight: '500', color: '#e67e22' },
  depositValue: { fontSize: 16, fontWeight: 'bold', color: '#e67e22' },
  addressContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    position: 'absolute',
    bottom: 85,
    left: 0,
    right: 0,
  },

  sellerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  sellerCardImage: { width: 70, height: 70, borderRadius: 35, marginRight: 15 },
  sellerCardText: { flex: 1 },
  sellerCardShopName: { fontSize: 18, fontWeight: 'bold', color: '#6C63FF' },
  sellerCardName: { fontSize: 16, color: '#333', marginTop: 2 },
  sellerCardPhone: { fontSize: 14, color: '#555', marginTop: 2 },
  sellerCardEmail: { fontSize: 14, color: '#555', marginTop: 1 },
  
  addressText: { fontSize: 14, color: '#333', textAlign: 'center' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, color: '#666' },
});

export default PayScreen;       