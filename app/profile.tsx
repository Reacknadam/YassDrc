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
} from 'react-native';
import { createProduct, updateProduct } from '@/services/productService';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
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
  isAdult: boolean;
  businessDescription: string;
  phoneNumber: string;
  location: string;
  address: string;
}

interface Order {
  id: string;
  buyerName: string;
  productName: string;
  totalPrice: number;
  deliveryLocation: string;
  deliveryAddress: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  images: string[] | null;
  sellerId: string;
  createdAt: any;
  star: number;
}

interface UserAuthContextType {
  id: string;
  uid?: string;
  name: string;
  email: string;
  password?: string;
}

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
  sellerId?: string;
}

interface PaymentInfo {
  transactionId: string;
  paymentProofBase64?: string;
  status: 'pending' | 'verified' | 'failed';
  amount: number;
}

const OrdersTab: React.FC<OrdersTabProps> = ({ orders, onSelectOrder }) => {
  return (
    <View style={styles.ordersContainer}>
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
      { label: 'Commandes', value: stats.pendingOrders, icon: 'hourglass-outline' },
      { label: 'Ventes', value: stats.completedOrders, icon: 'checkmark-done-outline' },
      { label: 'Revenu', value: `$${stats.totalRevenue.toFixed(2)}`, icon: 'cash-outline' }
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
    <View style={styles.productsContainer}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Vos Produits ({products.length})</Text>
        <TouchableOpacity 
          style={styles.addProductButton} 
          onPress={onAddProduct}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addProductButtonText}>Nouveau</Text>
        </TouchableOpacity>
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
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!sellerId) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', sellerId),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        otherParticipant: doc.data().participants.find((p: string) => p !== sellerId)
      }));
      setConversations(convos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sellerId]);

  const handleOpenChat = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.messagesContainer}>
      <Text style={styles.sectionTitle}>Vos Conversations</Text>
      
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conversationCard}
              onPress={() => handleOpenChat(item.id)}
            >
              <View style={styles.conversationAvatar}>
                <Ionicons name="person-circle-outline" size={40} color="#6C63FF" />
              </View>
              
              <View style={styles.conversationInfo}>
                <Text style={styles.conversationName}>Client #{item.otherParticipant?.slice(0, 6)}</Text>
                <Text 
                  style={styles.conversationLastMessage}
                  numberOfLines={1}
                >
                  {item.lastMessage?.text || 'Aucun message'}
                </Text>
              </View>
              
              <View style={styles.conversationMeta}>
                <Text style={styles.conversationTime}>
                  {item.lastMessage?.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.unreadCount > 0 && (
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
          <Text style={styles.emptyStateText}>Aucune conversation</Text>
        </View>
      )}
    </View>
  );
};

