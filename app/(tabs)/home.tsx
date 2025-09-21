import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
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
import { Feather } from '@expo/vector-icons';

import { db } from '../../firebase/config';
import { AppUser, useAuth } from '../../context/AuthContext';
import { useProductsAndSellers } from '../../hooks/useProductsAndSellers';
import { CartItem, Product, SellerInfo } from '../../types';

// Modals
import AddProductModal from '../../components/modals/AddProductModal';
import CartModal from '../../components/modals/CartModal';
import MyOrdersModal from '../../components/modals/MyOrdersModal';
import ProductDetailModal from '../../components/modals/ProductDetailModal';
import ReviewModal from '../../components/modals/ReviewModal';
import SellerDashboardModal from '../../components/modals/SellerDashboardModal';
import SellerProductsModal from '../../components/modals/SellerProductsModal';
import ProductCard from '../../components/products/ProductCard';
import CityFilterModal from '../../components/modals/CityFilterModal';

// ── CONSTANTES COULEURS (à la place du thème) ────────────────────────────────
const COLORS = {
  background: '#f5f5f5',
  card: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  primary: '#6C63FF',
  notification: '#ff4141',
};

// ── DESIGN SYSTEM RAPIDE ─────────────────────────────────────────────────────
const S = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 24 },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
};

// ── SKELETON ────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <View style={[styles.productCardSkeleton, S.shadows.soft]}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonTextContainer}>
      <View style={[styles.skeletonText, { width: '85%' }]} />
      <View style={[styles.skeletonText, { width: '50%' }]} />
    </View>
  </View>
);

// ── HEADER SIMPLIFIÉ ────────────────────────────────────────────────────────
const HomeScreenHeader: React.FC<any> = ({
  authUser,
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
  onCityFilterPress,
}) => (
  <>
    <View style={[styles.header, { backgroundColor: COLORS.background }]}>
      <View>
        <Text style={[styles.greeting, { color: COLORS.text }]}>Bonjour, {authUser?.name || 'Visiteur'}!</Text>
        <Text style={[styles.subGreeting, { color: COLORS.textSecondary }]}>Découvrez nos produits</Text>
      </View>

      <TouchableOpacity onPress={onCartPress} style={styles.cartIcon}>
        <Feather name="shopping-bag" size={26} color={COLORS.text} />
        {cartItemCount > 0 && (
          <View style={[styles.cartBadge, { backgroundColor: COLORS.notification }]}>
            <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>

    <View style={styles.searchAndFilterContainer}>
      <View style={[styles.searchContainer, { backgroundColor: COLORS.card }]}>
        <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: COLORS.text }]}
          placeholder="Rechercher un produit..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={handleSearchChange}
        />
      </View>

      <TouchableOpacity
        style={[styles.pickerContainer, { backgroundColor: COLORS.card }]}
        onPress={onCityFilterPress}
      >
        <Feather name="map-pin" size={16} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.textSecondary, marginLeft: 8 }}>{cityFilter}</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Catégories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryButton,
              { backgroundColor: activeCategory === cat ? COLORS.primary : COLORS.card }
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryText, { color: activeCategory === cat ? '#FFF' : COLORS.text }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>

    <Text style={[styles.sectionTitle, { color: COLORS.text, paddingHorizontal: S.spacing.md, marginTop: S.spacing.sm }]}>
      Produits Récents
    </Text>
  </>
);

