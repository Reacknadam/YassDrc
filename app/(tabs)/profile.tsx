import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  Switch,
  FlatList,
  RefreshControl,
  Platform,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { Picker } from '@react-native-picker/picker';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  addDoc,
  deleteDoc,
  deleteField,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import * as ImagePickerExpo from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';

// --- INTERFACES ---
interface UserProfile {
  email: string;
  name?: string;
  photoBase64?: string | null;
  isSellerRequested?: boolean;
  isSellerVerified?: boolean;
  sellerForm?: SellerForm;
  sellerRequestId?: string;
  uid?: string;
  paymentId?: string;
}

interface SellerForm {
  shopName: string;
  idNumber: string;
  idType: string;
  businessDescription: string;
  phoneNumber: string;
  location: string;
  address: string;
  isAdult?: boolean;
}

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  productName: string;
  totalPrice: number;
  deliveryLocation: string;
  deliveryAddress: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt: Timestamp;
  productId: string;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  images: string[] | null;
  sellerId: string;
  createdAt: Timestamp;
  star: number;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: {
    text: string;
    timestamp: Timestamp;
    senderId: string;
  };
  unreadCounts: { [userId: string]: number };
  otherParticipant: string;
  otherParticipantName?: string;
  unreadCount?: number;
}

// --- CONSTANTES ---
const PAWAPAY_WEBHOOK_URL = 'https://yass-webhook.israelntalu328.workers.dev';
const PAYMENT_AMOUNT = 5000;

// --- Composants Modals ---
// (Les composants ProductModal et OrderModal restent similaires,
// mais utilisent les styles unifiés définis plus bas)

