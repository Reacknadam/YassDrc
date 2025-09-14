import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform, RefreshControl, SafeAreaView,
  ScrollView,
  StyleSheet, Switch, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// --- IMPORTS POUR FIREBASE & FONCTIONNALITÉS AJOUTÉES ---
import { db, firestore } from '@/firebase/config';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  AntDesign, Feather,
  Ionicons
} from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where
} from 'firebase/firestore';

import AnimatedButton from '@/components/AnimatedButton';
import AddProductModal from '@/components/modals/AddProductModal';
import ProductDetailModal from '@/components/modals/ProductDetailModal';
import OptimizedImage from '@/components/OptimizedImage';
import ProductCard from '@/components/products/ProductCard';
import { CartItem, Product, SellerInfo } from '@/types';

// Composant Squelette de Chargement
const SkeletonCard = () => (
  <View style={styles.card}>
    <View style={styles.skeletonImage} />
    <View style={{ flex: 1, padding: 10 }}>
      <View style={styles.skeletonTextLarge} />
      <View style={styles.skeletonTextSmall} />
    </View>
  </View>
);

// --- COMPOSANT PRINCIPAL : HomeScreen ---
export default function HomeScreen() {
  const router = useRouter();
  const { authUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // États pour la pagination et le chargement
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // États de l'utilisateur et des produits
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // États pour les modales
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [sellerDashboardModalVisible, setSellerDashboardModalVisible] = useState(false);
  const [myOrdersModalVisible, setMyOrdersModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  // Nouveaux états pour la modale des produits du vendeur
  const [sellerProductsModalVisible, setSellerProductsModalVisible] = useState(false);
  const [currentSellerProducts, setCurrentSellerProducts] = useState<Product[]>([]);
  const [currentSellerName, setCurrentSellerName] = useState<string>('');

  // États pour les formulaires
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  // États pour la recherche et les catégories
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const categories = ['Tous', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];

  // Nouveaux états pour les filtres et le tri
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt_desc'); // prix_asc, prix_desc, createdAt_desc, star_desc

  // États pour le panier
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);
  const cartScale = useRef(new Animated.Value(1)).current;

  // États pour les favoris et les commandes
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Fonctionnalité : Gestion des favoris (Wishlist)
  const loadFavorites = useCallback(async () => {
    if (!authUser?.id) {
      setFavorites([]);
      return;
    }
    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', authUser.id));
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

  const toggleFavorite = async (productId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authUser?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour gérer vos favoris.");
      router.push('/login');
      return;
    }

    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', authUser.id), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(favoritesRef, {
          userId: authUser.id,
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

  useEffect(() => {
    if (authUser) {
      loadFavorites();
    }
  }, [authUser, loadFavorites]);

  // Fonctions de la modale de détails du produit
  const openDetailModal = async (product: Product) => {
    setSelectedProduct(product);
    setSellerInfo(null);
    setDetailModalVisible(true);

    try {
      const sellerRef = doc(db, 'users', product.sellerId);
      const sellerSnap = await getDoc(sellerRef);

      if (sellerSnap.exists()) {
        const data = sellerSnap.data();
        setSellerInfo({
          email: data.email,
          name: data.name || "Anonyme",
          photoUrl: data.photoUrl || null,
          phoneNumber: data.sellerForm?.phoneNumber,
          shopName: data.sellerForm?.shopName,
          isVerified: data.isSellerVerified || false,
        });
      }
    } catch (err) {
      console.error("Erreur récupération vendeur:", err);
    }
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedProduct(null);
    setSellerInfo(null);
  };

  // NOUVELLE FONCTION pour ouvrir la modale des produits du vendeur
  const openSellerProductsModal = async (sellerId: string, sellerName: string) => {
    closeDetailModal();
    setSellerProductsModalVisible(true);
    setCurrentSellerName(sellerName);
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedProducts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
      setCurrentSellerProducts(fetchedProducts);
    } catch (error) {
      Alert.alert('Erreur', "Impossible de charger les produits du vendeur.");
    }
  };

  // Fonction de regroupement du panier par vendeur
  const groupCartBySeller = () => {
    const grouped: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      if (!grouped[item.sellerId]) {
        grouped[item.sellerId] = [];
      }
      grouped[item.sellerId].push(item);
    });
    return grouped;
  };

  // Animation de l'icône du panier
  const animateCart = () => {
    Animated.sequence([
      Animated.timing(cartScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(cartScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Fonction pour récupérer les produits depuis Firebase
  const fetchProducts = async (isRefreshing = false) => {
    if (!isRefreshing && (loadingMore || !hasMore)) return;

    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const productsQuery = collection(firestore, 'products');
      let q;

      if (search.trim()) {
        q = query(
          productsQuery,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          orderBy('name', 'asc'),
          limit(10)
        );
      } else {
        const constraints: any[] = [];
        switch (sortBy) {
          case 'price_asc': constraints.push(orderBy('price', 'asc')); break;
          case 'price_desc': constraints.push(orderBy('price', 'desc')); break;
          case 'star_desc': constraints.push(orderBy('star', 'desc')); break;
          default: constraints.push(orderBy('createdAt', 'desc')); break;
        }
        if (activeCategory !== 'Tous') { constraints.push(where('category', '==', activeCategory)); }
        if (minPrice) { constraints.push(where('price', '>=', parseFloat(minPrice))); }
        if (maxPrice) { constraints.push(where('price', '<=', parseFloat(maxPrice))); }
        if (minRating > 0) { constraints.push(where('star', '>=', minRating)); }
        constraints.push(limit(10));
        if (!isRefreshing && lastVisible) { constraints.push(startAfter(lastVisible)); }
        q = query(productsQuery, ...constraints);
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty && !isRefreshing) {
        setHasMore(false);
      } else {
        const fetched: Product[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(prev => isRefreshing ? fetched : [...prev, ...fetched]);
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(fetched.length === 10);
      }
    } catch (error) {
      console.error('Erreur récupération produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    fetchProducts(true);
  }, [search, activeCategory, minPrice, maxPrice, minRating, sortBy]);

  const handleLoadMore = () => {
    fetchProducts();
  };

  useEffect(() => {
    setInitialLoading(true);
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    const debounce = setTimeout(() => {
      fetchProducts(true);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, activeCategory, minPrice, maxPrice, minRating, sortBy]);

  // Effet pour vérifier le statut de vendeur
  useEffect(() => {
    if (!authUser?.id) {
      setIsVerifiedSeller(false);
      return;
    }
    const userRef = doc(db, 'users', authUser.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      setIsVerifiedSeller(docSnap.exists() ? docSnap.data().isSellerVerified || false : false);
    });
    return () => unsubscribe();
  }, [authUser]);

  // Effets pour la persistance du panier
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem('cart');
        if (savedCart) setCart(JSON.parse(savedCart));
      } catch (error) { console.error('Erreur chargement panier:', error); }
    };
    loadCart();
  }, []);

  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('cart', JSON.stringify(cart));
      } catch (error) { console.error('Erreur sauvegarde panier:', error); }
    };
    saveCart();
  }, [cart]);

  // Fonctions de gestion du panier
  const addToCart = (product: Product | null) => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    animateCart();
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
      return;
    }
    setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (text.length > 1) {
      const suggestions = products
        .map(p => p.name)
        .filter(name => name.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 5);
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Soumettre un avis
  const submitReview = async () => {
    if (!authUser?.id || !selectedProduct?.id || currentRating === 0) {
      Alert.alert("Erreur", "Veuillez vous connecter et donner une note.");
      return;
    }
    try {
      await addDoc(collection(db, 'productReviews'), {
        productId: selectedProduct.id,
        userId: authUser.id,
        rating: currentRating,
        comment: reviewComment.trim(),
        createdAt: serverTimestamp(),
      });
      Alert.alert("Succès", "Votre avis a été soumis !");
      setReviewModalVisible(false);
      setCurrentRating(0);
      setReviewComment('');
    } catch (error) {
      console.error("Erreur lors de la soumission de l'avis:", error);
      Alert.alert("Erreur", "Impossible de soumettre votre avis.");
    }
  };

  // Passer une commande
  const placeOrder = async (sellerId: string, items: CartItem[], totalAmount: number) => {
    if (!authUser?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour commander.");
      return;
    }
    setLoadingOrder(sellerId);
    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        buyerId: authUser.id,
        sellerId: sellerId,
        items: items.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.images[0] || '',
        })),
        totalAmount: totalAmount,
        orderDate: serverTimestamp(),
        status: 'pending',
      });
      setCart(prevCart => prevCart.filter(item => !items.some(orderedItem => orderedItem.id === item.id)));
      setCartModalVisible(false);
      router.push({
        pathname: '/pay',
        params: {
          orderId: orderRef.id,
          totalAmount: totalAmount.toString(),
          sellerId: sellerId,
          itemNames: JSON.stringify(items.map(item => item.name)),
        }
      });
    } catch (error) {
      console.error("Erreur lors de la commande:", error);
      Alert.alert("Erreur", "Impossible de passer la commande.");
    } finally {
      setLoadingOrder(null);
    }
  };

  // Récupérer l'historique des commandes
  const fetchMyOrders = useCallback(async () => {
    if (!authUser?.id) return;
    setLoadingOrders(true);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('buyerId', '==', authUser.id), orderBy('orderDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedOrders = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        orderDate: docSnap.data().orderDate?.toDate() || new Date()
      }));
      setMyOrders(fetchedOrders);
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
      Alert.alert("Erreur", "Impossible de charger vos commandes.");
    } finally {
      setLoadingOrders(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (myOrdersModalVisible) fetchMyOrders();
  }, [myOrdersModalVisible, fetchMyOrders]);

  // Récupérer les produits du vendeur
  const fetchSellerProducts = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('sellerId', '==', authUser.id), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedProducts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
      setSellerProducts(fetchedProducts);
    } catch (error) {
      console.error("Erreur chargement produits vendeur:", error);
    }
  }, [authUser]);

  useEffect(() => {
    if (sellerDashboardModalVisible) fetchSellerProducts();
  }, [sellerDashboardModalVisible, fetchSellerProducts]);

  const orderStatusMap = {
    pending: { label: 'En attente', color: '#FFA500', icon: 'clock' as const },
    shipped: { label: 'Expédiée', color: '#3498db', icon: 'truck' as const },
    delivered: { label: 'Livrée', color: '#2ecc71', icon: 'check-circle' as const },
    cancelled: { label: 'Annulée', color: '#e74c3c', icon: 'x-circle' as const },
  };

  // Fonction de rendu d'un produit dans la grille
  const renderItem = ({ item, index }: { item: Product, index: number }) => (
    <ProductCard
      product={item}
      isFavorite={favorites.includes(item.id)}
      onPress={openDetailModal}
      onAddToCart={addToCart}
      onToggleFavorite={toggleFavorite}
      index={index}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header et SearchBar */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.textPrimary }]}>Bonjour, {authUser?.name || 'Visiteur'} !</Text>
            <Text style={[styles.subGreeting, { color: theme.colors.textSecondary }]}>Que cherchez-vous aujourd'hui ?</Text>
          </View>
          <View style={styles.headerIcons}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{theme.mode === 'dark' ? 'Dark' : 'Light'}</Text>
              <Switch value={theme.mode === 'dark'} onValueChange={toggleTheme} trackColor={{ false: '#bbb', true: theme.colors.primary }} thumbColor={'#fff'} />
            </View>
            
            <TouchableOpacity style={styles.iconButton} onPress={() => setCartModalVisible(true)}>
              <Animated.View style={{ transform: [{ scale: cartScale }] }}>
                <Feather name="shopping-cart" size={24} color={theme.colors.textPrimary} />
              </Animated.View>
              {cart.length > 0 && <View style={styles.cartBadge} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de Recherche */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des produits..."
            value={search}
            onChangeText={handleSearchChange}
            placeholderTextColor="#999"
            onFocus={() => setShowSuggestions(search.length > 1 && searchSuggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && searchSuggestions.length > 0 && (
            <View style={styles.suggestionBox}>
              {searchSuggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => { setSearch(suggestion); setShowSuggestions(false); }}
                  style={styles.suggestionItem}
                >
                  <Text style={{ color: '#333' }}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Catégories de Produits */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Catégories</Text>
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.categoryBtn, activeCategory === cat && styles.activeCategoryBtn]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.categoryBtnText, activeCategory === cat && styles.activeCategoryBtnText]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Bouton "Publier un produit" */}
        {isVerifiedSeller && (
          <AnimatedButton
            style={styles.publishBtn}
            onPress={() => setAddProductModalVisible(true)}
          >
            <Feather name="upload" size={20} color="#fff" />
            <Text style={styles.publishBtnText}>Publier un Produit</Text>
          </AnimatedButton>
        )}

        {/* Mes commandes et Tableau de bord vendeur */}
        <View style={styles.dashboardButtonsContainer}>
          <AnimatedButton style={styles.dashboardButton} onPress={() => setMyOrdersModalVisible(true)}>
            <Feather name="list" size={20} color="#6C63FF" />
            <Text style={styles.dashboardButtonText}>Mes Commandes</Text>
          </AnimatedButton>

          <AnimatedButton
            style={styles.dashboardButton}
            onPress={() => { router.push(`/mes-commandes`); }}
          >
            <Feather name="list" size={20} color="#6C63FF" />
            <Text style={styles.dashboardButtonText}>Mes achats</Text>
          </AnimatedButton>
          {isVerifiedSeller && (
            <AnimatedButton style={styles.dashboardButton} onPress={() => setSellerDashboardModalVisible(true)}>
              <Feather name="bar-chart-2" size={20} color="#6C63FF" />
              <Text style={styles.dashboardButtonText}>Ventes</Text>
            </AnimatedButton>
          )}
        </View>

        {/* Grille de Produits */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Produits Récents</Text>
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </View>
        ) : products.length > 0 ? (
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.row}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
              loadingMore ? (
                <ActivityIndicator style={{ marginVertical: 20 }} size="small" color="#6C63FF" />
              ) : hasMore ? null : (
                <Text style={styles.endOfListText}>Fin de la liste des produits.</Text>
              )
            )}
          />
        ) : (
          <View style={styles.noProductsContainer}>
            <Feather name="box" size={50} color="#ccc" />
            <Text style={styles.noProductsText}>Aucun produit trouvé pour ces critères.</Text>
          </View>
        )}
      </ScrollView>

      {/* MODALES EXTRAITES */}
      <AddProductModal
        visible={addProductModalVisible}
        onClose={() => setAddProductModalVisible(false)}
        onProductAdded={onRefresh}
      />

      <ProductDetailModal
        visible={detailModalVisible}
        product={selectedProduct}
        sellerInfo={sellerInfo}
        isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
        onClose={closeDetailModal}
        onAddToCart={() => addToCart(selectedProduct)}
        onToggleFavorite={() => toggleFavorite(selectedProduct?.id || '')}
        onOpenSellerProducts={openSellerProductsModal}
        onOpenReview={() => setReviewModalVisible(true)}
      />

      {/* Modale des produits du vendeur */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sellerProductsModalVisible}
        onRequestClose={() => setSellerProductsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Produits de {currentSellerName}</Text>
              <TouchableOpacity onPress={() => setSellerProductsModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currentSellerProducts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.sellerProductItem} onPress={() => { setSellerProductsModalVisible(false); openDetailModal(item); }}>
                  <OptimizedImage source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
                  <View style={styles.sellerProductDetails}>
                    <Text style={styles.sellerProductName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.noProductsContainer}>
                  <Text style={styles.noProductsText}>Ce vendeur n'a pas encore de produits.</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modale du Panier */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cartModalVisible}
        onRequestClose={() => setCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Votre Panier ({cart.length})</Text>
              <TouchableOpacity onPress={() => setCartModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(groupCartBySeller()).map(([sellerId, items]) => (
                <View key={sellerId} style={styles.cartSection}>
                  <View style={styles.sellerHeader}>
                    <Text style={styles.sellerNameText}>{items[0].sellerName}</Text>
                    <TouchableOpacity
                      style={[styles.checkoutBtn, loadingOrder === sellerId && { backgroundColor: '#ccc' }]}
                      onPress={() => placeOrder(sellerId, items, items.reduce((sum, i) => sum + i.price * i.quantity, 0))}
                      disabled={loadingOrder !== null}
                    >
                      {loadingOrder === sellerId ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.checkoutBtnText}>Commander</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {items.map(item => (
                    <View key={item.id} style={styles.cartItem}>
                      <OptimizedImage source={{ uri: item.images[0] }} style={styles.cartItemImage} />
                      <View style={styles.cartItemDetails}>
                        <Text style={styles.cartItemName}>{item.name}</Text>
                        <Text style={styles.cartItemPrice}>{item.price.toLocaleString()} CDF</Text>
                      </View>
                      <View style={styles.cartItemControls}>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)}>
                          <AntDesign name="minuscircleo" size={24} color="#888" />
                        </TouchableOpacity>
                        <Text style={styles.cartItemQuantity}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)}>
                          <AntDesign name="pluscircleo" size={24} color="#6C63FF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={styles.cartFooter}>
              <Text style={styles.cartTotalText}>Total : {cartTotal.toLocaleString()} CDF</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modale des commandes */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={myOrdersModalVisible}
        onRequestClose={() => setMyOrdersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mes Commandes</Text>
              <TouchableOpacity onPress={() => setMyOrdersModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#333" />
              </TouchableOpacity>
            </View>
            {loadingOrders ? (
              <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 50 }} />
            ) : (
              <FlatList
                data={myOrders}
                keyExtractor={item => item.id}
                ListEmptyComponent={() => (
                  <View style={styles.noProductsContainer}>
                    <Text style={styles.noProductsText}>Vous n'avez pas encore passé de commande.</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const statusInfo = orderStatusMap[item.status as keyof typeof orderStatusMap];
                  if (!statusInfo) { return null; }
                  return (
                    <View style={styles.orderCard}>
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderCardTitle}>Commande #{item.id.slice(-6).toUpperCase()}</Text>
                        <View style={styles.statusBadge}>
                          <Feather name={statusInfo.icon} size={16} color={statusInfo.color} />
                          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.orderCardDate}>Date : {item.orderDate.toLocaleDateString()}</Text>
                      <Text style={styles.orderCardItemsTitle}>Articles :</Text>
                      {item.items.map((cartItem: any, index: number) => (
                        <View key={index} style={styles.orderItem}>
                          <OptimizedImage source={{ uri: cartItem.imageUrl }} style={styles.orderItemImage} />
                          <View style={styles.orderItemDetails}>
                            <Text style={styles.orderItemName}>{cartItem.name}</Text>
                            <Text style={styles.orderItemQuantity}>Quantité : {cartItem.quantity}</Text>
                            <Text style={styles.orderItemPrice}>Prix : {cartItem.price.toLocaleString()} CDF</Text>
                          </View>
                        </View>
                      ))}
                      <View style={styles.orderTotalContainer}>
                        <Text style={styles.orderTotalText}>Total : {item.totalAmount.toLocaleString()} CDF</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modale du tableau de bord vendeur */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sellerDashboardModalVisible}
        onRequestClose={() => setSellerDashboardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tableau de Bord Vendeur</Text>
              <TouchableOpacity onPress={() => setSellerDashboardModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.dashboardSectionTitle}>Vos Produits ({sellerProducts.length})</Text>
              {sellerProducts.length > 0 ? (
                <FlatList
                  data={sellerProducts}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.sellerProductItem}>
                      <OptimizedImage source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
                      <View style={styles.sellerProductDetails}>
                        <Text style={styles.sellerProductName}>{item.name}</Text>
                        <Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text>
                      </View>
                    </View>
                  )}
                />
              ) : (
                <Text style={styles.noProductsText}>Vous n'avez pas encore publié de produits.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modale d'avis */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reviewModalVisible}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Soumettre un Avis</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={30} color="#333" />
              </TouchableOpacity>
            </View>
            {selectedProduct && (
              <View style={styles.reviewContent}>
                <Text style={styles.reviewProductTitle}>{selectedProduct.name}</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setCurrentRating(star)}>
                      <AntDesign
                        name={star <= currentRating ? "star" : "staro"}
                        size={40}
                        color="#FFD700"
                        style={{ marginHorizontal: 5 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.inputArea}
                  placeholder="Écrivez votre commentaire..."
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                />
                <TouchableOpacity style={styles.submitReviewBtn} onPress={submitReview}>
                  <Text style={styles.submitReviewBtnText}>Envoyer l'avis</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subGreeting: { fontSize: 16, color: '#666' },
  headerIcons: { flexDirection: 'row' },
  iconButton: { marginLeft: 15, position: 'relative' },
  cartBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF6F61', width: 10, height: 10, borderRadius: 5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, margin: 15, paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 45, color: '#333' },
  suggestionBox: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginTop: -10, zIndex: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginHorizontal: 15, marginTop: 10, marginBottom: 10 },
  categoryContainer: { marginBottom: 10 },
  categoryScroll: { paddingHorizontal: 15 },
  categoryBtn: { backgroundColor: '#eee', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 15, marginRight: 10 },
  activeCategoryBtn: { backgroundColor: '#6C63FF' },
  categoryBtnText: { color: '#333', fontWeight: '500' },
  activeCategoryBtnText: { color: '#fff' },
  dashboardButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 15, marginBottom: 15 },
  dashboardButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginHorizontal: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  dashboardButtonText: { marginLeft: 10, fontWeight: '600', color: '#6C63FF' },
  publishBtn: { flexDirection: 'row', backgroundColor: '#6C63FF', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 15, marginBottom: 15 },
  publishBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
  row: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  loadingContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 10 },
  card: { width: '47%', backgroundColor: '#fff', borderRadius: 15, marginBottom: 15, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  noProductsContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  noProductsText: { fontSize: 16, color: '#888', marginTop: 10 },
  endOfListText: { textAlign: 'center', color: '#888', padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalView: { backgroundColor: '#f8f8f8', borderRadius: 20, padding: 20, width: '90%', maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  inputLabel: { fontSize: 16, fontWeight: '500', color: '#555', marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, color: '#333' },
  inputArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, color: '#333', height: 100, textAlignVertical: 'top' },
  orderCard: { backgroundColor: '#fff', borderRadius: 15, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  orderCardDate: { fontSize: 14, color: '#777', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  statusText: { marginLeft: 5, fontWeight: 'bold' },
  orderCardItemsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 10, marginBottom: 8 },
  orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 10, padding: 8 },
  orderItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 10, backgroundColor: '#f0f0f0' },
  orderItemDetails: { flex: 1 },
  orderItemName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 4 },
  orderItemQuantity: { fontSize: 14, color: '#666', marginBottom: 4 },
  orderItemPrice: { fontSize: 14, fontWeight: 'bold', color: '#6C63FF' },
  orderTotalContainer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10, alignItems: 'flex-end' },
  orderTotalText: { fontSize: 18, fontWeight: 'bold', color: '#6C63FF' },
  cartSection: { marginBottom: 20, padding: 10, backgroundColor: '#fff', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 },
  sellerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  checkoutBtn: { backgroundColor: '#2ecc71', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  checkoutBtnText: { color: '#fff', fontWeight: 'bold' },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cartItemImage: { width: 60, height: 60, borderRadius: 10, marginRight: 15 },
  cartItemDetails: { flex: 1 },
  cartItemName: { fontSize: 16, fontWeight: 'bold' },
  cartItemPrice: { fontSize: 14, color: '#6C63FF' },
  cartItemControls: { flexDirection: 'row', alignItems: 'center' },
  cartItemQuantity: { fontSize: 16, marginHorizontal: 10 },
  cartFooter: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10, alignItems: 'flex-end' },
  cartTotalText: { fontSize: 20, fontWeight: 'bold', color: '#6C63FF' },
  skeletonImage: { width: '100%', aspectRatio: 1, backgroundColor: '#e0e0e0' },
  skeletonTextLarge: { width: '80%', height: 15, backgroundColor: '#e0e0e0', borderRadius: 4, marginTop: 10, marginLeft: 10 },
  skeletonTextSmall: { width: '50%', height: 12, backgroundColor: '#e0e0e0', borderRadius: 4, marginTop: 5, marginLeft: 10, marginBottom: 10 },
  sellerProductItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  sellerProductImage: { width: 70, height: 70, borderRadius: 8, marginRight: 15 },
  sellerProductDetails: { flex: 1 },
  sellerProductName: { fontSize: 16, fontWeight: 'bold' },
  sellerProductPrice: { fontSize: 14, color: '#6C63FF', marginTop: 5 },
  dashboardSectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginVertical: 15, textAlign: 'center' },
  reviewContent: { padding: 10 },
  reviewProductTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  ratingContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  submitReviewBtn: { backgroundColor: '#6C63FF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  submitReviewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  starTextLarge: { fontSize: 18, color: '#333', marginLeft: 6, fontWeight: 'bold' },
  sellerNameText: { fontSize: 12, color: '#888', flexShrink: 1 },
});
