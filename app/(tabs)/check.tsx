import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Platform,
  TextInput,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  doc,
  collection,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '@/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
// Importations de la librairie native de cartographie
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// =================================================================
// 🚀 Typages & Enums
// =================================================================

enum OrderStatus {
  PendingDeliveryChoice = 'pending_delivery_choice',
  SellerDelivering = 'seller_delivering',
  AppDelivering = 'app_delivering',
  Delivered = 'delivered',
  ManualVerification = 'manual_verification',
  Confirmed = 'confirmed',
}

enum DeliveryMethod {
  SellerDelivery = 'seller_delivery',
  AppDelivery = 'app_delivery',
}

enum PaymentStatus {
    Pending = 'pending',
    Paid = 'paid',
    PaidOnSite = 'paid_on_site',
    VerificationNeeded = 'verification_needed'
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCoordinates: Coordinates;
  totalAmount: number;
  status: OrderStatus;
  deliveryMethod?: DeliveryMethod;
  paymentStatus: PaymentStatus;
  sellerId: string;
  createdAt: any;
  proofType?: 'photo' | 'text';
  proofContent?: string;
  deliveredAt?: any;
}

interface UserType {
  id: string;
  email: string;
  isSellerVerified: boolean;
  name?: string;
  phone?: string;
}

// =================================================================
// 🧠 Hooks Personnalisés
// =================================================================

const useLocationTracking = () => {
    const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);

    useEffect(() => {
        let subscription: Location.LocationSubscription | undefined;
        const startTracking = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setPermissionError('Permission de localisation refusée. Les fonctionnalités de carte sont désactivées.');
                    return;
                }
                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
                    setCurrentLocation
                );
            } catch (error) {
                console.error("Erreur d'initialisation de la localisation:", error);
                setPermissionError("Impossible d'obtenir la localisation.");
            }
        };

        startTracking();
        return () => subscription?.remove();
    }, []);

    return { currentLocation, permissionError };
};

// =================================================================
// 🎨 Composants Modulaires
// =================================================================

interface ProofOfDeliveryModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (proofType: 'photo' | 'text', content: string) => Promise<void>;
    order: Order | null;
}

const ProofOfDeliveryModal = ({ visible, onClose, onSubmit, order }: ProofOfDeliveryModalProps) => {
    const [proofType, setProofType] = useState<'photo' | 'text'>('photo');
    const [proofText, setProofText] = useState('');
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            setProofType('photo');
            setProofText('');
            setProofImage(null);
        }
    }, [visible]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire pour ajouter une preuve.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });
        if (!result.canceled) {
            setProofImage(result.assets[0].uri);
        }
    };
    
    const handleSubmit = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (proofType === 'photo' && proofImage) {
                await onSubmit('photo', proofImage);
            } else if (proofType === 'text' && proofText.trim()) {
                await onSubmit('text', proofText.trim());
            } else {
                 Alert.alert("Erreur", "Veuillez fournir une preuve valide.");
            }
        } catch (error) {
             Alert.alert("Échec de l'envoi", "Une erreur est survenue. Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!order) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Preuve de Livraison</Text>
                    <Text style={styles.modalText}>Commande #{order.id.slice(-6)}</Text>
                    
                    <View style={styles.proofTypeSelector}>
                        <TouchableOpacity onPress={() => setProofType('photo')} style={[styles.tabButton, proofType === 'photo' && styles.activeTab]}>
                           <Text style={[styles.tabText, proofType === 'photo' && styles.activeTabText]}>Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setProofType('text')} style={[styles.tabButton, proofType === 'text' && styles.activeTab]}>
                           <Text style={[styles.tabText, proofType === 'text' && styles.activeTabText]}>Texte</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {proofType === 'photo' ? (
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                                <Ionicons name="camera" size={24} color="#fff" />
                                <Text style={styles.choiceButtonText}>Choisir une photo</Text>
                            </TouchableOpacity>
                            {proofImage && <Image source={{ uri: proofImage }} style={styles.proofImagePreview} />}
                        </View>
                    ) : (
                        <TextInput
                            style={styles.proofTextInput}
                            placeholder="Entrez le SMS, nom du réceptionnaire, etc."
                            multiline
                            value={proofText}
                            onChangeText={setProofText}
                        />
                    )}
                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={[styles.modalButton, styles.buttonClose]} onPress={onClose}>
                            <Text style={styles.textStyle}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.buttonConfirm]} onPress={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.textStyle}>Soumettre</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