interface ProductModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  sellerId: string;
  onProductSaved: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({
  visible,
  onClose,
  product,
  sellerId,
  onProductSaved,
}) => {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price || '');
  const [category, setCategory] = useState(product?.category || '');
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setPrice(product.price);
      setCategory(product.category);
      setImages(product.images || []);
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setCategory('');
      setImages([]);
    }
  }, [product]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePickerExpo.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie.');
      return;
    }

    const pickerResult = await ImagePickerExpo.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) return;

    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (manipulatedImage.base64) {
        setImages(prev => [...prev, manipulatedImage.base64!]);
      }
    } catch (error) {
      console.error('Erreur traitement image: ', error);
      Alert.alert('Erreur', 'Impossible de traiter l\'image');
    }
  };

  const handleSaveProduct = async () => {
    if (!name || !description || !price || !category || images.length === 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs et ajouter au moins une image.');
      return;
    }

    setLoading(true);
    try {
      if (product) {
        await updateDoc(doc(db, 'products', product.id), {
          name,
          description,
          price: parseFloat(price).toFixed(2),
          category,
          images,
        });
        Alert.alert('Succès', 'Produit mis à jour avec succès !');
      } else {
        await addDoc(collection(db, 'products'), {
          name,
          description,
          price: parseFloat(price).toFixed(2),
          category,
          images,
          sellerId,
          createdAt: serverTimestamp(),
          star: 0,
        });
        Alert.alert('Succès', 'Produit ajouté avec succès !');
      }
      onProductSaved();
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde produit: ', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le produit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{product ? 'Modifier Produit' : 'Ajouter Produit'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom du produit</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom" />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description détaillée"
              multiline
            />

            <Text style={styles.inputLabel}>Prix ($)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Catégorie</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Catégorie (ex: Électronique, Vêtements)"
            />

            <Text style={styles.inputLabel}>Images du produit ({images.length} ajoutées)</Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={24} color="#6C63FF" />
              <Text style={styles.imagePickerButtonText}>Ajouter une image</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreviewContainer}>
                {images.map((imgBase64, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <Image source={{ uri: `data:image/jpeg;base64,${imgBase64}` }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.deleteImageButton}
                      onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF6347" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSaveProduct}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{product ? 'Sauvegarder les modifications' : 'Ajouter Produit'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, newStatus: Order['status']) => void;
  isSeller: boolean;
}

const OrderModal: React.FC<OrderModalProps> = ({ visible, onClose, order, onStatusChange, isSeller }) => {
  if (!order) return null;

  const statusMap = {
    pending: { text: 'En attente', style: styles.statusPending },
    confirmed: { text: 'Confirmée', style: styles.statusConfirmed },
    delivered: { text: 'Livrée', style: styles.statusDelivered },
    cancelled: { text: 'Annulée', style: styles.statusCancelled },
  };

  const currentStatus = statusMap[order.status] || statusMap.pending;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Détails de la Commande</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.detailLabel}>ID Commande:</Text>
            <Text style={styles.detailValue}>#{order.id.slice(0, 10)}</Text>

            <Text style={styles.detailLabel}>Produit:</Text>
            <Text style={styles.detailValue}>{order.productName}</Text>

            <Text style={styles.detailLabel}>Quantité:</Text>
            <Text style={styles.detailValue}>{order.quantity}</Text>

            <Text style={styles.detailLabel}>Prix Total:</Text>
            <Text style={styles.detailValue}>{(order.totalPrice || 0).toFixed(2)} $</Text>

            <Text style={styles.detailLabel}>Acheteur:</Text>
            <Text style={styles.detailValue}>{order.buyerName}</Text>

            <Text style={styles.detailLabel}>Lieu de Livraison:</Text>
            <Text style={styles.detailValue}>{order.deliveryLocation}</Text>

            <Text style={styles.detailLabel}>Adresse de Livraison:</Text>
            <Text style={styles.detailValue}>{order.deliveryAddress}</Text>

            <Text style={styles.detailLabel}>Date de la commande:</Text>
            <Text style={styles.detailValue}>
              {order.createdAt?.toDate().toLocaleString()}
            </Text>

            <Text style={styles.detailLabel}>Statut:</Text>
            <Text style={[styles.detailValue, currentStatus.style]}>
              {currentStatus.text}
            </Text>

            {isSeller && (
              <View style={styles.orderActions}>
                {order.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.submitButton, styles.confirmButton]}
                    onPress={() => onStatusChange(order.id, 'confirmed')}
                  >
                    <Text style={styles.submitButtonText}>Confirmer la Commande</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'confirmed' && (
                  <TouchableOpacity
                    style={[styles.submitButton, styles.deliverButton]}
                    onPress={() => onStatusChange(order.id, 'delivered')}
                  >
                    <Text style={styles.submitButtonText}>Marquer comme Livrée</Text>
                  </TouchableOpacity>
                )}
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <TouchableOpacity
                    style={[styles.cancelButton, { marginTop: 10 }]}
                    onPress={() => onStatusChange(order.id, 'cancelled')}
                  >
                    <Text style={styles.cancelButtonText}>Annuler la Commande</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Fermer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};


interface SellerFormModalProps {
  visible: boolean;
  onClose: () => void;
  sellerForm: SellerForm;
  setSellerForm: React.Dispatch<React.SetStateAction<SellerForm>>;
  onSubmitForm: () => void;
  onInitiatePayment: (phoneNumber: string, provider: string) => void;
  loading: boolean;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  paymentLoading: boolean;
  paymentStatus: 'idle' | 'pending' | 'success' | 'failed';
  paymentPhoneNumber: string;
  setPaymentPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  selectedProvider: string | null;
  setSelectedProvider: React.Dispatch<React.SetStateAction<string | null>>;
}

const SellerFormModal: React.FC<SellerFormModalProps> = ({
  visible,
  onClose,
  sellerForm,
  setSellerForm,
  onSubmitForm,
  onInitiatePayment,
  loading,
  currentStep,
  setCurrentStep,
  paymentLoading,
  paymentStatus,
  paymentPhoneNumber,
  setPaymentPhoneNumber,
  selectedProvider,
  setSelectedProvider,
}) => {
  const isFormValid = useMemo(() => {
    return (
      sellerForm.shopName.trim() !== '' &&
      sellerForm.idNumber.trim() !== '' &&
      sellerForm.businessDescription.trim() !== '' &&
      sellerForm.phoneNumber.trim() !== '' &&
      sellerForm.location.trim() !== '' && sellerForm.address.trim() !== '' &&
      sellerForm.isAdult
    );
  }, [sellerForm]);

  const handlePaymentInitiation = () => {
    if (!paymentPhoneNumber || !selectedProvider) {
      Alert.alert("Erreur", "Veuillez entrer votre numéro de téléphone et sélectionner un fournisseur.");
      return;
    }
    onInitiatePayment(paymentPhoneNumber, selectedProvider);
  };

  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.formStepContainer}>
            <Text style={styles.formStepTitle}>Informations du Vendeur</Text>
            <Text style={styles.modalSubtitle}>
              Remplissez ces informations pour enregistrer votre profil vendeur.
            </Text>

            <Text style={styles.inputLabel}>Nom de la Boutique</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Mon Super Magasin"
              value={sellerForm.shopName}
              onChangeText={text => setSellerForm(prev => ({ ...prev, shopName: text }))}
            />

            <Text style={styles.inputLabel}>Type de pièce</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={sellerForm.idType}
                onValueChange={(itemValue) =>
                  setSellerForm(prev => ({ ...prev, idType: itemValue }))
                }>
                <Picker.Item label="Sélectionnez un type" value="" />
                <Picker.Item label="Carte d'identité" value="CNI" />
                <Picker.Item label="Passeport" value="Passeport" />
                <Picker.Item label="Permis de conduire" value="Permis" />
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Numéro de la pièce</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: ABC123456"
              value={sellerForm.idNumber}
              onChangeText={text => setSellerForm(prev => ({ ...prev, idNumber: text }))}
            />

            <Text style={styles.inputLabel}>Catégorie d'activité</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={sellerForm.businessDescription}
                onValueChange={(itemValue) =>
                  setSellerForm(prev => ({ ...prev, businessDescription: itemValue }))
                }>
                <Picker.Item label="Sélectionnez une catégorie" value="" />
                <Picker.Item label="Vêtements" value="Vêtements" />
                <Picker.Item label="Électronique" value="Électronique" />
                <Picker.Item label="Alimentation" value="Alimentation" />
                <Picker.Item label="Autre" value="Autre" />
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Numéro de Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+243 999 999 999"
              keyboardType="phone-pad"
              value={sellerForm.phoneNumber}
              onChangeText={text => setSellerForm(prev => ({ ...prev, phoneNumber: text }))}
            />

            <Text style={styles.inputLabel}>Ville / Province</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={sellerForm.location}
                onValueChange={(itemValue) =>
                  setSellerForm(prev => ({ ...prev, location: itemValue }))
                }>
                <Picker.Item label="Sélectionnez une ville" value="" />
                <Picker.Item label="Kinshasa, Gombe" value="Kinshasa, Gombe" />
                <Picker.Item label="Lubumbashi, Haut-Katanga" value="Lubumbashi, Haut-Katanga" />
                <Picker.Item label="Goma, Nord-Kivu" value="Goma, Nord-Kivu" />
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Adresse Complète</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Ex: Av. De la Paix, Q. Les Volcans, N°123"
              value={sellerForm.address}
              onChangeText={text => setSellerForm(prev => ({ ...prev, address: text }))}
              multiline
            />

            <View style={styles.switchContainer}>
              <Text style={styles.inputLabel}>J'ai plus de 18 ans</Text>
              <Switch
                trackColor={{ false: '#767577', true: '#6C63FF' }}
                thumbColor={sellerForm.isAdult ? '#6C63FF' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={value => setSellerForm(prev => ({ ...prev, isAdult: value }))}
                value={sellerForm.isAdult}
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={onSubmitForm} disabled={loading || !isFormValid}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Envoyer la demande</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View style={styles.paymentStepContainer}>
            <Ionicons name="wallet-outline" size={60} color="#6C63FF" style={styles.paymentIcon} />
            <Text style={styles.paymentTitle}>Paiement d'activation Vendeur</Text>
            <Text style={styles.paymentDescription}>
              Un dépôt mensuel de <Text style={styles.paymentAmount}>{PAYMENT_AMOUNT} CDF</Text> est requis pour activer votre compte vendeur.
              Ce montant couvre les frais de maintenance et de support.
            </Text>

            <Text style={styles.inputLabel}>Votre numéro de téléphone Pawapay</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 243812345678"
              keyboardType="phone-pad"
              value={paymentPhoneNumber}
              onChangeText={setPaymentPhoneNumber}
              maxLength={12}
            />

            <Text style={styles.inputLabel}>Sélectionnez votre fournisseur</Text>
            <View style={styles.providerButtonsContainer}>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'VODACOM_MPESA_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('VODACOM_MPESA_COD')}
              >
                {/* L'image doit être gérée localement, assurez-vous que les chemins sont corrects */}
                {/* <Image source={require('@/assets/images/vodacom.png')} style={styles.providerIcon} /> */}
                <Text style={[styles.providerButtonText, selectedProvider === 'VODACOM_MPESA_COD' && styles.selectedProviderButtonText]}>Vodacom</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'ORANGE_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('ORANGE_COD')}
              >
                {/* <Image source={require('@/assets/images/orange.png')} style={styles.providerIcon} /> */}
                <Text style={[styles.providerButtonText, selectedProvider === 'ORANGE_COD' && styles.selectedProviderButtonText]}>Orange</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerButton, selectedProvider === 'AIRTEL_COD' && styles.selectedProviderButton]}
                onPress={() => setSelectedProvider('AIRTEL_COD')}
              >
                {/* <Image source={require('@/assets/images/airtel.png')} style={styles.providerIcon} /> */}
                <Text style={[styles.providerButtonText, selectedProvider === 'AIRTEL_COD' && styles.selectedProviderButtonText]}>Airtel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handlePaymentInitiation}
              disabled={paymentLoading || !paymentPhoneNumber || !selectedProvider}
            >
              {paymentLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Payer {PAYMENT_AMOUNT} CDF</Text>
              )}
            </TouchableOpacity>

            {paymentStatus === 'pending' && (
              <View style={styles.paymentStatusMessage}>
                <ActivityIndicator size="small" color="#6C63FF" />
                <Text style={styles.paymentStatusText}>Traitement du paiement...</Text>
              </View>
            )}
            {paymentStatus === 'success' && (
              <View style={styles.paymentStatusMessage}>
                <Ionicons name="checkmark-circle" size={24} color="#28A745" />
                <Text style={styles.paymentSuccessText}>Paiement réussi ! Votre statut de vendeur est mis à jour.</Text>
              </View>
            )}
            {paymentStatus === 'failed' && (
              <View style={styles.paymentStatusMessage}>
                <Ionicons name="close-circle" size={24} color="#FF6347" />
                <Text style={styles.paymentFailedText}>Paiement échoué. Veuillez réessayer.</Text>
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Devenir Vendeur</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {renderFormStep()}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={paymentLoading}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// --- Composants de Tab ---

interface OrdersTabProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

interface StatsTabProps {
  stats: {
    productsCount: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
  };
}

interface ProductsTabProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

interface MessagesTabProps {
  sellerId: string | undefined;
}

const OrdersTab: React.FC<OrdersTabProps> = ({ orders, onSelectOrder }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Vos Commandes ({orders.length})</Text>

      {orders.length > 0 ? (
        <FlatList
          data={orders}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => onSelectOrder(item)}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                <Text style={[
                  styles.orderStatus,
                  item.status === 'pending' ? styles.statusPending :
                  item.status === 'confirmed' ? styles.statusConfirmed :
                  item.status === 'delivered' ? styles.statusDelivered :
                  styles.statusCancelled
                ]}>
                  {item.status === 'pending' ? 'En attente' :
                   item.status === 'confirmed' ? 'Confirmée' :
                   item.status === 'delivered' ? 'Livrée' : 'Annulée'}
                </Text>
              </View>
              <Text style={styles.orderProduct}>{item.productName}</Text>
              <Text style={styles.orderBuyer}>Client: {item.buyerName}</Text>
              <Text style={styles.orderTotal}>{(item.totalPrice || 0).toFixed(2)} $</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderDate}>
                  {item.createdAt?.toDate().toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune commande pour le moment</Text>
        </View>
      )}
    </View>
  );
};

