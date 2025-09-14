import { AppUser, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useProductsAndSellers } from '@/hooks/useProductsAndSellers';
import { CartItem, Product, SellerInfo } from '@/types';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Import Modals
import AddProductModal from '@/components/modals/AddProductModal';
import CartModal from '@/components/modals/CartModal';
import MyOrdersModal from '@/components/modals/MyOrdersModal';
import ProductDetailModal from '@/components/modals/ProductDetailModal';
import ReviewModal from '@/components/modals/ReviewModal';
import SellerDashboardModal from '@/components/modals/SellerDashboardModal';
import SellerProductsModal from '@/components/modals/SellerProductsModal';

// Import other components
import ProductCard from '@/components/products/ProductCard';
import { db } from '@/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';


interface HomeScreenHeaderProps {
  authUser: AppUser | null;
  theme: any; // Replace with your actual theme type
  toggleTheme: () => void;
  onCartPress: () => void;
  cartItemCount: number;
  search: string;
  handleSearchChange: (text: string) => void;
  cityFilter: string;
  setCityFilter: (value: string) => void;
  cities: string[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  categories: string[];
}

const SkeletonCard = () => (
  <View style={styles.productCardSkeleton}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonTextContainer}>
      <View style={styles.skeletonText} />
      <View style={[styles.skeletonText, { width: '60%' }]} />
    </View>
  </View>
);

const HomeScreenHeader: React.FC<HomeScreenHeaderProps> = ({
  authUser,
  theme,
  toggleTheme,
  onCartPress,
  cartItemCount,
  search,
  handleSearchChange,
  cityFilter,
  setCityFilter,
  cities,
  activeCategory,
  setActiveCategory,
  categories,
}) => (
  <>
    <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
      <View>
        <Text style={[styles.greeting, { color: theme.colors.text }]}>Bonjour, {authUser?.name || 'Visiteur'}!</Text>
        <Text style={[styles.subGreeting, { color: theme.colors.textSecondary }]}>Découvrez nos produits</Text>
      </View>
      <View style={styles.headerIcons}>
        <Switch value={theme.mode === 'dark'} onValueChange={toggleTheme} />
        <TouchableOpacity onPress={onCartPress} style={styles.cartIcon}>
          <Feather name="shopping-bag" size={24} color={theme.colors.text} />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.searchAndFilterContainer}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Rechercher un produit..."
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={handleSearchChange}
        />
      </View>

      <View style={[styles.pickerContainer, { backgroundColor: theme.colors.card }]}>
        <Picker
          selectedValue={cityFilter}
          onValueChange={(itemValue) => setCityFilter(itemValue)}
          style={[styles.picker, { color: theme.colors.text }]}
          dropdownIconColor={theme.colors.text}
        >
          {cities.map(city => <Picker.Item key={city} label={city} value={city} />)}
        </Picker>
      </View>
    </View>

    <View>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Catégories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryButton,
              { backgroundColor: activeCategory === cat ? theme.colors.primary : theme.colors.card }
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[
              styles.categoryText,
              { color: activeCategory === cat ? '#FFF' : theme.colors.text }
            ]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>

    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Produits Récents</Text>
  </>
);