interface MapModalComponentProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
    currentLocation: Location.LocationObject | null;
    permissionError: string | null;
}

const MapModalComponent = ({ visible, onClose, order, currentLocation, permissionError }: MapModalComponentProps) => {
    if (!order || !visible) return null;

    const initialRegion = currentLocation
        ? {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
          }
        : null;

    const deliveryCoords = {
        latitude: order.deliveryCoordinates.latitude,
        longitude: order.deliveryCoordinates.longitude,
    };
    
    // Style de la carte personnalisé (identique à index.tsx pour une cohérence visuelle)
    const mapStyle = [
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
    ];

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.mapHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={30} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.mapTitle}>Livraison de la Commande #{order.id.slice(-6)}</Text>
                </View>
                {permissionError ? (
                    <View style={styles.mapErrorContainer}>
                        <Text style={styles.mapErrorText}>{permissionError}</Text>
                        <Text style={styles.mapErrorSubText}>Veuillez activer la localisation dans les paramètres de votre téléphone.</Text>
                    </View>
                ) : !initialRegion ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6C63FF" />
                        <Text style={styles.loadingText}>Chargement de la carte...</Text>
                    </View>
                ) : (
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={initialRegion}
                        showsUserLocation
                        followsUserLocation
                        customMapStyle={mapStyle} // Ajout du style personnalisé
                    >
                        {/* Marqueur pour votre position (le livreur) */}
                        <Marker
                            coordinate={{
                                latitude: currentLocation?.coords.latitude || 0,
                                longitude: currentLocation?.coords.longitude || 0,
                            }}
                            title="Votre Position"
                            pinColor="#6C63FF" // Couleur pour votre position
                        />
                        {/* Marqueur pour la destination */}
                        <Marker
                            coordinate={deliveryCoords}
                            title="Destination"
                            description={order.deliveryAddress}
                            pinColor="#FF3B30" // Couleur pour la destination
                        />
                        {/* Ligne pour le trajet */}
                        <Polyline
                            coordinates={
                                currentLocation
                                    ? [
                                          {
                                              latitude: currentLocation.coords.latitude,
                                              longitude: currentLocation.coords.longitude,
                                          },
                                          deliveryCoords,
                                      ]
                                    : [deliveryCoords] // Affiche seulement un point si la position actuelle n'est pas disponible
                            }
                            strokeColor="#6C63FF"
                            strokeWidth={4}
                        />
                    </MapView>
                )}
            </SafeAreaView>
        </Modal>
    );
};

interface DeliveryHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
}