const StatsTab: React.FC<StatsTabProps> = ({ stats }) => (
  <View style={styles.statsContainer}>
    {[
      { label: 'Produits', value: stats.productsCount, icon: 'cube-outline' },
      { label: 'Commandes en attente', value: stats.pendingOrders, icon: 'hourglass-outline' },
      { label: 'Commandes terminées', value: stats.completedOrders, icon: 'checkmark-done-outline' },
      { label: 'Revenu Total', value: `$${stats.totalRevenue.toFixed(2)}`, icon: 'cash-outline' }
    ].map((stat, index) => (
      <View key={index} style={styles.statCard}>
        <Ionicons name={stat.icon as any} size={30} color="#6C63FF" />
        <Text style={styles.statValue}>{stat.value}</Text>
        <Text style={styles.statLabel}>{stat.label}</Text>
      </View>
    ))}
  </View>
);

const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct
}) => {
  const ProductSellerItem: React.FC<{ item: Product }> = ({ item }) => (
    <View style={styles.productSellerCard}>
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: `data:image/jpeg;base64,${item.images[0]}` }} style={styles.productSellerImage} />
      ) : (
        <View style={styles.noProductSellerImage}>
          <Ionicons name="image-outline" size={40} color="#ccc" />
        </View>
      )}
      <View style={styles.productSellerDetails}>
        <Text style={styles.productSellerName}>{item.name}</Text>
        <Text style={styles.productSellerPrice}>{parseFloat(item.price).toFixed(2)} $</Text>
        <Text style={styles.productSellerCategory}>{item.category}</Text>
        <View style={styles.starRatingContainer}>
          {[...Array(5)].map((_, i) => (
            <Ionicons
              key={i}
              name={i < item.star ? "star" : "star-outline"}
              size={16}
              color="#FFD700"
            />
          ))}
        </View>
      </View>
      <View style={styles.productSellerActions}>
        <TouchableOpacity onPress={() => onEditProduct(item)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={24} color="#6C63FF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDeleteProduct(item.id)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={24} color="#FF6347" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Vos Produits ({products.length})</Text>
     
      </View>

      {products.length > 0 ? (
        <FlatList
          data={products}
          renderItem={({ item }) => <ProductSellerItem item={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View style={styles.emptyStateSection}>
          <Ionicons name="cube-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateSectionText}>
            Vous n'avez pas encore de produits en vente
          </Text>
          <TouchableOpacity
            style={styles.publishButton}
            onPress={onAddProduct}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.publishButtonText}>Publier votre premier produit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const MessagesTab: React.FC<MessagesTabProps> = ({ sellerId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    };

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', sellerId),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convosPromises = snapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        const otherParticipantId = data.participants.find((p: string) => p !== sellerId);
        let otherParticipantName = `Client #${otherParticipantId?.slice(0, 6)}`;

        if (otherParticipantId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
            if (userDoc.exists()) {
              otherParticipantName = (userDoc.data() as UserProfile).name || otherParticipantName;
            }
          } catch (error) {
            console.error("Error fetching other participant name:", error);
          }
        }

        const unreadCount = data.unreadCounts?.[sellerId] || 0;

        return {
          id: docSnapshot.id,
          participants: data.participants,
          lastMessage: data.lastMessage,
          unreadCounts: data.unreadCounts,
          otherParticipant: otherParticipantId,
          otherParticipantName,
          unreadCount,
        } as Conversation;
      });

      const convos = await Promise.all(convosPromises);
      setConversations(convos);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching conversations:", error);
      setLoading(false);
      Alert.alert("Erreur", "Impossible de charger vos conversations.");
    });

    return () => unsubscribe();
  }, [sellerId]);

  const handleOpenChat = (conversationId: string) => {
    router.push(`/chat`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Vos Conversations ({conversations.length})</Text>
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.conversationCard} onPress={() => handleOpenChat(item.id)} >
              <View style={styles.conversationAvatar}>
                <Ionicons name="person-circle-outline" size={40} color="#6C63FF" />
              </View>
              <View style={styles.conversationInfo}>
                <Text style={styles.conversationName}>{item.otherParticipantName}</Text>
                <Text style={styles.conversationLastMessage} numberOfLines={1} >
                  {item.lastMessage?.text || 'Aucun message'}
                </Text>
              </View>
              <View style={styles.conversationMeta}>
                <Text style={styles.conversationTime}>
                  {item.lastMessage?.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.unreadCount && item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.conversationsList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune conversation pour le moment.</Text>
        </View>
      )}
    </View>
  );
};
export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  // --- ETATS ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [showSellerFormModal, setShowSellerFormModal] = useState(false);
  const [sellerForm, setSellerForm] = useState<SellerForm>({ shopName: '', idNumber: '', isAdult: false, idType: '', businessDescription: '', phoneNumber: '', location: '', address: '', });
  const [sellerFormStep, setSellerFormStep] = useState(1);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [paymentPhoneNumber, setPaymentPhoneNumber] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'orders' | 'messages'>('stats');
  const [refreshing, setRefreshing] = useState(false);
  // Calcul des statistiques
  const stats = useMemo(() => {
    const pendingOrders = orders.filter((o: Order) => o.status === 'pending' || o.status === 'confirmed').length;
    const completedOrders = orders.filter((o: Order) => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter((o: Order) => o.status === 'delivered')
      .reduce((sum: number, o: Order) => sum + (o.totalPrice || 0), 0);
    return { pendingOrders, completedOrders, totalRevenue, productsCount: products.length };
  }, [orders, products]);
  // --- EFFETS ---
  // Effet pour charger le profil utilisateur
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setProfile(null);
      return;
    }
    const docRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setNewDisplayName(data.name ?? '');
        setSellerForm(prevForm => ({ shopName: data.sellerForm?.shopName ?? '', idNumber: data.sellerForm?.idNumber ?? '', idType: data.sellerForm?.idType ?? '', isAdult: data.sellerForm?.isAdult ?? false, businessDescription: data.sellerForm?.businessDescription ?? '', phoneNumber: data.sellerForm?.phoneNumber ?? '', location: data.sellerForm?.location ?? '', address: data.sellerForm?.address ?? '', }));
        if (data.isSellerRequested && !data.isSellerVerified) {
          setSellerFormStep(2);
          if (data.paymentId) {
            setPaymentStatus('pending');
          } else {
            setPaymentStatus('idle');
          }
        } else if (data.isSellerVerified) {
          setSellerFormStep(1);
          setPaymentStatus('success');
        } else {
          setSellerFormStep(1);
          setPaymentStatus('idle');
        }
      } else {
        const defaultName = user.name || user.email?.split('@')[0] || 'Nouvel Utilisateur';
        setDoc(docRef, {
          email: user.email,
          name: defaultName,
          uid: user.id,
          isSellerRequested: false,
          isSellerVerified: false,
          sellerForm: {},
          sellerRequestId: null,
          paymentId: null,
          createdAt: serverTimestamp(),
        }).then(() => {
          getDoc(docRef).then(newDocSnap => {
            if (newDocSnap.exists()) {
              setProfile(newDocSnap.data() as UserProfile);
              setNewDisplayName(newDocSnap.data().name ?? '');
              setSellerForm({ shopName: '', idNumber: '', isAdult: false, idType: '', businessDescription: '', phoneNumber: '', location: '', address: '' });
            }
          });
        }).catch((error) => console.error("Erreur création document utilisateur:", error));
      }
      setLoading(false);
    }, (error) => {
      console.error("Erreur chargement profil:", error);
      setLoading(false);
      Alert.alert("Erreur", "Impossible de charger votre profil.");
    });
    return () => unsubscribe();
  }, [user]);
  // Effet pour charger les produits et commandes (si vendeur)
  useEffect(() => {
    if (!profile?.isSellerVerified || !user?.id) {
      setLoadingData(false);
      setProducts([]);
      setOrders([]);
      return;
    }
    setLoadingData(true);
    const productsQuery = query(
      collection(db, 'products'),
      where('sellerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubProducts = onSnapshot(productsQuery, snap => {
      const fetchedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(fetchedProducts);
      setLoadingData(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      Alert.alert("Erreur", "Impossible de charger vos produits.");
      setLoadingData(false);
    });
    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubOrders = onSnapshot(ordersQuery, async (snap) => {
      const fetchedOrdersPromises = snap.docs.map(async d => {
        const orderData = d.data() as Omit<Order, 'id' | 'buyerName'> & { buyerId: string };
        let buyerName = `Utilisateur #${orderData.buyerId.slice(0, 6)}`;
        try {
          const buyerDoc = await getDoc(doc(db, 'users', orderData.buyerId));
          if (buyerDoc.exists()) {
            buyerName = (buyerDoc.data() as UserProfile).name || buyerName;
          }
        } catch (e) {
          console.error("Error fetching buyer name:", e);
        }
        return { id: d.id, ...orderData, buyerName } as Order;
      });
      const fetchedOrders = await Promise.all(fetchedOrdersPromises);
      setOrders(fetchedOrders);
      setLoadingData(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      Alert.alert("Erreur", "Impossible de charger vos commandes.");
      setLoadingData(false);
    });
    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [profile?.isSellerVerified, user?.id]);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Reload data by re-fetching everything.
    // The onSnapshot listeners will handle the update.
    // We just need to wait for a moment to simulate loading.
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);
  // --- HANDLERS ---
  const handleGoHome = () => {
    router.replace('/');
  };
  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };
  const handleSaveName = async () => {
    if (!user || !user.id || !newDisplayName.trim()) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { name: newDisplayName.trim() });
      setEditingName(false);
      Alert.alert("Succès", "Votre nom a été mis à jour.");
    } catch (error) {
      console.error("Erreur mise à jour nom: ", error);
      Alert.alert("Erreur", "Impossible de mettre à jour le nom.");
    } finally {
      setLoading(false);
    }
  };
  const handleSendSellerRequestForm = async () => {
    if (!user || !user.id) {
      Alert.alert("Erreur", "Utilisateur non connecté.");
      return;
    }
    if (!sellerForm.shopName || !sellerForm.idNumber || !sellerForm.businessDescription || !sellerForm.phoneNumber || !sellerForm.location || !sellerForm.address || !sellerForm.isAdult) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs et confirmer votre âge.");
      return;
    }
    setLoading(true);
    try {
      let requestId = profile?.sellerRequestId;
      if (requestId) {
        await updateDoc(doc(db, 'sellerRequests', requestId), {
          sellerFormData: sellerForm,
          status: 'pending',
          requestedAt: serverTimestamp(),
        });
      } else {
        const newRequestRef = await addDoc(collection(db, 'sellerRequests'), {
          userId: user.id,
          email: user.email,
          displayName: profile?.name || user.email,
          status: 'pending',
          requestedAt: serverTimestamp(),
          sellerFormData: sellerForm,
        });
        requestId = newRequestRef.id;
      }
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { isSellerRequested: true, sellerRequestId: requestId, extraData: { sellerForm: sellerForm }, paymentId: null, isSellerVerified: false, });
      Alert.alert(
        "Demande envoyée !",
        "Votre demande a été soumise. Veuillez maintenant procéder au paiement pour activer votre compte vendeur.",
        [{ text: "OK", onPress: () => setSellerFormStep(2) }]
      );
    } catch (error) {
      console.error("Erreur demande vendeur: ", error);
      Alert.alert("Erreur", "Impossible d'envoyer votre demande.");
    } finally {
      setLoading(false);
    }
  };
  const handlePawapayDeposit = async (phoneNumber: string, provider: string) => {
    if (!user?.id || !profile?.sellerRequestId) {
      Alert.alert("Erreur", "Informations utilisateur ou demande vendeur manquantes.");
      return;
    }
    setPaymentLoading(true);
    setPaymentStatus('pending');
    const maxRetries = 3;
    let retries = 0;
    let delay = 1000;
    while (retries < maxRetries) {
      try {
        const response = await fetch(`${PAWAPAY_WEBHOOK_URL}/initiate-deposit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            sellerRequestId: profile.sellerRequestId,
            phoneNumber: phoneNumber,
            provider: provider,
            amount: PAYMENT_AMOUNT,
            currency: 'CDF',
            description: `Activation compte vendeur pour ${user.email}`,
          }),
        });
        const result = await response.json();
        console.log("Pawapay Raw Response:", JSON.stringify(result, null, 2));
        if (result.status === 'ACCEPTED') {
          setPaymentStatus('pending');
          const checkStatus = async () => {
            const statusResponse = await fetch(`${PAWAPAY_WEBHOOK_URL}/check-deposit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                depositId: result.depositId,
              }),
            });
            const statusResult = await statusResponse.json();
            if (statusResult.status === 'SUCCESS') {
              setPaymentStatus('success');
              await updateDoc(doc(db, 'users', user.id), {
                isSellerVerified: true,
                paymentId: result.depositId,
                extraData: { paymentDetails: statusResult },
              });
              Alert.alert("Paiement réussi", "Votre compte vendeur est maintenant activé !");
              setPaymentLoading(false);
            } else if (statusResult.status === 'FAILED' || statusResult.status === 'REJECTED') {
              setPaymentStatus('failed');
              await updateDoc(doc(db, 'users', user.id), {
                paymentId: null,
                isSellerVerified: false,
              });
              Alert.alert("Paiement échoué", "Veuillez réessayer.");
              setPaymentLoading(false);
            } else {
              setTimeout(checkStatus, 5000);
            }
          };
          setTimeout(checkStatus, 5000);
          return;
        } else {
          throw new Error('Pawapay non ACCEPTED');
        }
      } catch (error) {
        console.error(`Attempt ${retries + 1} failed: `, error);
        retries++;
        if (retries < maxRetries) {
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
        }
      }
    }
    setPaymentStatus('failed');
    setPaymentLoading(false);
    Alert.alert("Erreur de paiement", "Impossible de démarrer le processus de paiement. Veuillez vérifier vos informations ou réessayer plus tard.");
  };
  const handleAddProduct = () => {
    setCurrentProduct(null);
    setShowProductModal(true);
  };
  const handleEditProduct = (product: Product) => {
    setCurrentProduct(product);
    setShowProductModal(true);
  };
  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      "Supprimer le produit",
      "Êtes-vous sûr de vouloir supprimer ce produit ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', productId));
              Alert.alert("Succès", "Produit supprimé avec succès.");
            } catch (error) {
              console.error("Erreur suppression produit: ", error);
              Alert.alert("Erreur", "Impossible de supprimer le produit.");
            }
          },
          style: "destructive",
        },
      ]
    );
  };
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      Alert.alert("Succès", `Statut de la commande mis à jour en "${newStatus}"`);
    } catch (error) {
      console.error("Erreur mise à jour statut de commande: ", error);
      Alert.alert("Erreur", "Impossible de mettre à jour le statut de la commande.");
    }
  };
  const renderTabContent = () => {
    if (loadingData) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      );
    }
    switch (activeTab) {
      case 'stats':
        return <StatsTab stats={stats} />;
      case 'products':
        return (
          <ProductsTab
            products={products}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        );
      case 'orders':
        return <OrdersTab orders={orders} onSelectOrder={(order) => { setSelectedOrder(order); setOrderModalVisible(true); }} />;
      case 'messages':
        return <MessagesTab sellerId={user?.id} />;
      default:
        return null;
    }
  };
  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }
  if (!isAuthenticated || !user || !profile) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Vous n'êtes pas connecté</Text>
        <TouchableOpacity style={styles.mainButton} onPress={handleGoHome}>
          <Text style={styles.mainButtonText}>Aller à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF6347" />
          </TouchableOpacity>
        </View>
        <View style={styles.profileSection}>
          {profile.photoBase64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${profile.photoBase64}` }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person-circle-outline" size={100} color="#ccc" />
            </View>
          )}
          <View style={styles.nameContainer}>
            {editingName ? (
              <TextInput
                style={styles.nameInput}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                autoFocus
              />
            ) : (
              <Text style={styles.nameText}>{profile.name}</Text>
            )}
            <TouchableOpacity onPress={() => setEditingName(!editingName)}>
              <Ionicons name={editingName ? "checkmark-circle" : "create-outline"} size={24} color="#6C63FF" />
            </TouchableOpacity>
          </View>
          {editingName && (
            <TouchableOpacity style={styles.saveNameButton} onPress={handleSaveName} disabled={loading}>
              <Text style={styles.saveNameButtonText}>Sauvegarder</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.emailText}>{profile.email}</Text>
        </View>
        <View style={styles.sellerStatusSection}>
          <Text style={styles.sellerStatusLabel}>Statut Vendeur:</Text>
          {profile.isSellerVerified ? (
            <View style={styles.sellerStatusVerified}>
              <Ionicons name="checkmark-circle" size={24} color="#28A745" />
              <Text style={styles.sellerStatusText}>Vérifié</Text>
            </View>
          ) : profile.isSellerRequested ? (
            <View style={styles.sellerStatusPending}>
              <Ionicons name="time-outline" size={24} color="#FFD700" />
              <Text style={styles.sellerStatusText}>En attente</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.becomeSellerButton} onPress={() => setShowSellerFormModal(true)}>
              <Ionicons name="storefront-outline" size={24} color="#fff" />
              <Text style={styles.becomeSellerButtonText}>Devenir Vendeur</Text>
            </TouchableOpacity>
          )}
        </View>
        {profile.isSellerVerified && (
          <View>
            <Text style={styles.sellerDashboardTitle}>Tableau de bord Vendeur</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'stats' && styles.activeTabButton]}
                onPress={() => setActiveTab('stats')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'stats' && styles.activeTabButtonText]}>Statistiques</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'products' && styles.activeTabButton]}
                onPress={() => setActiveTab('products')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'products' && styles.activeTabButtonText]}>Produits</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'orders' && styles.activeTabButton]}
                onPress={() => setActiveTab('orders')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.activeTabButtonText]}>Commandes</Text>
              </TouchableOpacity>
              
            </View>
            {renderTabContent()}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      <SellerFormModal
        visible={showSellerFormModal}
        onClose={() => setShowSellerFormModal(false)}
        sellerForm={sellerForm}
        setSellerForm={setSellerForm}
        onSubmitForm={handleSendSellerRequestForm}
        onInitiatePayment={handlePawapayDeposit}
        loading={loading}
        currentStep={sellerFormStep}
        setCurrentStep={setSellerFormStep}
        paymentLoading={paymentLoading}
        paymentStatus={paymentStatus}
        paymentPhoneNumber={paymentPhoneNumber}
        setPaymentPhoneNumber={setPaymentPhoneNumber}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
      />
      <OrderModal
        visible={orderModalVisible}
        onClose={() => setOrderModalVisible(false)}
        order={selectedOrder}
        onStatusChange={handleUpdateOrderStatus}
        isSeller={profile?.isSellerVerified ?? false}
      />
    </SafeAreaView>
  );
}
const windowWidth = Dimensions.get('window').width;
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 15,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerButton: {
    padding: 10,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6C63FF',
    marginBottom: 15,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  nameInput: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginRight: 10,
    paddingVertical: 2,
    minWidth: 150,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  saveNameButton: {
    marginTop: 5,
    backgroundColor: '#6C63FF',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  saveNameButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sellerStatusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sellerStatusLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  sellerStatusVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ea',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sellerStatusPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sellerStatusText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  becomeSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  becomeSellerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  sellerDashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeTabButton: {
    backgroundColor: '#6C63FF',
  },
  tabButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  activeTabButtonText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  // Style for StatsTab
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (windowWidth - 45) / 2, // 15*3 = 45 (padding)
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  // Style for ProductsTab
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addProductButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  productSellerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  productSellerImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 10,
  },
  noProductSellerImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  productSellerDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productSellerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productSellerPrice: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
  },
  productSellerCategory: {
    fontSize: 12,
    color: '#999',
  },
  starRatingContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  productSellerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 10,
  },
  emptyStateSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    marginTop: 20,
  },
  emptyStateSectionText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  publishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // Style for OrdersTab
  ordersList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  orderStatus: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusPending: { color: '#FFD700' },
  statusConfirmed: { color: '#6C63FF' },
  statusDelivered: { color: '#28A745' },
  statusCancelled: { color: '#FF6347' },
  orderProduct: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderBuyer: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 5,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  // Style for MessagesTab
  conversationsList: {
    paddingBottom: 20,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#666',
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#FF6347',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 5,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  mainButton: {
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    marginTop: 20,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6e6ff',
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 10,
  },
  imagePickerButtonText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    marginTop: 15,
    marginBottom: 10,
  },
  imagePreviewWrapper: {
    marginRight: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  deleteImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF6347',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 10,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  orderActions: {
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: '#28A745',
  },
  deliverButton: {
    backgroundColor: '#6C63FF',
  },
  formStepContainer: {
    // Styles pour l'étape du formulaire
  },
  formStepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  paymentStepContainer: {
    alignItems: 'center',
    padding: 20,
  },
  paymentIcon: {
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  paymentDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  paymentAmount: {
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  providerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  providerButton: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  selectedProviderButton: {
    borderColor: '#6C63FF',
  },
  providerIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  providerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedProviderButtonText: {
    color: '#6C63FF',
  },
  paymentStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  paymentStatusText: {
    marginLeft: 10,
    color: '#6C63FF',
    fontSize: 16,
  },
  paymentSuccessText: {
    marginLeft: 10,
    color: '#28A745',
    fontSize: 16,
  },
  paymentFailedText: {
    marginLeft: 10,
    color: '#FF6347',
    fontSize: 16,
  },
});