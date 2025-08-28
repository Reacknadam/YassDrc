import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import SmsListener from 'react-native-android-sms-listener';
import { WebView } from 'react-native-webview';

// Interfaces et constantes
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
interface SmsMessage {
  body: string;
  address: string;
  date: number;
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

const PAWAPAY_WEBHOOK_URL = 'https://yass-webhook.israelntalu328.workers.dev';
const APP_FEE_PERCENTAGE = 0.05; // 5% de frais de service (corrigé)
const DELIVERY_FEE = 1000;
const PICKUP_HOUSES = [
  'Kananga azda',
  'biancky',
];
const PROMO_CODES: PromoCode[] = [{ code: 'YASS20', discountPercentage: 20 }];
const GOOGLE_MAPS_API_KEY = 'AIzaSyDFIO7vLUTgo-jlRT2i77uHvEqoxgJfRj4';

// Code HTML pour la carte dans la WebView avec recherche et marqueur personnalisé
const htmlMapSource = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no">
  <meta charset="utf-8">
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    #info-box {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(255, 255, 255, 0.9);
        padding: 10px;
        border-radius: 5px;
        z-index: 10;
        font-family: sans-serif;
        max-width: 80%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    #search-container {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      z-index: 10;
    }
    #pac-input {
      background-color: #fff;
      padding: 10px 15px;
      font-size: 16px;
      border: none;
      border-radius: 25px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      width: 100%;
      outline: none;
    }
  </style>
  <title>Google Map</title>