// ── ÉCRAN PRINCIPAL ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { authUser } = useAuth();

  // États
  const [cart, setCart] = useState<CartItem[]>([]);
  const openSellerProductsModal = () => setSellerProductsModalVisible(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  

  // Modals
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [myOrdersModalVisible, setMyOrdersModalVisible] = useState(false);
  const [sellerDashboardModalVisible, setSellerDashboardModalVisible] = useState(false);
const [reviewModalVisible, setReviewModalVisible] = useState(false);
const [sellerProductsModalVisible, setSellerProductsModalVisible] = useState(false);
const [cityModalVisible, setCityModalVisible] = useState(false);
const [loadingOrders, setLoadingOrders] = useState(false);

const [myOrders, setMyOrders] = useState<any[]>([]);
const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  // Filtres
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [cityFilter, setCityFilter] = useState('Toutes les villes');
  const categories = ['Tous', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];
  const cities = ['Toutes les villes', 'Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Bukavu', 'Matadi', 'Kolwezi'];

  // Produits
  const {
    products,
    initialLoading,
    loadingMore,
    refreshing,
    onRefresh,
    handleLoadMore,
  } = useProductsAndSellers({
    search,
    activeCategory,
    city: cityFilter,
    minPrice: '',
    maxPrice: '',
    minRating: 0,
    sortBy: 'createdAt_desc',
  });

  // Cart
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    })();
  }, []);

  useEffect(() => { if (myOrdersModalVisible) fetchMyOrders(); }, [myOrdersModalVisible, fetchMyOrders]);
  useEffect(() => { if (sellerDashboardModalVisible) fetchSellerProducts(); }, [sellerDashboardModalVisible, fetchSellerProducts]);

  useEffect(() => {
    AsyncStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Ajouter / retirer du panier
  const addToCart = (product: Product | null) => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCart(prev => {
      const exist = prev.find(i => i.id === product.id);
      if (exist) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };


  const toggleFavorite = async (productId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authUser?.uid) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour gérer vos favoris.");
      router.push('/login'); return;
    }
    try {
      const favRef = collection(db,'userFavorites');
      const q = query(favRef, where('userId','==',authUser.uid), where('productId','==',productId));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(favRef, { userId:authUser.uid, productId, createdAt:serverTimestamp() });
        setFavorites(prev => [...prev, productId]);
      } else {
        snap.forEach(d => deleteDoc(doc(db,'userFavorites',d.id)));
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } catch (e) { console.error(e); Alert.alert("Erreur","Impossible de modifier les favoris."); }
  };



  const submitReview = async (rating:number, comment:string) => {
    if (!authUser?.uid || !selectedProduct?.id) return;
    try {
      await addDoc(collection(db,'productReviews'), {
        productId:selectedProduct.id, userId:authUser.uid, rating, comment:comment.trim(), createdAt:serverTimestamp()
      });
      Alert.alert("Succès","Votre avis a été soumis !");
      setReviewModalVisible(false);
    } catch { Alert.alert("Erreur","Impossible de soumettre l'avis."); }
  };

  const placeOrder = async (sellerId:string, items:CartItem[], totalAmount:number) => {
    if (!authUser?.uid) return;
    setLoadingOrder(sellerId);
    try {
      await addDoc(collection(db,'orders'), {
        buyerId:authUser.uid, buyerName:authUser.name||'Anonyme', buyerCity:authUser.city||'',
        sellerId, items, totalAmount, orderDate:serverTimestamp(), status:'pending'
      });
      setCart(prev => prev.filter(it => !items.some(ord => ord.id === it.id)));
      setCartModalVisible(false);
      Alert.alert("Succès","Commande passée !");
    } catch { Alert.alert("Erreur","Commande impossible."); } finally { setLoadingOrder(null); }
  };

  const fetchMyOrders = useCallback(async () => {
    if (!authUser?.uid) return;
    setLoadingOrders(true);
    try {
      const q = query(collection(db,'orders'), where('buyerId','==',authUser.uid), orderBy('orderDate','desc'));
      const snap = await getDocs(q);
      setMyOrders(snap.docs.map(d => ({ id:d.id, ...d.data(), orderDate:d.data().orderDate?.toDate() || new Date() })));
    } catch (e) { console.error(e); } finally { setLoadingOrders(false); }
  }, [authUser]);


  const fetchSellerProducts = useCallback(async () => {
    if (!authUser?.uid) return;
    try {
      const q = query(collection(db,'products'), where('sellerId','==',authUser.uid), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      setSellerProducts(snap.docs.map(d => ({ id:d.id, ...d.data() } as Product)));
    } catch (e) { console.error(e); }
  }, [authUser]);

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (id: string) => setCart(p => p.filter(i => i.id !== id));

  // Ouvrir détail produit
  const openDetailModal = async (product: Product) => {
    if (isOpeningModal) return;
    setIsOpeningModal(true);
    try {
      const snap = await getDoc(doc(db, 'users', product.sellerId));
      setSelectedProduct(product);
      setSellerInfo(snap.exists() ? (snap.data() as SellerInfo) : null);
      setDetailModalVisible(true);
    } finally {
      setIsOpeningModal(false);
    }
  };

  // Rendu
  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <ProductCard
      product={item}
      index={index}
      onPress={() => openDetailModal(item)}
      onAddToCart={() => addToCart(item)}
      isFavorite={favorites.includes(item.id)}
      onToggleFavorite={() => {/* toggleFavorite(item.id) */}}
    />
  );

  const renderListEmpty = () =>
    initialLoading ? (
      <View style={styles.gridContainer}>
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </View>
    ) : (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={64} color={COLORS.textSecondary} />
        <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>Aucun produit trouvé.</Text>
      </View>
    );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      {isOpeningModal && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
            onCartPress={() => setCartModalVisible(true)}
            cartItemCount={cart.length}
            search={search}
            handleSearchChange={setSearch}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            cities={cities}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            categories={categories}
            onCityFilterPress={() => setCityModalVisible(true)}
          />
        }
        ListEmptyComponent={renderListEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={COLORS.primary} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      />

      {/* Modals */}
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
      />
      <ProductDetailModal
  visible={detailModalVisible}
  product={selectedProduct}
  sellerInfo={sellerInfo}
  isFavorite={false}
  onClose={() => setDetailModalVisible(false)}
  onAddToCart={() => addToCart(selectedProduct)}
  onToggleFavorite={() => {}}
  onOpenSellerProducts={openSellerProductsModal}   // ← ajoute cette ligne
  onOpenReview={() => setReviewModalVisible(true)}
/>

<MyOrdersModal visible={myOrdersModalVisible} onClose={() => setMyOrdersModalVisible(false)} orders={myOrders} loading={loadingOrders} />
<SellerDashboardModal visible={sellerDashboardModalVisible} onClose={() => setSellerDashboardModalVisible(false)} products={sellerProducts} />
<ReviewModal visible={reviewModalVisible} onClose={() => setReviewModalVisible(false)} productName={selectedProduct?.name||''} onSubmit={submitReview} />

      <CityFilterModal
        visible={cityModalVisible}
        cities={cities}
        currentCity={cityFilter}
        onClose={() => setCityModalVisible(false)}
        onSelectCity={(city) => {
          setCityFilter(city);
          setCityModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  gridContainer: {
    paddingHorizontal: S.spacing.md - 2,
    paddingVertical: S.spacing.md,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.spacing.md,
    paddingVertical: S.spacing.md,
  },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subGreeting: { fontSize: 16 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: S.spacing.md },
  cartIcon: { position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: -S.spacing.sm / 2,
    right: -S.spacing.sm / 2,
    borderRadius: 999,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  cartBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  searchAndFilterContainer: {
    paddingHorizontal: S.spacing.md,
    marginBottom: S.spacing.md,
    gap: S.spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: S.radius.md,
    paddingHorizontal: S.spacing.md,
    height: 50,
    ...S.shadows.soft,
  },
  searchIcon: { marginRight: S.spacing.sm },
  searchInput: { flex: 1, height: '100%', fontSize: 16 },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.spacing.md,
    borderRadius: S.radius.md,
    height: 50,
    overflow: 'hidden',
    ...S.shadows.soft,
  },
  section: { marginBottom: S.spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: S.spacing.md, marginBottom: S.spacing.sm },
  categoryContainer: { paddingHorizontal: S.spacing.md, paddingBottom: S.spacing.sm },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: S.spacing.sm,
    ...S.shadows.soft,
  },
  categoryText: { fontSize: 14, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: S.spacing.xl, minHeight: 400 },
  emptyText: { fontSize: 16, marginTop: S.spacing.md, textAlign: 'center' },
  productCardSkeleton: { flex: 1 / 2, margin: S.spacing.xs, borderRadius: S.radius.md, overflow: 'hidden', backgroundColor: 'transparent' },
  skeletonImage: { width: '100%', height: 160, backgroundColor: '#E5E7EB', borderTopLeftRadius: S.radius.md, borderTopRightRadius: S.radius.md },
  skeletonTextContainer: { padding: S.spacing.sm },
  skeletonText: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8 },
});