const DeliveryHistoryModal = ({ visible, onClose, order }: DeliveryHistoryModalProps) => {
    if (!order || !visible) return null;
    const deliveredAt = order.deliveredAt?.toDate();
    const formattedDate = deliveredAt ? format(deliveredAt, 'd MMMM yyyy à HH:mm', { locale: fr }) : 'Non disponible';
    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Détails de la Livraison</Text>
                    <ScrollView style={{ width: '100%', maxHeight: Dimensions.get('window').height * 0.7 }}>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Commande :</Text>
                            <Text style={styles.modalInfoValue}>#{order.id.slice(-6)}</Text>
                        </View>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Client :</Text>
                            <Text style={styles.modalInfoValue}>{order.customerName}</Text>
                        </View>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Adresse :</Text>
                            <Text style={styles.modalInfoValue}>{order.deliveryAddress}</Text>
                        </View>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Montant total :</Text>
                            <Text style={styles.modalInfoValue}>{order.totalAmount} €</Text>
                        </View>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Date de livraison :</Text>
                            <Text style={styles.modalInfoValue}>{formattedDate}</Text>
                        </View>
                        <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Statut :</Text>
                            <Text style={styles.modalInfoValue}>{order.status === OrderStatus.Delivered ? "Livrée" : "Vérification manuelle"}</Text>
                        </View>
                        {order.proofType && (
                            <>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalInfoLabel}>Preuve de livraison :</Text>
                                    <Text style={styles.modalInfoValue}>{order.proofType === 'photo' ? "Photo" : "Texte"}</Text>
                                </View>
                                {order.proofType === 'photo' && order.proofContent ? (
                                    <Image source={{ uri: order.proofContent }} style={styles.proofImagePreview} />
                                ) : (
                                    <Text style={styles.proofTextContent}>{order.proofContent}</Text>
                                )}
                            </>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={[styles.modalButton, styles.buttonConfirm]} onPress={onClose}>
                        <Text style={styles.textStyle}>Fermer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// =================================================================
// 🏡 Composant Principal (SellerDeliveryManagement)
// =================================================================

const SellerDeliveryManagement = () => {
  const { authUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const { currentLocation, permissionError } = useLocationTracking();

  const handleOpenMap = (order: Order) => {
    setSelectedOrder(order);
    setMapModalVisible(true);
  };

  const handleOpenProofModal = (order: Order) => {
      setSelectedOrder(order);
      setProofModalVisible(true);
  };
  
  const handleOpenHistoryModal = (order: Order) => {
      setSelectedOrder(order);
      setHistoryModalVisible(true);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
      if (processingOrder) return;
      setProcessingOrder(orderId);
      try {
          await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
          Alert.alert('Succès', `Statut de la commande mis à jour vers ${newStatus}.`);
      } catch (error) {
          console.error("Erreur lors de la mise à jour du statut:", error);
          Alert.alert('Erreur', 'Impossible de mettre à jour le statut de la commande.');
      } finally {
          setProcessingOrder(null);
      }
  };

  const handleSendProof = async (proofType: 'photo' | 'text', content: string) => {
      if (!selectedOrder) return;
      
      let proofUrl = content;
      if (proofType === 'photo') {
          try {
              const response = await fetch(content);
              const blob = await response.blob();
              const imageRef = ref(storage, `proofs/${selectedOrder.id}-${Date.now()}`);
              const uploadResult = await uploadBytes(imageRef, blob);
              proofUrl = await getDownloadURL(uploadResult.ref);
          } catch (error) {
              console.error("Erreur lors de l'upload de l'image:", error);
              throw new Error("Impossible d'envoyer la preuve. Veuillez réessayer.");
          }
      }

      await updateDoc(doc(db, 'orders', selectedOrder.id), {
          status: OrderStatus.ManualVerification,
          proofType: proofType,
          proofContent: proofUrl,
          deliveredAt: serverTimestamp(),
      });
      setProofModalVisible(false);
      Alert.alert('Succès', 'Preuve envoyée. La commande est en attente de vérification manuelle.');
  };

  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('sellerId', '==', authUser.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: Order[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Erreur de récupération des commandes:", error);
      Alert.alert('Erreur', 'Impossible de récupérer vos commandes.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [authUser]);

  const renderOrder = ({ item: order }: { item: Order }) => {
    const isDeliveryPending = order.status === OrderStatus.PendingDeliveryChoice;
    const isDeliveryByMe = order.deliveryMethod === DeliveryMethod.SellerDelivery && order.status !== OrderStatus.Delivered;

    const getStatusText = () => {
        switch(order.status) {
            case OrderStatus.PendingDeliveryChoice: return 'En attente de choix';
            case OrderStatus.SellerDelivering: return 'En cours de livraison';
            case OrderStatus.AppDelivering: return 'Livraison par l\'app';
            case OrderStatus.Delivered: return 'Livrée';
            case OrderStatus.ManualVerification: return 'Vérification manuelle';
            case OrderStatus.Confirmed: return 'Confirmée';
            default: return 'Inconnu';
        }
    };
    
    const getPaymentStatusText = () => {
        switch(order.paymentStatus) {
            case PaymentStatus.Paid: return 'Payée';
            case PaymentStatus.PaidOnSite: return 'Payée sur place';
            case PaymentStatus.Pending: return 'En attente';
            case PaymentStatus.VerificationNeeded: return 'Vérification requise';
            default: return 'Inconnu';
        }
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Commande #{order.id.slice(-6)}</Text>
          <View style={[styles.statusBadge, isDeliveryPending && styles.pendingBadge]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
        <Text style={styles.cardInfo}>
          <Text style={styles.boldText}>Client:</Text> {order.customerName}
        </Text>
        <Text style={styles.cardInfo}>
          <Text style={styles.boldText}>Montant:</Text> {order.totalAmount} €
        </Text>
        <Text style={styles.cardInfo}>
          <Text style={styles.boldText}>Paiement:</Text> {getPaymentStatusText()}
        </Text>
        <Text style={styles.cardInfo}>
          <Text style={styles.boldText}>Adresse:</Text> {order.deliveryAddress}
        </Text>
        
        <View style={styles.cardActions}>
          {isDeliveryPending && (
            <View style={styles.deliveryChoices}>
              <TouchableOpacity
                style={styles.choiceButton}
                onPress={() => handleUpdateStatus(order.id, OrderStatus.SellerDelivering)}
              >
                <Ionicons name="car-sport-outline" size={20} color="#fff" />
                <Text style={styles.choiceButtonText}>Livrer moi-même</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceButton, styles.appDeliveryButton]}
                onPress={() => handleUpdateStatus(order.id, OrderStatus.AppDelivering)}
              >
                <Ionicons name="business-outline" size={20} color="#6C63FF" />
                <Text style={[styles.choiceButtonText, styles.appDeliveryButtonText]}>Livraison par app</Text>
              </TouchableOpacity>
            </View>
          )}

          {isDeliveryByMe && (
            <View style={styles.deliveryActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.mapButton]}
                onPress={() => handleOpenMap(order)}
              >
                <Ionicons name="map-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Voir la carte</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={() => handleOpenProofModal(order)}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Confirmer la livraison</Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === OrderStatus.Delivered && (
            <TouchableOpacity
              style={[styles.actionButton, styles.historyButton]}
              onPress={() => handleOpenHistoryModal(order)}
            >
              <Ionicons name="document-text-outline" size={20} color="#6C63FF" />
              <Text style={styles.actionButtonText}>Détails de la livraison</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const MemoizedOrder = React.memo(renderOrder);

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ marginTop: 20 }}>Chargement de vos commandes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Gérer les Livraisons</Text>
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MemoizedOrder item={item} />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
                <Ionicons name="car-outline" size={80} color="#ccc" />
                <Text style={styles.emptyStateText}>Aucune commande disponible</Text>
            </View>
          }
        />
        <ProofOfDeliveryModal visible={proofModalVisible} onClose={() => setProofModalVisible(false)} onSubmit={handleSendProof} order={selectedOrder} />
        <MapModalComponent visible={mapModalVisible} onClose={() => setMapModalVisible(false)} order={selectedOrder} currentLocation={currentLocation} permissionError={permissionError} />
        <DeliveryHistoryModal visible={historyModalVisible} onClose={() => setHistoryModalVisible(false)} order={selectedOrder} />
      </View>
    </SafeAreaView>
  );
};

// =================================================================
// 💅 Styles (ajout de styles manquants)
// =================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 15,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 20,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 50,
  },
  emptyStateText: {
      marginTop: 20,
      fontSize: 18,
      color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pendingBadge: {
      backgroundColor: '#FFC107',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  boldText: {
    fontWeight: 'bold',
  },
  cardActions: {
    marginTop: 15,
  },
  deliveryChoices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  appDeliveryButton: {
      backgroundColor: '#E6E4FF',
      borderWidth: 1,
      borderColor: '#6C63FF',
  },
  choiceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  appDeliveryButtonText: {
      color: '#6C63FF',
  },
  deliveryActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  mapButton: {
      backgroundColor: '#6C63FF',
      marginRight: 10,
  },
  confirmButton: {
      backgroundColor: '#28a745',
  },
  historyButton: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#6C63FF',
  },
  // Styles pour les Modales
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonClose: {
    backgroundColor: '#FF6B6B',
  },
  buttonConfirm: {
    backgroundColor: '#28a745',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  proofTypeSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 20,
      width: '100%',
  },
  tabButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
  },
  activeTab: {
      borderBottomColor: '#6C63FF',
  },
  tabText: {
      fontSize: 16,
      color: '#999',
      fontWeight: 'bold',
  },
  activeTabText: {
      color: '#6C63FF',
  },
  imagePickerButton: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
  },
  proofImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  proofTextInput: {
    width: '100%',
    height: 120,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  modalInfoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalInfoValue: {
    fontSize: 16,
    color: '#666',
    flexShrink: 1,
  },
  proofTextContent: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#555',
    marginTop: 10,
    textAlign: 'center',
    width: '100%',
  },
  // Nouveaux styles pour MapModalComponent
  map: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    marginRight: 15,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mapErrorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#f7f7f7',
  },
  mapErrorText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#d9534f',
      textAlign: 'center',
  },
  mapErrorSubText: {
      marginTop: 10,
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
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
  }
});
export default SellerDeliveryManagement;