export default function ProfileScreen() {
  const [showPaymentFormModal, setShowPaymentFormModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
const handleAddProduct = () => { /* ... */ };
  const handleEditProduct = (product: Product) => { /* ... */ };
  
  // --- ETATS ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // États pour le formulaire "Devenir Vendeur"
  const [showSellerFormModal, setShowSellerFormModal] = useState(false);
  const [sellerForm, setSellerForm] = useState<SellerForm>({
    shopName: '',
    idNumber: '',
    isAdult: false,
    businessDescription: '',
    phoneNumber: '',
    location: '',
    address: '',
  });

  // États pour le paiement
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    transactionId: '',
    status: 'pending',
    amount: 15000,
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // États pour la gestion des produits et des commandes
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);

  // Calcul des statistiques
  const stats = useMemo(() => {
    const pendingOrders = orders.filter((o: Order) => o.status === 'pending' || o.status === 'confirmed').length;
    const completedOrders = orders.filter((o: Order) => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter((o: Order) => o.status === 'delivered')
      .reduce((sum: number, o: Order) => sum + (o.totalPrice || 0), 0);
    return { 
      pendingOrders, 
      completedOrders, 
      totalRevenue, 
      productsCount: products.length 
    };
  }, [orders, products]);

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
        setSellerForm(prevForm => ({
          shopName: data.sellerForm?.shopName ?? '',
          idNumber: data.sellerForm?.idNumber ?? '',
          isAdult: data.sellerForm?.isAdult ?? false,
          businessDescription: data.sellerForm?.businessDescription ?? '',
          phoneNumber: data.sellerForm?.phoneNumber ?? '',
          location: data.sellerForm?.location ?? '',
          address: data.sellerForm?.address ?? '',
        }));
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
          createdAt: serverTimestamp(),
        }).then(() => {
          getDoc(docRef).then(newDocSnap => {
            if (newDocSnap.exists()) {
              setProfile(newDocSnap.data() as UserProfile);
              setNewDisplayName(newDocSnap.data().name ?? '');
              setSellerForm({
                shopName: '', idNumber: '', isAdult: false, businessDescription: '',
                phoneNumber: '', location: '', address: ''
              });
            }
          });
        }).catch((error) => console.error("Erreur création document:", error));
      }
      setLoading(false);
    }, (error) => {
      console.error("Erreur chargement profil:", error);
      setLoading(false);
      Alert.alert("Erreur", "Impossible de charger votre profil.");
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!profile?.isSellerVerified || !user?.id) {
      setLoadingData(false);
      setProducts([]);
      setOrders([]);
      return;
    }

    setLoadingData(true);

    // Abonnement aux produits
    const productsQuery = query(
      collection(db, 'products'),
      where('sellerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubProducts = onSnapshot(productsQuery, snap => {
      const fetchedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(fetchedProducts);
      setLoadingData(false);
    });

    // Abonnement aux commandes
    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubOrders = onSnapshot(ordersQuery, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
      setLoadingData(false);
    });

    return () => { unsubProducts(); unsubOrders(); };
  }, [profile?.isSellerVerified, user?.id]);

  const handleGoHome = () => {
    router.replace('/');
  };


  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      "Supprimer le produit",
      "Êtes-vous sûr de vouloir supprimer cette annonce ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'products', productId));
              setProducts(prev => prev.filter(p => p.id !== productId));
              Alert.alert("Succès", "L'annonce a été supprimée.");
            } catch (error) {
              console.error("Erreur suppression produit:", error);
              Alert.alert("Erreur", "Impossible de supprimer l'annonce.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Ajoutez cette fonction dans le composant ProfileScreen
const renderInitials = (name?: string) => {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : user?.email ? user.email[0].toUpperCase() : '';
  return (
    <View style={styles.initialsCircle}>
      <Text style={styles.initialsText}>{initials}</Text>
    </View>
  );
};
// Ajoutez cette fonction dans le composant ProfileScreen
const handleLogout = async () => {
  await logout();
  router.replace('/login');
};




const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'orders' | 'messages'>('stats');

  return (
    <View style={styles.dashboard}>
      {/* Onglets */}
      <View style={styles.tabsContainer}>
        {['stats', 'products', 'orders', 'messages'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Ionicons 
              name={
                tab === 'stats' ? 'stats-chart-outline' : 
                tab === 'products' ? 'cube-outline' : 
                tab === 'orders' ? 'receipt-outline' : 
                'chatbubbles-outline'
              } 
              size={20} 
              color={activeTab === tab ? '#6C63FF' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'stats' ? 'Stats' : 
               tab === 'products' ? 'Produits' : 
               tab === 'orders' ? 'Commandes' : 
               'Messages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu des onglets */}
      <View style={styles.tabContent}>
        {activeTab === 'stats' && <StatsTab stats={stats} />}
        {activeTab === 'products' && (
          <ProductsTab 
            products={products} 
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab 
            orders={orders} 
            onSelectOrder={(order) => {
              setSelectedOrder(order);
              setOrderModalVisible(true);
            }} 
          />
        )}
        {activeTab === 'messages' && <MessagesTab sellerId={user?.id} />}
      </View>
    </View>
  );
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

  const handleSendSellerRequest = async () => {
  if (!user || !user.id) {
    Alert.alert("Erreur", "Utilisateur non connecté.");
    return;
  }

  // ... validation du formulaire ...

  setLoading(true);
  try {
    const newRequestRef = await addDoc(collection(db, 'sellerRequests'), {
      userId: user.id,
      email: user.email,
      displayName: profile?.name || user.email,
      status: 'pending',
      requestedAt: serverTimestamp(),
      sellerFormData: sellerForm,
    });

    const userRef = doc(db, 'users', user.id);
    await updateDoc(userRef, {
      isSellerRequested: true,
      sellerRequestId: newRequestRef.id,
      sellerForm: sellerForm,
    });

    setShowSellerFormModal(false);
    
    // REDIRECTION VERS L'ÉCRAN DE PAIEMENT
    router.push({
      pathname: '/pay',
      params: { 
        requestId: newRequestRef.id,
        amount: "15000",
        currency: 'Ar'
      }
    });
    
  } catch (error) {
    console.error("Erreur demande vendeur: ", error);
    Alert.alert("Erreur", "Impossible d'envoyer votre demande.");
  } finally {
    setLoading(false);
  }
};



  const handleCancelRequest = async () => {
    if (!user || !user.id || !profile?.sellerRequestId) {
      Alert.alert("Erreur", "Aucune demande en attente.");
      return;
    }

    const requestId = profile.sellerRequestId;

    Alert.alert(
      "Annuler la demande",
      "Êtes-vous sûr de vouloir annuler votre demande?",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui",
          onPress: async () => {
            setLoading(true);
            try {
              if (!requestId) {
                throw new Error("ID de demande non disponible");
              }
              
              await deleteDoc(doc(db, 'sellerRequests', requestId));
              
              const userRef = doc(db, 'users', user.id);
              await updateDoc(userRef, {
                isSellerRequested: false,
                isSellerVerified: false,
                sellerForm: deleteField(),
                sellerRequestId: deleteField()
              });
              Alert.alert("Annulée", "Votre demande a été annulée.");
            } catch (error) {
              console.error("Erreur annulation: ", error);
              Alert.alert("Erreur", "Impossible d'annuler la demande.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };


  
  const handlePickImage = async () => {
    const permissionResult = await ImagePickerExpo.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès à la galerie.");
      return;
    }
    const pickerResult = await ImagePickerExpo.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) return;

    try {
      setLoading(true);
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (user && user.id && manipulatedImage.base64) {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { photoBase64: manipulatedImage.base64 });
        Alert.alert("Succès", "Photo de profil mise à jour.");
      } else {
        Alert.alert("Erreur", "Utilisateur non connecté ou image invalide.");
      }
    } catch (error) {
      console.error("Erreur mise à jour photo: ", error);
      Alert.alert("Erreur", "Impossible de mettre à jour la photo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentInfo.transactionId) {
      Alert.alert("Erreur", "Veuillez entrer l'ID de transaction");
      return;
    }

    setPaymentLoading(true);

    try {
      // Enregistrer le paiement
      const paymentRef = await addDoc(collection(db, 'sellerPayments'), {
        userId: user?.id,
        ...paymentInfo,
        createdAt: serverTimestamp(),
      });

      // Mettre à jour le profil utilisateur
      const userRef = doc(db, 'users', user?.id || '');
      await updateDoc(userRef, {
        paymentId: paymentRef.id,
      });

      // Simuler la vérification (dans une vraie app, utiliser un backend)
      setTimeout(() => {
        setPaymentSuccess(true);
        setPaymentLoading(false);
        updateDoc(userRef, {
          isSellerVerified: true,
          sellerVerifiedAt: serverTimestamp(),
        });
        Alert.alert("Succès", "Paiement vérifié! Vous êtes maintenant un vendeur vérifié.");
      }, 3000);

    } catch (error) {
      console.error("Erreur enregistrement paiement: ", error);
      Alert.alert("Erreur", "Impossible d'enregistrer le paiement");
      setPaymentLoading(false);
    }
  };

  const handlePickPaymentProof = async () => {
    const permissionResult = await ImagePickerExpo.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès à la galerie.");
      return;
    }
    
    const pickerResult = await ImagePickerExpo.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    
    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) return;

    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (manipulatedImage.base64) {
        setPaymentInfo(prev => ({
          ...prev,
          paymentProofBase64: manipulatedImage.base64
        }));
      }
    } catch (error) {
      console.error("Erreur traitement image: ", error);
      Alert.alert("Erreur", "Impossible de traiter l'image");
    }
  };

  // ... autres fonctions (handleAddProduct, handleEditProduct, etc.) ...

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.section}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={handleGoHome} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#6C63FF" />
          <Text style={styles.backButtonText}>Accueil</Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
          {profile?.photoBase64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${profile.photoBase64}` }} style={styles.avatar} />
          ) : (
            renderInitials(profile?.name)
          )}
          <View style={styles.editIcon}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.nameContainer}>
          {editingName ? (
            <TextInput
              style={styles.nameInput}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              onBlur={handleSaveName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
          ) : (
            <Text style={styles.name} numberOfLines={1}>{profile?.name || user?.email || 'Invité'}</Text>
          )}
          <TouchableOpacity onPress={() => setEditingName(!editingName)} style={styles.editNameIcon}>
            <Ionicons name={editingName ? "checkmark" : "pencil"} size={20} color="#6C63FF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.emailText}>{user?.email}</Text>
      </View>
{profile?.isSellerVerified ? (
  <Dashboard />
) : (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Statut Vendeur</Text>
    {profile?.isSellerRequested ? (
      <View style={styles.statusBoxPending}>
        <Ionicons name="hourglass-outline" size={30} color="#FFA500" />
        <Text style={styles.statusTextPending}>
          Votre demande est en attente de paiement.
        </Text>
       <TouchableOpacity 
  style={styles.becomeSellerButton} 
  onPress={() => setShowPaymentFormModal(true)}
>
  <Text style={styles.becomeSellerButtonText}>Procéder au paiement</Text>
</TouchableOpacity>
      </View>
    ) : (
      <View style={styles.statusBoxNotSeller}>
        <Ionicons name="storefront-outline" size={30} color="#6C63FF" />
        <Text style={styles.statusTextNotSeller}>Vous n'êtes pas encore un vendeur.</Text>
        <TouchableOpacity 
          style={styles.becomeSellerButton} 
          onPress={() => setShowSellerFormModal(true)}
        >
          <Text style={styles.becomeSellerButtonText}>Devenir vendeur</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
)}

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <FlatList
        data={[{}]}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => setRefreshing(true)} 
          />
        }
      />

      <Modal
        visible={showPaymentFormModal}
        animationType="slide"
        onRequestClose={() => setShowPaymentFormModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Informations pesonnelles </Text>
            <TouchableOpacity 
              onPress={() => setShowPaymentFormModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Veuillez remplir vos informations personnelles pour procéder au paiement de la confirmer.
            </Text>

            <Text style={styles.inputLabel}>Nom Complet</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom complet"
            />

            <Text style={styles.inputLabel}>Numéro de carte</Text>
            <TextInput
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              keyboardType="number-pad"
            />

            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.inputLabel}>Date d'expiration</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/AA"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Adresse de facturation</Text>
            <TextInput
              style={styles.input}
              placeholder="Adresse complète"
            />

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => {
                setShowPaymentFormModal(false);
                router.push({
                  pathname: '/pay',
                  params: { 
                    requestId: profile?.sellerRequestId,
                    amount: "15000",
                    currency: 'Ar'
                  }
                });
              }}
            >
              <Text style={styles.submitButtonText}>Payer maintenant</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowPaymentFormModal(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
// ... le reste du code (composants Dashboard, ProductModal, etc.) ...


const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F7F7FA',
    paddingBottom: 30,
  },
  section: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  backButtonContainer: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#E8E8F3',
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#6C63FF',
    backgroundColor: '#E8E8F3',
  },
  initialsCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E8E8F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  initialsText: {
    fontSize: 36,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    maxWidth: 180,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    borderBottomWidth: 1,
    borderColor: '#6C63FF',
    minWidth: 120,
    maxWidth: 180,
    paddingVertical: 2,
    marginRight: 8,
  },
  editNameIcon: {
    marginLeft: 8,
    padding: 4,
  },
  emailText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 10,
  },
  statusBoxPending: {
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTextPending: {
    color: '#FFA500',
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 8,
    textAlign: 'center',
  },
  statusBoxNotSeller: {
    backgroundColor: '#F0F0FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTextNotSeller: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 8,
    textAlign: 'center',
  },
  becomeSellerButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 10,
  },
  becomeSellerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6347',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 18,
    alignSelf: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dashboard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0FF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6C63FF',
    backgroundColor: '#fff',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 15,
    color: '#666',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#6C63FF',
  },
  tabContent: {
    padding: 14,
    minHeight: 220,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F7F7FA',
    borderRadius: 10,
    marginHorizontal: 4,
    paddingVertical: 16,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  productsContainer: {
    marginTop: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addProductButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 15,
  },
  productSellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7FA',
    borderRadius: 10,
    marginBottom: 12,
    padding: 10,
    elevation: 1,
  },
  productSellerImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E8E8F3',
  },
  noProductSellerImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E8E8F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productSellerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  productSellerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  productSellerPrice: {
    fontSize: 15,
    color: '#6C63FF',
    fontWeight: 'bold',
    marginTop: 2,
  },
  productSellerCategory: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  starRatingContainer: {
    flexDirection: 'row',
    marginTop: 2,
  },
  productSellerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    marginHorizontal: 4,
    padding: 4,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  publishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 15,
  },
  emptyStateSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
  },
  emptyStateSectionText: {
    color: '#888',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  ordersContainer: {
    marginTop: 6,
  },
  ordersList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#F7F7FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  orderId: {
    fontWeight: 'bold',
    color: '#6C63FF',
    fontSize: 15,
  },
  orderStatus: {
    fontWeight: 'bold',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: '#FFF7E6',
    color: '#FFA500',
  },
  statusConfirmed: {
    backgroundColor: '#E6F7FF',
    color: '#007AFF',
  },
  statusDelivered: {
    backgroundColor: '#E6FFE6',
    color: '#28A745',
  },
  statusCancelled: {
    backgroundColor: '#FFE6E6',
    color: '#FF6347',
  },
  orderProduct: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
    marginTop: 2,
  },
  orderBuyer: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 15,
    color: '#6C63FF',
    fontWeight: 'bold',
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  messagesContainer: {
    marginTop: 6,
  },
  conversationsList: {
    paddingBottom: 20,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7FA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    elevation: 1,
  },
  conversationAvatar: {
    marginRight: 10,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontWeight: 'bold',
    color: '#222',
    fontSize: 15,
  },
  conversationLastMessage: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
    maxWidth: 150,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  conversationTime: {
    color: '#888',
    fontSize: 12,
  },
  unreadBadge: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 32 : 48,
    paddingHorizontal: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    marginTop: 10,
  },
  modalSubtitle: {
    color: '#666',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    color: '#6C63FF',
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 2,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#F7F7FA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8E8F3',
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#E8E8F3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});