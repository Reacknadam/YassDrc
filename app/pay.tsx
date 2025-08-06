import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Image,
  Dimensions,
  Switch,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';

// --- INTERFACES & TYPES (1. Définition des types pour un code plus robuste) ---
interface MapCoordinates {
  latitude: number;
  longitude: number;
}

interface SellerInfo {
  email: string;
  name?: string;
  photoBase64?: string | null;
  phoneNumber?: string; // Le numéro de téléphone du vendeur
  shopName?: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  photoUrl?: string;
}

interface PromoCode {
  code: string;
  discountPercentage: number;
}

// --- CONSTANTES & LOGIQUE MÉTIER ---
const PAWAPAY_WEBHOOK_URL = 'https://yass-webhook.israelntalu328.workers.dev';
const APP_FEE_PERCENTAGE = 0.05;
const DELIVERY_FEE = 1000;
const PROMO_CODES: PromoCode[] = [{ code: 'YASS20', discountPercentage: 20 }];

// --- COMPOSANT MODAL DE CARTE AVEC WEBVIEW ---
interface MapModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLocationSelect: (coords: MapCoordinates) => void;
  initialCoordinates: MapCoordinates | null;
}

const MapModal: React.FC<MapModalProps> = ({ isVisible, onClose, onLocationSelect, initialCoordinates }) => {
  const [webViewRef, setWebViewRef] = useState<any>(null);
  const [currentCoordinates, setCurrentCoordinates] = useState<MapCoordinates | null>(initialCoordinates);

  useEffect(() => {
    setCurrentCoordinates(initialCoordinates);
  }, [initialCoordinates]);

  // Script pour la carte OpenStreetMap
  const htmlContent = useMemo(() => {
    const lat = initialCoordinates?.latitude || -4.325;
    const lng = initialCoordinates?.longitude || 15.3222;
    const hasInitialMarker = !!initialCoordinates;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OpenStreetMap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
        <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map').setView([${lat}, ${lng}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(map);

          let marker = null;
          if (${hasInitialMarker}) {
              marker = L.marker([${lat}, ${lng}]).addTo(map);
          }

          map.on('click', function(e) {
            const coords = e.latlng;
            if (marker) {
              map.removeLayer(marker);
            }
            marker = L.marker(coords).addTo(map);
            window.ReactNativeWebView.postMessage(JSON.stringify(coords));
          });
        </script>
      </body>
      </html>
    `;
  }, [initialCoordinates]);

  // Gère les messages de la WebView (coordonnées cliquées)
  const handleWebViewMessage = useCallback((event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    setCurrentCoordinates({ latitude: data.lat, longitude: data.lng });
  }, []);

  const handleConfirmLocation = () => {
    if (currentCoordinates) {
      onLocationSelect(currentCoordinates);
      onClose();
    } else {
      Alert.alert("Erreur", "Veuillez sélectionner un point sur la carte.");
    }
  };

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
          ref={(ref) => setWebViewRef(ref)}
          style={styles.map}
          source={{ html: htmlContent }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          originWhitelist={['*']}
        />
        <TouchableOpacity style={styles.mapConfirmButton} onPress={handleConfirmLocation}>
          <Text style={styles.mapConfirmButtonText}>Confirmer la position</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

// --- COMPOSANT PRINCIPAL DE LA PAGE DE PAIEMENT (Avec 20+ fonctionnalités) ---
const PayScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { orderId, totalAmount, sellerId } = params;

  // États pour les détails de la commande et du paiement
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('243'); // Pré-rempli avec le code de la RDC
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerMessageToSeller, setCustomerMessageToSeller] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initiating' | 'pending_confirmation' | 'success' | 'failed'>('idle');
  const [isDeliverySelected, setIsDeliverySelected] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<MapCoordinates | null>(null);
  const [paymentConfirmationModal, setPaymentConfirmationModal] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderStatus, setOrderStatus] = useState('En attente');
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('45 min');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // 8. Calculs optimisés avec useMemo
  const parsedTotalAmount = useMemo(() => totalAmount ? parseFloat(totalAmount as string) : 0, [totalAmount]);
  const appFeeAmount = useMemo(() => parsedTotalAmount * APP_FEE_PERCENTAGE, [parsedTotalAmount]);
  const deliveryFee = useMemo(() => isDeliverySelected ? DELIVERY_FEE : 0, [isDeliverySelected]);
  const finalAmountBeforeDiscount = useMemo(() => parsedTotalAmount + appFeeAmount + deliveryFee, [parsedTotalAmount, appFeeAmount, deliveryFee]);
  const finalTotalAmount = useMemo(() => finalAmountBeforeDiscount - discount, [finalAmountBeforeDiscount, discount]);

  // 9. Fonction pour appliquer un code promo
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

  // 10. Fonction pour charger les infos du vendeur, mémorisée avec useCallback
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
          photoBase64: data.photoBase64 || null,
          // Correction : Accès au numéro de téléphone via sellerForm
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

  // 11. Fonction pour charger les articles de la commande
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
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des articles de la commande:", error);
    }
  }, [orderId]);

  // 30. Fonction pour obtenir la géolocalisation de l'utilisateur
  const getLocation = async () => {
    setIsGettingLocation(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La permission d\'accéder à la localisation a été refusée.');
      setIsGettingLocation(false);
      return;
    }

    try {
      let location = await Location.getCurrentPositionAsync({});
      const coords: MapCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setSelectedCoordinates(coords);
      Alert.alert("Position actuelle", `Votre position a été détectée.`);
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'obtenir la localisation actuelle.");
      console.error("Erreur de géolocalisation:", error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Séparation des useEffect pour éviter les boucles infinies.
  // 1. Un useEffect pour charger les infos du vendeur et de la commande, dépendant uniquement de leurs IDs.
  useEffect(() => {
    fetchSellerInfo();
    fetchOrderItems();
  }, [fetchSellerInfo, fetchOrderItems]);

  // 2. Un useEffect distinct pour la géolocalisation qui ne se déclenche qu'une seule fois.
  useEffect(() => {
    // Si des coordonnées sont déjà sélectionnées, on ne fait rien
    if (selectedCoordinates) return;
    getLocation();
  }, []); // Dépendance vide pour ne s'exécuter qu'au montage

  const handlePayment = async () => {
    if (isProcessing) return;

    // Récupération automatique du numéro de téléphone du vendeur depuis l'état
    const sellerPhoneNumber = sellerInfo?.phoneNumber;

    if (!phoneNumber || !selectedProvider) {
      Alert.alert("Erreur", "Veuillez entrer votre numéro de téléphone et choisir un fournisseur.");
      return;
    }
    if (isDeliverySelected && (!deliveryLocation || !deliveryAddress || !selectedCoordinates)) {
      Alert.alert("Erreur", "Veuillez renseigner les détails de livraison et la position sur la carte.");
      return;
    }
    // Vérification stricte du numéro du vendeur
    if (!sellerPhoneNumber) {
        Alert.alert("Erreur", "Le numéro de téléphone du vendeur n'a pas pu être récupéré. Veuillez réessayer plus tard.");
        console.error("Le numéro de téléphone du vendeur est manquant dans la base de données.");
        return;
    }
    if (!user?.id || !orderId) {
      Alert.alert("Erreur", "Informations de commande ou d'utilisateur manquantes.");
      return;
    }
    if (finalTotalAmount <= 0) {
      Alert.alert("Erreur", "Le montant total doit être supérieur à zéro pour effectuer un paiement.");
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('initiating');

    // CONSEIL DE SÉCURITÉ PROFESSIONNEL :
    // L'appel à l'API de paiement devrait idéalement être effectué depuis un serveur
    // sécurisé (un backend). Un appel depuis le client comme ici est vulnérable
    // à la manipulation des données (par exemple, un attaquant pourrait modifier
    // le montant). Pour une application en production, il est CRITIQUE de
    // router cette logique via une fonction Cloud ou une API backend.

    try {
      const orderRef = doc(db, 'orders', orderId as string);

      await updateDoc(orderRef, {
        deliveryType: isDeliverySelected ? 'delivery' : 'pickup',
        deliveryLocation: isDeliverySelected ? deliveryLocation : 'Retrait en magasin',
        deliveryAddress: isDeliverySelected ? deliveryAddress : 'Non applicable',
        // Stockage des coordonnées comme une chaîne JSON pour éviter les erreurs de type
        deliveryCoordinates: isDeliverySelected && selectedCoordinates ? JSON.stringify(selectedCoordinates) : null,
        customerMessageToSeller,
        status: 'pending',
        paymentStatus: 'pending_initiation',
        updatedAt: serverTimestamp(),
        appFee: appFeeAmount,
        deliveryFee: deliveryFee,
        discountApplied: discount,
        finalAmount: finalTotalAmount,
      });

      const payload = {
        userId: user.id,
        orderId: orderId,
        sellerId: sellerId,
        payerPhoneNumber: phoneNumber,
        recipientPhoneNumber: sellerPhoneNumber,
        provider: selectedProvider,
        amount: finalTotalAmount,
        currency: 'CDF',
        description: `Paiement commande ${orderId}`,
      };

      const response = await fetch(`${PAWAPAY_WEBHOOK_URL}/initiate-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPaymentStatus('pending_confirmation');
        Alert.alert("Succès", "Paiement initié ! Veuillez confirmer sur votre téléphone.");
      } else {
        setPaymentStatus('failed');
        console.error("Échec de l'initiation du paiement Pawapay:", JSON.stringify(result, null, 2));
        Alert.alert("Erreur", result.message || "Une erreur est survenue lors de l'initiation du paiement.");
        await updateDoc(orderRef, { paymentStatus: 'failed_initiation' });
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

  const handleLocationSelect = (coords: MapCoordinates) => {
    setSelectedCoordinates(coords);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'VODACOM_MPESA_COD': return "sim-outline";
      case 'ORANGE_COD': return "sim-outline";
      case 'AIRTEL_COD': return "sim-outline";
      default: return "credit-card-outline";
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Paiement en attente de confirmation';
      case 'confirmed': return 'Paiement réussi !';
      case 'failed': return 'Échec du paiement';
      default: return 'En attente';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Paiement de la Commande</Text>
          </View>

          <ScrollView style={styles.content}>
            {/* 13. Affichage des infos du vendeur et de l'utilisateur (avatar, nom, etc) */}
            {loadingSeller ? (
              <ActivityIndicator style={{ marginVertical: 20 }} size="small" color="#6C63FF" />
            ) : sellerInfo && (
              <View style={styles.sellerCard}>
                {sellerInfo.photoBase64 ? (
                  <Image source={{ uri: sellerInfo.photoBase64 }} style={styles.sellerImage} />
                ) : (
                  <Ionicons name="person-circle-outline" size={50} color="#ccc" style={styles.sellerImagePlaceholder} />
                )}
                <View style={styles.sellerInfoText}>
                  <Text style={styles.sellerShopName}>{sellerInfo.shopName}</Text>
                  <Text style={styles.sellerName}>par {sellerInfo.name}</Text>
                </View>
                {/* 14. Bouton de chat avec le vendeur */}
                <TouchableOpacity style={styles.chatButton}>
                  <Ionicons name="chatbox-outline" size={24} color="#6C63FF" />
                </TouchableOpacity>
              </View>
            )}

            {/* 15. Section du résumé de la commande et du total - affichage détaillé */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Résumé de la Commande</Text>
              <FlatList
                data={orderItems}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.orderItem}>
                    <View style={styles.orderItemPlaceholder}>
                        <Feather name="image" size={24} color="#666" />
                    </View>
                    <View style={styles.orderItemTextContainer}>
                      <Text style={styles.orderItemName}>{item.name}</Text>
                      <Text style={styles.orderItemQuantity}>Quantité: {item.quantity}</Text>
                    </View>
                    <Text style={styles.orderItemPrice}>{item.price.toLocaleString()} CDF</Text>
                  </View>
                )}
                scrollEnabled={false}
              />
              <View style={styles.divider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Sous-total</Text>
                <Text style={styles.summaryValue}>{parsedTotalAmount.toLocaleString()} CDF</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Frais de service (5%)</Text>
                <Text style={styles.summaryValue}>{appFeeAmount.toLocaleString()} CDF</Text>
              </View>
              {isDeliverySelected && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Frais de livraison</Text>
                  <Text style={styles.summaryValue}>{deliveryFee.toLocaleString()} CDF</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Remise du code promo</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>- {discount.toLocaleString()} CDF</Text>
                </View>
              )}
              <View style={styles.finalTotalContainer}>
                <Text style={styles.finalTotalLabel}>TOTAL À PAYER</Text>
                <Text style={styles.finalTotalValue}>{finalTotalAmount.toLocaleString()} CDF</Text>
              </View>
            </View>

            {/* 16. Section pour les codes promo */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Code Promotionnel</Text>
                <View style={styles.promoCodeContainer}>
                    <TextInput
                        style={styles.promoInput}
                        placeholder="Entrez un code promo"
                        value={promoCode}
                        onChangeText={setPromoCode}
                        autoCapitalize="characters"
                    />
                    <TouchableOpacity style={styles.applyPromoButton} onPress={applyPromoCode}>
                        <Text style={styles.applyPromoButtonText}>Appliquer</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 17. Section du choix de la livraison */}
            <View style={styles.card}>
              <View style={styles.deliverySwitchContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="motorbike" size={24} color={isDeliverySelected ? "#6C63FF" : "#888"} />
                    <Text style={styles.deliverySwitchLabel}>Livraison à Domicile</Text>
                </View>
                <Switch
                  onValueChange={setIsDeliverySelected}
                  value={isDeliverySelected}
                  trackColor={{ false: "#ccc", true: "#6C63FF" }}
                  thumbColor="#fff"
                />
              </View>
              {/* 18. Affichage du statut de la commande et du temps de livraison estimé */}
              <View style={styles.statusContainer}>
                  <Text style={styles.statusLabel}>Statut de la commande :</Text>
                  <Text style={styles.statusValue}>{orderStatus}</Text>
              </View>
              {isDeliverySelected && (
                  <View style={styles.statusContainer}>
                      <Text style={styles.statusLabel}>Livraison estimée :</Text>
                      <Text style={styles.statusValue}>{estimatedDeliveryTime}</Text>
                  </View>
              )}
            </View>

            {/* 19. Section des détails de livraison (conditionnelle) */}
            {isDeliverySelected && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Détails de Livraison</Text>
                {/* 20. Bouton pour sélectionner la position sur une carte interactive */}
                <TouchableOpacity style={styles.mapButton} onPress={() => setMapModalVisible(true)}>
                  <Text style={styles.mapButtonText}>Choisir la position sur la carte</Text>
                  <Feather name="map-pin" size={20} color="#6C63FF" />
                </TouchableOpacity>
                {/* 31. Bouton pour utiliser la position actuelle de l'utilisateur */}
                <TouchableOpacity
                  style={[styles.mapButton, styles.locationButton]}
                  onPress={getLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={[styles.mapButtonText, styles.locationButtonText]}>Utiliser ma position actuelle</Text>
                      <Ionicons name="locate-outline" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
                {selectedCoordinates && (
                  <View style={styles.selectedLocationContainer}>
                    <Text style={styles.selectedLocationText}>
                      Position sélectionnée :
                    </Text>
                    <Text style={styles.selectedLocationCoords}>
                      Lat: {selectedCoordinates.latitude.toFixed(4)}, Long: {selectedCoordinates.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}
                {/* 21. Champ pour l'adresse de livraison */}
                <TextInput
                  style={styles.input}
                  placeholder="Quartier, rue ou point de repère"
                  value={deliveryLocation}
                  onChangeText={setDeliveryLocation}
                />
                {/* 22. Champ pour les instructions de livraison */}
                <TextInput
                  style={styles.input}
                  placeholder="Description détaillée de l'adresse"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                />
                {/* 23. Champ pour les notes de l'utilisateur au vendeur */}
                <TextInput
                  style={styles.input}
                  placeholder="Message au livreur (optionnel)"
                  value={customerMessageToSeller}
                  onChangeText={setCustomerMessageToSeller}
                />
              </View>
            )}

            {/* 24. Section du formulaire de paiement */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Informations de Paiement</Text>
              <Text style={styles.disclaimer}>Entrez votre numéro et choisissez votre fournisseur pour payer.</Text>
              <TextInput
                style={styles.input}
                placeholder="Votre numéro de téléphone (Ex: 243...)"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={12}
              />
              {/* 25. Sélection du fournisseur de paiement */}
              <View style={styles.providerButtonsContainer}>
                {['VODACOM_MPESA_COD', 'ORANGE_COD', 'AIRTEL_COD'].map((provider) => (
                    <TouchableOpacity
                      key={provider}
                      style={[styles.providerButton, selectedProvider === provider && styles.selectedProviderButton]}
                      onPress={() => setSelectedProvider(provider)}
                    >
                      <MaterialCommunityIcons
                        name={getProviderIcon(provider)}
                        size={20}
                        color={selectedProvider === provider ? '#fff' : '#6C63FF'}
                      />
                      <Text style={[styles.providerButtonText, selectedProvider === provider && styles.selectedProviderButtonText]}>
                        {provider.split('_')[0]}
                      </Text>
                    </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 26. Bouton de confirmation du paiement */}
            <TouchableOpacity
              style={[styles.paymentButton, (isProcessing || !phoneNumber || !selectedProvider) && styles.disabledButton]}
              onPress={() => setPaymentConfirmationModal(true)}
              disabled={isProcessing || !phoneNumber || !selectedProvider}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Payer {finalTotalAmount.toLocaleString()} CDF</Text>
              )}
            </TouchableOpacity>

            {/* 27. Modale de confirmation avant le paiement */}
            <Modal visible={paymentConfirmationModal} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={styles.confirmationModalCard}>
                  <Text style={styles.modalTitle}>Confirmer le paiement</Text>
                  <View style={styles.modalSummaryItem}>
                    <Text style={styles.modalSummaryLabel}>Fournisseur:</Text>
                    <Text style={styles.modalSummaryValue}>{selectedProvider?.split('_')[0]}</Text>
                  </View>
                  <View style={styles.modalSummaryItem}>
                    <Text style={styles.modalSummaryLabel}>Numéro:</Text>
                    <Text style={styles.modalSummaryValue}>{phoneNumber}</Text>
                  </View>
                  <View style={styles.modalSummaryItem}>
                    <Text style={styles.modalSummaryLabel}>Montant:</Text>
                    <Text style={styles.modalSummaryValue}>{finalTotalAmount.toLocaleString()} CDF</Text>
                  </View>
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ccc' }]} onPress={() => setPaymentConfirmationModal(false)}>
                      <Text style={styles.modalButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#6C63FF' }]} onPress={() => { setPaymentConfirmationModal(false); handlePayment(); }}>
                      <Text style={[styles.modalButtonText, { color: '#fff' }]}>Confirmer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* 28. Composant de la carte en modale */}
            <MapModal
              isVisible={mapModalVisible}
              onClose={() => setMapModalVisible(false)}
              onLocationSelect={handleLocationSelect}
              initialCoordinates={selectedCoordinates}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  orderItemPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemTextContainer: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  orderItemQuantity: {
    fontSize: 13,
    color: '#666',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  discountText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginVertical: 10,
  },
  finalTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  finalTotalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  disclaimer: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderColor: '#e8e8e8',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fbfbfb',
    fontSize: 16,
  },
  promoCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  promoInput: {
    flex: 1,
    height: 50,
    borderColor: '#e8e8e8',
    borderWidth: 1,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fbfbfb',
    fontSize: 16,
  },
  applyPromoButton: {
    height: 50,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  applyPromoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  providerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    margin: 5,
    flex: 1,
    gap: 8,
  },
  selectedProviderButton: {
    backgroundColor: '#6C63FF',
  },
  providerButtonText: {
    color: '#555',
    fontWeight: 'bold',
  },
  selectedProviderButtonText: {
    color: '#fff',
  },
  paymentButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deliverySwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  deliverySwitchLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 15,
    color: '#666',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  mapButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e8e6ff',
    borderRadius: 10,
    marginBottom: 15,
    borderColor: '#6C63FF',
    borderWidth: 1,
  },
  mapButtonText: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: 'bold',
    marginRight: 10,
  },
  selectedLocationContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  selectedLocationText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedLocationCoords: {
    fontSize: 14,
    color: '#6C63FF',
  },
  mapModalContainer: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 15,
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  mapConfirmButton: {
    backgroundColor: '#6C63FF',
    padding: 18,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  mapConfirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationButton: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
    flexDirection: 'row',
    gap: 10,
  },
  locationButtonText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModalCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalSummaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  modalSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sellerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sellerImagePlaceholder: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerInfoText: {
    marginLeft: 15,
    flex: 1,
  },
  sellerShopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sellerName: {
    fontSize: 14,
    color: '#888',
  },
  chatButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#e8e6ff',
  },
});

export default PayScreen;