</head>
<body>
  <div id="search-container">
    <input id="pac-input" type="text" placeholder="Rechercher une adresse...">
  </div>
  <div id="map"></div>
  <div id="info-box">Déplacez le marqueur pour choisir votre position</div>
  <script>
    var map;
    var marker;
    var geocoder;
    var initialLocation = { lat: -4.325, lng: 15.3222 }; // Kinshasa par défaut
    var infoWindow = new google.maps.InfoWindow();
    var searchBox;

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: initialLocation,
        zoom: 17,
        mapTypeId: 'hybrid',
        disableDefaultUI: false,
        tilt: 45,
      });

      geocoder = new google.maps.Geocoder();

      // Créer un marqueur personnalisé
      marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        draggable: true,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(40, 40)
        }
      });

      // Mettre à jour l'adresse lorsque le marqueur est déplacé
      google.maps.event.addListener(marker, 'dragend', function(event) {
        updatePosition(event.latLng);
      });

      // Mettre à jour l'adresse lors d'un clic sur la carte
      google.maps.event.addListener(map, 'click', function(event) {
        marker.setPosition(event.latLng);
        updatePosition(event.latLng);
      });

      // Initialiser la boîte de recherche
      var input = document.getElementById('pac-input');
      searchBox = new google.maps.places.SearchBox(input);
      map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);

      // Bias the SearchBox results towards current map's viewport.
      map.addListener('bounds_changed', function() {
        searchBox.setBounds(map.getBounds());
      });

      // Écouter les événements de recherche
      searchBox.addListener('places_changed', function() {
        var places = searchBox.getPlaces();

        if (places.length == 0) {
          return;
        }

        // For each place, get the icon, name and location.
        var bounds = new google.maps.LatLngBounds();
        places.forEach(function(place) {
          if (!place.geometry) {
            console.log("Returned place contains no geometry");
            return;
          }

          if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
          } else {
            bounds.extend(place.geometry.location);
          }
        });
        map.fitBounds(bounds);
        
        // Placer le marqueur sur le premier résultat
        if (places[0].geometry.location) {
          marker.setPosition(places[0].geometry.location);
          updatePosition(places[0].geometry.location);
        }
      });

      // Fonction pour mettre à jour la position et obtenir l'adresse
      function updatePosition(latLng) {
        geocoder.geocode({'location': latLng}, function(results, status) {
          if (status === 'OK') {
            if (results[0]) {
              var address = results[0].formatted_address;
              document.getElementById('info-box').innerText = address;
              
              // Envoyer les coordonnées et l'adresse à l'application React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                latitude: latLng.lat(),
                longitude: latLng.lng(),
                address: address,
                action: 'location_update'
              }));
            }
          }
        });
      }

      // Envoyer la position initiale au chargement
      updatePosition(initialLocation);
      
      // Gérer les messages de l'application
      document.addEventListener('message', function(event) {
        var data = JSON.parse(event.data);
        if (data.action === 'set_location') {
          var newPos = { lat: data.latitude, lng: data.longitude };
          map.setCenter(newPos);
          map.setZoom(17);
          marker.setPosition(newPos);
          updatePosition(newPos);
        }
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places" async defer></script>
</body>
</html>`;

// Composant MapModal (version optimisée avec WebView)
interface MapModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLocationSelect: (coords: MapCoordinates, address: string) => void;
  initialCoordinates: MapCoordinates | null;
  onGetLocation: () => Promise<void>;
  isGettingLocation: boolean;
}

const MapModal: React.FC<MapModalProps> = ({
  isVisible,
  onClose,
  onLocationSelect,
  initialCoordinates,
  onGetLocation,
  isGettingLocation,
}) => {
  const webviewRef = useRef<WebView>(null);
  const [tempCoordinates, setTempCoordinates] = useState<MapCoordinates | null>(initialCoordinates);
  const [selectedAddress, setSelectedAddress] = useState('');

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'location_update') {
        setTempCoordinates({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setSelectedAddress(data.address || 'Adresse en cours de chargement...');
      }
    } catch (error) {
      console.error("Erreur de parsing du message de la WebView:", error);
    }
  };

  const handleConfirmLocation = () => {
    if (tempCoordinates) {
      onLocationSelect(tempCoordinates, selectedAddress);
      onClose();
    } else {
      Alert.alert("Erreur", "Veuillez sélectionner un point sur la carte.");
    }
  };

  const centerMapOnLocation = (coords: MapCoordinates) => {
    if (webviewRef.current) {
      const message = JSON.stringify({
        action: 'set_location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      webviewRef.current.postMessage(message);
    }
  };
  
  const handleGetLocationAndCenter = async () => {
    await onGetLocation();
  };

  useEffect(() => {
    if (initialCoordinates) {
      setTempCoordinates(initialCoordinates);
      centerMapOnLocation(initialCoordinates);
    }
  }, [initialCoordinates]);

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.mapModalContainer}>
        <View style={styles.mapHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Feather name="x" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.mapTitle}>Sélectionnez votre position</Text>
        </View>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlMapSource }}
          onMessage={handleWebViewMessage}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" color="#6C63FF" style={styles.loadingOverlay} />}
        />
        <View style={styles.addressContainer}>
          <Text style={styles.addressText} numberOfLines={2}>
            {selectedAddress || "Sélectionnez un emplacement sur la carte"}
          </Text>
        </View>
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetLocationAndCenter}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="crosshair" size={24} color="#fff" />
            )}
            <Text style={styles.locationButtonText}>Ma position actuelle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapConfirmButton} onPress={handleConfirmLocation}>
            <Text style={styles.mapConfirmButtonText}>Confirmer la position</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Composant principal PayScreen
const PayScreen = () => {
  const router = useRouter();
  const { authUser } = useAuth();
  const params = useLocalSearchParams();
  const { orderId, totalAmount, sellerId } = params;
  const [smsVerificationTimeout, setSmsVerificationTimeout] = useState<NodeJS.Timeout | number | null>(null);

  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('2439');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerMessageToSeller, setCustomerMessageToSeller] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initiating' | 'pending_confirmation' | 'success' | 'failed'>('idle');
  const [isDeliverySelected, setIsDeliverySelected] = useState(true);
  const [selectedPickupHouse, setSelectedPickupHouse] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<MapCoordinates | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState<MapCoordinates | null>(null);
  const [paymentConfirmationModal, setPaymentConfirmationModal] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderStatus, setOrderStatus] = useState('En attente');
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('45 min');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [depositStatus, setDepositStatus] = useState<'PENDING' | 'PAID' | 'FAILED' | 'NOT_REQUIRED'>('PENDING');
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const [smsListenerActive, setSmsListenerActive] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<'pending'|'success'|'failed'>('pending');
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');

  const parsedTotalAmount = useMemo(() => totalAmount ? parseFloat(totalAmount as string) : 0, [totalAmount]);
  const appFeeAmount = useMemo(() => parsedTotalAmount * APP_FEE_PERCENTAGE, [parsedTotalAmount]);
  const deliveryFee = useMemo(() => isDeliverySelected ? DELIVERY_FEE : 0, [isDeliverySelected]);
  const finalAmountBeforeDiscount = useMemo(() => parsedTotalAmount + appFeeAmount + deliveryFee, [parsedTotalAmount, appFeeAmount, deliveryFee]);
  const finalTotalAmount = useMemo(() => finalAmountBeforeDiscount - discount, [finalAmountBeforeDiscount, discount]);
  const depositAmount = useMemo(() => isDeliverySelected ? Math.min(1000, finalTotalAmount * 0.1) : 0, [isDeliverySelected, finalTotalAmount]);

  // Générer le lien de partage
  const generateShareLink = useCallback(() => {
    if (!orderId) return '';
    
    const baseUrl = Linking.createURL('/pay');
    const params = new URLSearchParams({
      orderId: orderId as string,
      totalAmount: totalAmount as string,
      sellerId: sellerId as string,
      shared: 'true',
    });
    
    return `${baseUrl}?${params.toString()}`;
  }, [orderId, totalAmount, sellerId]);

  useEffect(() => {
    const link = generateShareLink();
    setShareLink(link);
  }, [generateShareLink]);

  const handleShareOrder = async () => {
    if (!shareLink) {
      Alert.alert('Erreur', 'Impossible de générer le lien de partage');
      return;
    }

    try {
      const result = await Share.share({
        message: `Bonjour, pouvez-vous payer ma commande Yassir ? Cliquez sur ce lien: ${shareLink}`,
        title: 'Partager le panier Yassir',
      });

      if (result.action === Share.sharedAction) {
        // Mettre à jour Firestore pour indiquer que cette commande est partagée
        if (orderId) {
          await updateDoc(doc(db, 'orders', orderId as string), {
            shared: true,
            sharedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de partager le panier');
      console.error('Erreur lors du partage:', error);
    }
  };

  const requestSmsPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'Permission SMS',
          message: 'L\'application a besoin d\'accéder à vos SMS pour vérifier le paiement',
          buttonPositive: 'OK',
        }
      );
      setSmsPermissionGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Erreur permission SMS:', err);
      return false;
    }
  };

  const isPaymentConfirmationSms = (smsBody: string, amount: number): boolean => {
    const expectedAmount = amount.toFixed(2);
    const regex = new RegExp(
      `TID:\\s*MP\\d+.*${expectedAmount}\\s*CDF.*PAWAPAY`,
      'i'
    );
    return regex.test(smsBody);
  };

  const startSmsListener = useCallback((amount: number) => {
    if (!smsPermissionGranted) {
      Alert.alert('Erreur', 'Permission SMS non accordée.');
      return;
    }
    if (smsListenerActive) return;

    setSmsListenerActive(true);
    const subscription = SmsListener.addListener((message: SmsMessage) => {
      const smsBody = message.body;
      const smsDate = new Date(message.date);
      const currentDate = new Date();
      const timeDifference = (currentDate.getTime() - smsDate.getTime()) / 1000 / 60;
      if (timeDifference <= 3 && isPaymentConfirmationSms(smsBody, amount)) {
        handlePaymentConfirmation();
        subscription.remove();
        setSmsListenerActive(false);
        if (smsVerificationTimeout) {
          clearTimeout(smsVerificationTimeout);
        }
      }
    });

    const timeout = setTimeout(() => {
      subscription.remove();
      setSmsListenerActive(false);
      Alert.alert('Timeout', 'Aucune confirmation de paiement reçue dans le délai imparti');
      setPaymentStatus('failed');
      if (orderId) {
        updateDoc(doc(db, 'orders', orderId as string), { depositStatus: 'FAILED', paymentStatus: 'failed_timeout' });
      }
    }, 3 * 60 * 1000); // 3 minutes
    setSmsVerificationTimeout(timeout);
  }, [smsPermissionGranted, smsListenerActive, smsVerificationTimeout, orderId]);

  const handlePaymentConfirmation = async () => {
    if (!orderId) return;
    try {
      const orderRef = doc(db, 'orders', orderId as string);
      await updateDoc(orderRef, {
        depositStatus: 'PAID',
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Succès", "Paiement confirmé, commande validée !");
      router.push(`/order-confirmation/${orderId}` as any);
    } catch (error) {
      console.error('Erreur confirmation paiement:', error);
      Alert.alert("Erreur", "Une erreur est survenue lors de la confirmation du paiement.");
    }
  };

  const applyPromoCode = () => {
    const validPromo = PROMO_CODES.find(p => p.code === promoCode.toUpperCase());
    if (validPromo) {
      const discountAmount = finalAmountBeforeDiscount * (validPromo.discountPercentage / 100);
      setDiscount(discountAmount);
      Alert.alert("Succès", `Code promo appliqué ! Vous bénéficiez d'une réduction de ${validPromo.discountPercentage}%.`);
    } else {
      setDiscount(0);
      Alert.alert("Erreur", "Code promo non valide.");
    }
  };

  const fetchSellerInfo = useCallback(async () => {
    if (!sellerId) {
      setLoadingSeller(false);
      return;
    }
    setLoadingSeller(true);
    try {
      const sellerDocRef = doc(db, 'users', sellerId as string);
      const sellerDocSnap = await getDoc(sellerDocRef);
      if (sellerDocSnap.exists()) {
        const data = sellerDocSnap.data();
        setSellerInfo({
          email: data.email,
          name: data.name || "Vendeur Anonyme",
          photoUrl: data.photoUrl || null,
          phoneNumber: data.sellerForm?.phoneNumber || null,
          shopName: data.sellerForm?.shopName || 'Boutique sans nom',
        });
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des infos vendeur:", error);
    } finally {
      setLoadingSeller(false);
    }
  }, [sellerId]);

  const fetchOrderItems = useCallback(async () => {
    if (!orderId) return;
    try {
        const orderDocRef = doc(db, 'orders', orderId as string);
        const orderDocSnap = await getDoc(orderDocRef);
        if (orderDocSnap.exists()) {
            const data = orderDocSnap.data();
            if (data.items && Array.isArray(data.items)) {
                setOrderItems(data.items);
            }
            if (data.status) {
              setOrderStatus(data.status);
            }
            if (data.depositStatus) {
              setDepositStatus(data.depositStatus);
            }
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des articles de la commande:", error);
    }
  }, [orderId]);

  useEffect(() => {
    fetchSellerInfo();
    fetchOrderItems();
    requestSmsPermission();
  }, [fetchSellerInfo, fetchOrderItems]);

  useEffect(() => {
    if (!orderId) return;
    const unsubscribe = onSnapshot(doc(db, 'orders', orderId as string), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const currentDepositStatus = data.depositStatus as 'PENDING' | 'PAID' | 'FAILED' | 'NOT_REQUIRED';
        setDepositStatus(currentDepositStatus || 'PENDING');
        setOrderStatus(data.status || 'En attente');
        
        if (currentDepositStatus === 'PAID' || (currentDepositStatus === 'NOT_REQUIRED' && data.status === 'confirmed')) {
          Alert.alert("Succès", "Commande confirmée ! Vous allez être redirigé vers la page de confirmation.");
          if (smsVerificationTimeout) clearTimeout(smsVerificationTimeout);
          if (smsListenerActive) SmsListener.removeListener(); // A vérifier avec l'API
          router.push(`/order-confirmation/${orderId}` as any);
        }
      }
    });

    return () => {
      unsubscribe();
      if (smsVerificationTimeout) {
        clearTimeout(smsVerificationTimeout);
      }
    };
  }, [orderId, router, smsVerificationTimeout, smsListenerActive]);

  const getLocation = async () => {
    setIsGettingLocation(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La permission d\'accéder à la localisation a été refusée.');
      setIsGettingLocation(false);
      return;
    }
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords: MapCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setSelectedCoordinates(coords);
      setCurrentLocation(coords);
      
      // Récupérer l'adresse à partir des coordonnées
      let addressResponse = await Location.reverseGeocodeAsync(coords);
      if (addressResponse.length > 0) {
        const address = addressResponse[0];
        const formattedAddress = `${address.name || ''} ${address.street || ''}, ${address.city || ''}, ${address.region || ''}`;
        setSelectedAddress(formattedAddress);
        Alert.alert("Position actuelle", `Votre position a été détectée: ${formattedAddress}`);
      } else {
        Alert.alert("Position actuelle", "Votre position a été détectée avec précision.");
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'obtenir la localisation actuelle.");
      console.error("Erreur de géolocalisation:", error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    if (text.startsWith('2439') && text.length <= 12) {
      setPhoneNumber(text);
    }
  };

  const verifyTransaction = async (transactionId: string, operator: string) => {
    // Appel à une API de vérification (à implémenter côté serveur)
    const res = await fetch(`/api/verify-transaction?tx=${transactionId}&op=${operator}`);
    const data = await res.json();
    if (data.verified) {
      setTransactionStatus('success');
      // Envoie la commande à Firestore ici
    } else {
      setTransactionStatus('failed');
      setShowManualConfirm(true);
    }
  };

  const handleManualConfirmation = async (transactionId: string, smsMessage: string) => {
    await addDoc(collection(db, 'manual-confirm'), {
      transactionId,
      smsMessage,
      userId: authUser?.id ?? '',
      createdAt: serverTimestamp(),
    });
    alert('Confirmation envoyée, nous allons vérifier votre paiement.');
  };

  const handlePayment = async () => {
    if (isProcessing) return;
    const sellerPhoneNumber = sellerInfo?.phoneNumber;

    if (!phoneNumber || phoneNumber.length !== 12 || !phoneNumber.startsWith('2439')) {
      Alert.alert("Erreur", "Veuillez entrer un numéro de téléphone valide commençant par 2439 et ayant 12 chiffres");
      return;
    }

    if (!selectedProvider) {
      Alert.alert("Erreur", "Veuillez choisir un fournisseur.");
      return;
    }

    if (isDeliverySelected) {
      if (!deliveryLocation || !deliveryAddress || !selectedCoordinates) {
        Alert.alert("Erreur", "Veuillez renseigner les détails de livraison et la position sur la carte.");
        return;
      }
    } else {
      if (!selectedPickupHouse) {
        Alert.alert("Erreur", "Veuillez sélectionner un point de retrait.");
        return;
      }
    }

    if (!sellerPhoneNumber) {
        Alert.alert("Erreur", "Le numéro de téléphone du vendeur n'a pas pu être récupéré.");
        return;
    }

    if (!authUser?.id || !orderId) {
        Alert.alert("Erreur", "Informations de commande ou d'utilisateur manquantes.");
        return;
    }
    
    setIsProcessing(true);
    setPaymentStatus('initiating');

    try {
      const orderRef = doc(db, 'orders', orderId as string);

      // Mise à jour de la commande dans Firestore avec toutes les informations
      await updateDoc(orderRef, {
        deliveryType: isDeliverySelected ? 'delivery' : 'pickup',
        deliveryLocation: isDeliverySelected ? deliveryLocation : selectedPickupHouse,
        deliveryAddress: isDeliverySelected ? deliveryAddress : 'Non applicable',
        deliveryCoordinates: isDeliverySelected && selectedCoordinates ? selectedCoordinates : null,
        customerMessageToSeller,
        status: isDeliverySelected ? 'pending' : 'confirmed',
        paymentStatus: isDeliverySelected ? 'pending_initiation' : 'paid_on_pickup',
        updatedAt: serverTimestamp(),
        appFee: appFeeAmount,
        deliveryFee: deliveryFee,
        discountApplied: discount,
        finalAmount: finalTotalAmount,
        phoneNumber: phoneNumber,
        provider: selectedProvider,
        depositRequired: isDeliverySelected,
        depositAmount: isDeliverySelected ? depositAmount : 0,
        depositStatus: isDeliverySelected ? 'PENDING' : 'NOT_REQUIRED',
        customerName: authUser?.name || 'Client',
        customerEmail: authUser?.email || '',
        estimatedDeliveryTime: isDeliverySelected ? '45 min' : 'Immédiat',
        orderItems: orderItems,
        sellerInfo: sellerInfo,
      });

      if (isDeliverySelected) {
        const hasPermission = await requestSmsPermission();
        if (!hasPermission) {
          Alert.alert('Attention', 'La vérification automatique par SMS ne fonctionnera pas sans permission');
        }

        setPaymentStatus('pending_confirmation');
        Alert.alert("Paiement en cours", "Veuillez confirmer le paiement sur votre téléphone. Ne quittez pas cette page.");

        // Correction du payload pour correspondre aux attentes du serveur
        const payload = {
          userId: authUser.id,
          orderId: orderId,
          sellerId: sellerId,
          phoneNumber: phoneNumber,
          provider: selectedProvider,
          amount: depositAmount,
          currency: 'CDF',
          description: `Dépôt commande ${orderId}`,
          recipientPhoneNumber: sellerPhoneNumber,
        };

        console.log("Envoi de la requête avec payload:", JSON.stringify(payload, null, 2));

        const response = await fetch(`${PAWAPAY_WEBHOOK_URL}/initiate-deposit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log("Réponse du serveur:", JSON.stringify(result, null, 2));

        if (response.ok && result.success) {
          startSmsListener(depositAmount);
        } else {
          setPaymentStatus('failed');
          console.error("Échec de l'initiation du paiement Pawapay:", JSON.stringify(result, null, 2));
          Alert.alert("Erreur", result.message || "Une erreur est survenue lors de l'initiation du paiement.");
          await updateDoc(orderRef, { paymentStatus: 'failed_initiation' });
        }
      } else {
        setPaymentStatus('success');
        Alert.alert("Succès", "Commande confirmée ! Vous paierez sur place.");
        router.push(`/order-confirmation/${orderId}` as any);
      }

    } catch (error) {
      console.error("Erreur lors de la confirmation du paiement:", error);
      setPaymentStatus('failed');
      Alert.alert("Erreur", "Erreur: Impossible de communiquer avec le service de paiement.");
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId as string), { paymentStatus: 'failed_network' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLocationSelect = (coords: MapCoordinates, address: string) => {
    setSelectedCoordinates(coords);
    setSelectedAddress(address);
    setDeliveryAddress(address); // Pré-remplir l'adresse de livraison
  };

  const isPaymentButtonDisabled = () => {
    if (isProcessing) return true;
    if (!phoneNumber || phoneNumber.length !== 12 || !phoneNumber.startsWith('2439')) return true;
    if (!selectedProvider) return true;
    if (isDeliverySelected) {
      if (!deliveryLocation || !deliveryAddress || !selectedCoordinates) return true;
    } else {
      if (!selectedPickupHouse) return true;
    }
    return false;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Paiement</Text>
            <TouchableOpacity onPress={handleShareOrder} style={styles.shareButton}>
              <Ionicons name="share-social" size={24} color="#6C63FF" />
            </TouchableOpacity>
          </View>

          {loadingSeller ? (
            <ActivityIndicator size="small" color="#6C63FF" style={{ marginVertical: 20 }} />
          ) : sellerInfo ? (
            <View style={styles.sellerInfoContainer}>
              <View style={styles.sellerDetails}>
                <Image
                  source={{ uri: sellerInfo.photoUrl || 'https://placehold.co/100x100' }}
                  style={styles.sellerImage}
                />
                <View style={styles.sellerText}>
                  <Text style={styles.shopNameText}>{sellerInfo.shopName || 'Boutique Anonyme'}</Text>
                  <Text style={styles.sellerNameText}>{sellerInfo.name}</Text>
                  <Text style={styles.sellerPhoneText}>{sellerInfo.phoneNumber}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Informations du vendeur non disponibles.</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type de commande</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Livraison</Text>
              <Switch
                value={isDeliverySelected}
                onValueChange={setIsDeliverySelected}
                trackColor={{ false: "#ccc", true: "#6C63FF" }}
                thumbColor="#f4f3f4"
              />
              <Text style={styles.switchText}>Retrait</Text>
            </View>
          </View>

          {isDeliverySelected ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détails de la livraison</Text>
              <TextInput
                style={styles.input}
                placeholder="Lieu de livraison (ex: Bumbu, Limete...)"
                value={deliveryLocation}
                onChangeText={setDeliveryLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Adresse détaillée (ex: Av. du 24, n°45)"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
              />
              <TouchableOpacity style={styles.mapButton} onPress={() => setMapModalVisible(true)}>
                <Feather name="map-pin" size={18} color="#fff" />
                <Text style={styles.mapButtonText}>
                  {selectedCoordinates ? 'Position sélectionnée' : 'Sélectionner sur la carte'}
                </Text>
              </TouchableOpacity>
              {selectedAddress ? (
                <Text style={styles.addressDisplayText} numberOfLines={2}>
                  {selectedAddress}
                </Text>
              ) : null}
              <Text style={styles.deliveryInfoText}>Frais de livraison: {DELIVERY_FEE} CDF</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Point de retrait</Text>
              <FlatList
                data={PICKUP_HOUSES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.providerButton, selectedPickupHouse === item && styles.selectedProviderButton]}
                    onPress={() => setSelectedPickupHouse(item)}
                  >
                    <Text style={[styles.providerText, selectedPickupHouse === item && styles.selectedProviderText]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
              <Text style={styles.deliveryInfoText}>Vous paierez sur place</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détails de paiement</Text>
            <TextInput
              style={styles.input}
              placeholder="Numéro de téléphone (2439...)"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              maxLength={12}
            />
            <Text style={styles.label}>Fournisseur de service</Text>
            <View style={styles.providerContainer}>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'VODACOM_MPESA_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('VODACOM_MPESA_COD')}
              >
                <Image source={require('@/assets/images/vodacom.png')} style={styles.providerIcon} />
                <Text style={[styles.providerText, selectedProvider === 'VODACOM_MPESA_COD' && styles.selectedProviderText]}>M-Pesa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'ORANGE_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('ORANGE_COD')}
              >
                <Image source={require('@/assets/images/orange.png')} style={styles.providerIcon} />
                <Text style={[styles.providerText, selectedProvider === 'ORANGE_COD' && styles.selectedProviderText]}>Orange Money</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'AIRTEL_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('AIRTEL_COD')}
                >
                <Image source={require('@/assets/images/airtel.png')} style={styles.providerIcon} />
                <Text style={[styles.providerText, selectedProvider === 'AIRTEL_COD' && styles.selectedProviderText]}>Airtel Money</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            {orderItems.map((item, index) => (
              <View key={index} style={styles.summaryItem}>
                <Text style={styles.summaryItemText}>{item.name} x {item.quantity}</Text>
                <Text style={styles.summaryItemValue}>{item.price * item.quantity} CDF</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemText}>Sous-total</Text>
              <Text style={styles.summaryItemValue}>{parsedTotalAmount} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemText}>Frais de service (5%)</Text>
              <Text style={styles.summaryItemValue}>{appFeeAmount.toFixed(2)} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemText}>Frais de livraison</Text>
              <Text style={styles.summaryItemValue}>{deliveryFee} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemText}>Réduction</Text>
              <Text style={styles.summaryItemValue}>- {discount.toFixed(2)} CDF</Text>
            </View>
            <View style={[styles.summaryItem, styles.totalItem]}>
              <Text style={styles.summaryTotalText}>Total à payer</Text>
              <Text style={styles.summaryTotalValue}>{finalTotalAmount.toFixed(2)} CDF</Text>
            </View>
            {isDeliverySelected && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemText}>Acompte requis (10%)</Text>
                <Text style={styles.summaryItemValue}>{depositAmount.toFixed(2)} CDF</Text>
              </View>
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Code promo</Text>
            <View style={styles.promoContainer}>
              <TextInput
                style={styles.promoInput}
                placeholder="Entrer le code promo"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.promoButton} onPress={applyPromoCode}>
                <Text style={styles.promoButtonText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message au vendeur (optionnel)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Ex: Sonnez avant d'arriver..."
              value={customerMessageToSeller}
              onChangeText={setCustomerMessageToSeller}
              multiline
            />
          </View>

          {transactionStatus === 'failed' && showManualConfirm && (
            <View style={styles.manualConfirmationContainer}>
              <Text style={styles.manualConfirmationText}>Votre transaction n'a pas pu être vérifiée automatiquement.</Text>
              <Text style={styles.manualConfirmationText}>Collez ici le message reçu de l'opérateur Mobile Money :</Text>
              <TextInput
                style={styles.smsMessageInput}
                value={smsMessage}
                onChangeText={setSmsMessage}
                multiline
              />
              <TouchableOpacity
                style={styles.confirmManualButton}
                onPress={() => handleManualConfirmation(orderId as string, smsMessage)}
              >
                <Text style={styles.confirmManualButtonText}>Confirmer manuellement</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.payButtonContainer}>
          <TouchableOpacity
            style={[styles.payButton, isPaymentButtonDisabled() && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={isPaymentButtonDisabled()}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>
                {isDeliverySelected ? `Payer ${depositAmount.toFixed(2)} CDF (acompte)` : 'Confirmer la commande'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <MapModal
        isVisible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onLocationSelect={handleLocationSelect}
        initialCoordinates={selectedCoordinates}
        onGetLocation={getLocation}
        isGettingLocation={isGettingLocation}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 20, backgroundColor: '#f7f7f7' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 10, marginRight: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', flex: 1 },
  shareButton: { padding: 10 },
  sellerInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sellerDetails: { flexDirection: 'row', alignItems: 'center' },
  sellerImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  sellerText: { flex: 1 },
  shopNameText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sellerNameText: { fontSize: 16, color: '#666' },
  sellerPhoneText: { fontSize: 14, color: '#999' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
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
    minHeight: 100,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  providerContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  selectedProviderButton: { backgroundColor: '#6C63FF' },
  providerIcon: { width: 25, height: 25, marginRight: 10 },
  providerText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  selectedProviderText: { color: '#fff' },
  payButtonContainer: { padding: 20, backgroundColor: '#eee', alignItems: 'center' },
  payButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignSelf: 'stretch',
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
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  mapWebView: { flex: 1, marginTop: 10 },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  mapConfirmButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginLeft: 10,
  },
  mapConfirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    gap: 5,
  },
  locationButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  switchText: { fontSize: 16, color: '#333', marginHorizontal: 10 },
  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  mapButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  deliveryInfoText: { fontSize: 14, color: '#666', marginTop: 10, textAlign: 'center' },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  summaryItemText: { fontSize: 16, color: '#666' },
  summaryItemValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  totalItem: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  summaryTotalText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  summaryTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#6C63FF' },
  promoContainer: { flexDirection: 'row', alignItems: 'center' },
  promoInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 15, marginRight: 10, fontSize: 16 },
  promoButton: { backgroundColor: '#6C63FF', borderRadius: 10, padding: 15 },
  promoButtonText: { color: '#fff', fontWeight: 'bold' },
  infoBox: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 20, alignItems: 'center' },
  infoText: { fontSize: 16, color: '#666' },
  label: { fontSize: 16, color: '#666', marginBottom: 5, marginTop: 10 },
  addressContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  addressDisplayText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  manualConfirmationContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  manualConfirmationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  smsMessageInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  confirmManualButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmManualButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PayScreen;