export default function HomeScreen() {
  const router = useRouter();
  const { authUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // States
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [currentSellerProducts, setCurrentSellerProducts] = useState<Product[]>([]);
  const [currentSellerName, setCurrentSellerName] = useState('');
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);

  // Modal Visibility States
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [sellerDashboardModalVisible, setSellerDashboardModalVisible] = useState(false);
  const [myOrdersModalVisible, setMyOrdersModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [sellerProductsModalVisible, setSellerProductsModalVisible] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [cityFilter, setCityFilter] = useState('Toutes les villes');
  const categories = ['Tous', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];
  const cities = ['Toutes les villes', 'Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Bukavu', 'Matadi', 'Kolwezi'];

  useEffect(() => {
    if (authUser?.city) {
      setCityFilter(authUser.city);
    }
  }, [authUser]);

  const {
    products,
    initialLoading,
    loadingMore,
    refreshing,
    hasMore,
    onRefresh,
    handleLoadMore,
  } = useProductsAndSellers({
    search,
    activeCategory,
    city: cityFilter,
    minPrice: '', // Add these if you re-introduce them
    maxPrice: '',
    minRating: 0,
    sortBy: 'createdAt_desc',
  });

  // Load cart and favorites from storage
  useEffect(() => {
    const loadData = async () => {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      if (authUser?.uid) {
        const favoritesRef = collection(db, 'userFavorites');
        const q = query(favoritesRef, where('userId', '==', authUser.uid));
        const querySnapshot = await getDocs(q);
        const favs = querySnapshot.docs.map(d => d.data().productId);
        setFavorites(favs);
      }
    };
    loadData();
  }, [authUser]);

  // Save cart to storage
  useEffect(() => {
    AsyncStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);
  
  // Load cart and favorites from storage
  useEffect(() => {
    const loadData = async () => {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      if (authUser?.uid) {
        loadFavorites();
      }
    };
    loadData();
  }, [authUser]);

  const loadFavorites = useCallback(async () => {
    if (!authUser?.uid) {
      setFavorites([]);
      return;
    }
    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', authUser.uid));
      const querySnapshot = await getDocs(q);
      const fetchedFavorites: string[] = [];
      querySnapshot.forEach(docSnap => {
        fetchedFavorites.push(docSnap.data().productId);
      });
      setFavorites(fetchedFavorites);
    } catch (error) {
      console.error("Erreur lors du chargement des favoris:", error);
    }
  }, [authUser]);


  // Add this function in your HomeScreen component
const openSellerProductsModal = () => {
  // Implementation for opening seller products modal
  setSellerProductsModalVisible(true);
};

  const toggleFavorite = async (productId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authUser?.uid) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour gérer vos favoris.");
      router.push('/login');
      return;
    }

    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', authUser.uid), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(favoritesRef, {
          userId: authUser.uid,
          productId: productId,
          createdAt: serverTimestamp(),
        });
        setFavorites(prev => [...prev, productId]);
      } else {
        querySnapshot.forEach(async (docSnap) => {
          await deleteDoc(doc(db, 'userFavorites', docSnap.id));
        });
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des favoris:", error);
      Alert.alert("Erreur", "Impossible de gérer les favoris pour le moment.");
    }
  };

  // Check seller status
  useEffect(() => {
    if (!authUser?.uid) {
      setIsVerifiedSeller(false);
      return;
    }
    const userRef = doc(db, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      setIsVerifiedSeller(docSnap.exists() ? docSnap.data().isSellerVerified || false : false);
    });
    return () => unsubscribe();
  }, [authUser]);

  // Fetch data for modals when they become visible
  const fetchMyOrders = useCallback(async () => {
    if (!authUser?.uid) return;
    setLoadingOrders(true);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('buyerId', '==', authUser.uid), orderBy('orderDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedOrders = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        orderDate: docSnap.data().orderDate?.toDate() || new Date()
      }));
      setMyOrders(fetchedOrders);
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
    } finally {
      setLoadingOrders(false);
    }
  }, [authUser]);

  const fetchSellerProducts = useCallback(async () => {
    if (!authUser?.uid) return;
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('sellerId', '==', authUser.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedProducts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
      setSellerProducts(fetchedProducts);
    } catch (error) {
      console.error("Erreur chargement produits vendeur:", error);
    }
  }, [authUser]);

  useEffect(() => {
    if (myOrdersModalVisible) {
      fetchMyOrders();
    }
  }, [myOrdersModalVisible, fetchMyOrders]);

  useEffect(() => {
    if (sellerDashboardModalVisible) {
      fetchSellerProducts();
    }
  }, [sellerDashboardModalVisible, fetchSellerProducts]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
  };
  
  const addToCart = (product: Product | null) => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };
  
  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
    }
  };

  const placeOrder = async (sellerId: string, items: CartItem[], totalAmount: number) => {
    if (!authUser?.uid) return;
    setLoadingOrder(sellerId);
    try {
      await addDoc(collection(db, 'orders'), {
        buyerId: authUser.uid,
        buyerName: authUser.name || 'Acheteur Anonyme',
        buyerCity: authUser.city || 'Ville non spécifiée',
        sellerId: sellerId,
        items: items.map(item => ({
          productId: item.id, name: item.name, price: item.price, quantity: item.quantity, imageUrl: item.images[0] || '',
        })),
        totalAmount: totalAmount,
        orderDate: serverTimestamp(),
        status: 'pending',
      });
      setCart(prev => prev.filter(item => !items.some(ordered => ordered.id === item.id)));
      setCartModalVisible(false);
      Alert.alert('Succès', 'Votre commande a été passée !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de passer la commande.');
    } finally {
      setLoadingOrder(null);
    }
  };
  
  const submitReview = async (rating: number, comment: string) => {
    if (!authUser?.uid || !selectedProduct?.id) return;
    try {
      await addDoc(collection(db, 'productReviews'), {
        productId: selectedProduct.id,
        userId: authUser.uid,
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      Alert.alert("Succès", "Votre avis a été soumis !");
      setReviewModalVisible(false);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de soumettre votre avis.");
    }
  };
  
  const openDetailModal = async (product: Product) => {
    if (isOpeningModal) return;
    setIsOpeningModal(true);
    try {
      const sellerRef = doc(db, 'users', product.sellerId);
      const sellerSnap = await getDoc(sellerRef);
      const fetchedSellerInfo: SellerInfo | null = sellerSnap.exists() ? (sellerSnap.data() as SellerInfo) : null;
      setSelectedProduct(product);
      setSellerInfo(fetchedSellerInfo);
      setDetailModalVisible(true);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les informations du vendeur.");
    } finally {
      setIsOpeningModal(false);
    }
  };

  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <ProductCard
      product={item}
      index={index}
      onPress={() => openDetailModal(item)}
      onAddToCart={() => addToCart(item)}
      isFavorite={favorites.includes(item.id)}
      onToggleFavorite={() => toggleFavorite(item.id)}
    />
  );
  
  const renderListEmpty = () => {
    if (initialLoading) {
      return (
        <View style={styles.gridContainer}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          Aucun produit trouvé pour ces critères.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isOpeningModal && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}

      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        ListHeaderComponent={
          <HomeScreenHeader
            authUser={authUser}
            theme={theme}
            toggleTheme={toggleTheme}
            onCartPress={() => setCartModalVisible(true)}
            cartItemCount={cart.length}
            search={search}
            handleSearchChange={handleSearchChange}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            cities={cities}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            categories={categories}
          />
        }
        ListEmptyComponent={renderListEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={theme.colors.primary} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      />

      {/* Modals */}
      <AddProductModal visible={addProductModalVisible} onClose={() => setAddProductModalVisible(false)} onProductAdded={onRefresh} />
      <ProductDetailModal
        visible={detailModalVisible}
        product={selectedProduct}
        sellerInfo={sellerInfo}
        isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
        onClose={() => setDetailModalVisible(false)}
        onAddToCart={() => addToCart(selectedProduct)}
        onToggleFavorite={() => toggleFavorite(selectedProduct?.id || '')}
        onOpenSellerProducts={openSellerProductsModal}
        onOpenReview={() => setReviewModalVisible(true)}
      />
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onPlaceOrder={placeOrder}
        loadingOrder={loadingOrder}
      />
      <ReviewModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        productName={selectedProduct?.name || ''}
        onSubmit={submitReview}
      />
      <MyOrdersModal
        visible={myOrdersModalVisible}
        onClose={() => setMyOrdersModalVisible(false)}
        orders={myOrders}
        loading={loadingOrders}
        orderStatusMap={{ // This should probably be a constant
          pending: { label: 'En attente', color: '#FFA500', icon: 'clock' },
          shipped: { label: 'Expédiée', color: '#3498db', icon: 'truck' },
          delivered: { label: 'Livrée', color: '#2ecc71', icon: 'check-circle' },
          cancelled: { label: 'Annulée', color: '#e74c3c', icon: 'x-circle' },
        }}
      />
      <SellerDashboardModal
        visible={sellerDashboardModalVisible}
        onClose={() => setSellerDashboardModalVisible(false)}
        products={sellerProducts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  gridContainer: { paddingHorizontal: 8 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subGreeting: { fontSize: 16 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartIcon: { position: 'relative' },
  cartBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  // Search and Filters
  searchAndFilterContainer: { paddingHorizontal: 16, marginVertical: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 50 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontSize: 16 },
  pickerContainer: { borderRadius: 12, marginTop: 12, height: 50, justifyContent: 'center' },
  picker: { height: 50, width: '100%' },
  // Categories
  sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12 },
  categoryContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginRight: 12 },
  categoryText: { fontSize: 14, fontWeight: '500' },
  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 400 },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
  // Skeleton
  productCardSkeleton: { flex: 1/2, margin: 8, borderRadius: 12, overflow: 'hidden' },
  skeletonImage: { width: '100%', height: 160, backgroundColor: '#E5E7EB' },
  skeletonTextContainer: { padding: 12 },
  skeletonText: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8 },
});
