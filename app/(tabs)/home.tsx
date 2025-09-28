import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import SearchResultsModal from '../../components/modals/SearchResultsModal';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { useProductsAndSellers } from '../../hooks/useProductsAndSellers';
import { CartItem, Product, SellerInfo } from '../../types';

// Modals
import CartModal from '../../components/modals/CartModal';


import AddProductModal from '../../components/modals/AddProductModal';
import CityFilterModal from '../../components/modals/CityFilterModal';
import MyOrdersModal from '../../components/modals/MyOrdersModal';
import ProductDetailModal from '../../components/modals/ProductDetailModal';
import ReviewModal from '../../components/modals/ReviewModal';
import SellerDashboardModal from '../../components/modals/SellerDashboardModal';
import SellerProductsModal from '../../components/modals/SellerProductsModal';
import ShareModal from '../../components/modals/ShareModal';
import OptimizedImage from '../../components/OptimizedImage';
import ProductCard from '../../components/products/ProductCard';

const RECOMMENDATION_WORKER_URL = 'https://agent.israelntalu328.workers.dev/recommendations';

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

// ── CAROUSEL DE RECOMMANDATIONS ──────────────────────────────────────────────
const RecommendationCarousel = ({ products, onProductPress }: { products: Product[], onProductPress: (product: Product) => void }) => {
  // Fix 4: Toujours afficher quelque chose si la liste est vide.
  if (!products?.length) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Recommandés par L' IA</Text>
        <Text style={{ paddingLeft: 16, color: '#999' }}>
          Parcourez des produits pour voir des suggestions
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Recommandés par L' IA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationContainer}>
        {products.map(product => (
          <TouchableOpacity 
            key={product.id} 
            style={styles.recoCard} 
            onPress={() => {
              if (product && product.id) {
                onProductPress(product);
              }
            }} 
            activeOpacity={0.8}
          >
            {/* Fix 1: product.images[0] peut être undefined */}
            <OptimizedImage
              source={{ uri: product.images?.[0] || 'https://via.placeholder.com/150' }}
              style={styles.recoImage}
            />
            <View style={styles.recoInfo}>
              <Text style={styles.recoName} numberOfLines={2}>{product.name}</Text>
              {/* Fix 2: product.price peut être null */}
              <Text style={styles.recoPrice}>
                {typeof product.price === 'number' 
                  ? product.price.toLocaleString() 
                  : (product.price ?? '0')
                } CDF
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};


// ── HEADER SIMPLIFIÉ ────────────────────────────────────────────────────────
const HomeScreenHeader: React.FC<{
  authUser: any;
  onCartPress: () => void;
  cartItemCount: number;
  search: string;
  handleSearchChange: (text: string) => void;
  cityFilter: string;
  cities: string[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  categories: string[];
  onCityFilterPress: () => void;
  recommendedProducts: Product[];
  onProductPress: (product: Product) => void;
  searchProducts: (term: string) => Product[];
  setSearchResults: (results: Product[]) => void;
  setSearchModalVisible: (visible: boolean) => void;
}> = ({
  authUser,
  onCartPress,
  cartItemCount,
  handleSearchChange,
  cityFilter,
  cities,
  activeCategory,
  setActiveCategory,
  categories,
  onCityFilterPress,
  recommendedProducts,
  onProductPress,
  searchProducts,
  setSearchResults,
  setSearchModalVisible,
}) => {

  
  // Removed invalid property declarations inside the function body.
  // Fix 4: Le state 'suggestions' est déclaré 2 fois. Supprimé à l'intérieur de la fonction imbriquée.

  const [search, setSearch] = useState('');
  return (
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
    <View style={styles.searchContainer}>
  <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
  <TextInput
    style={[styles.searchInput, { color: COLORS.text }]}
    placeholder="Rechercher un produit..."
    placeholderTextColor={COLORS.textSecondary}
    value={search}
    onChangeText={setSearch}
    onSubmitEditing={() => {
      const results = searchProducts(search);
      setSearchResults(results);
      setSearchModalVisible(true);
    }}
  />
  {/* Bouton "Voir résultats" */}
  <TouchableOpacity
    onPress={() => {
      const results = searchProducts(search);
      setSearchResults(results);
      setSearchModalVisible(true);
    }}
    style={{ paddingHorizontal: 10 }}
  >
    <Feather name="arrow-right-circle" size={24} color={COLORS.primary} />
  </TouchableOpacity>
</View>

      {/* Suppression des hooks à l'intérieur de la fonction imbriquée */}
      {/* showSuggestions et suggestions sont maintenant gérés par le composant parent */}
      {/* Le FlatList est déplacé dans le composant principal si nécessaire, ou on s'assure que les props sont passées correctement */}
      <TouchableOpacity
        style={[styles.pickerContainer, { backgroundColor: COLORS.card }]}
        onPress={onCityFilterPress}
      >
        <Feather name="map-pin" size={16} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.textSecondary, marginLeft: 8 }}>{cityFilter}</Text>
      </TouchableOpacity>
    </View>
    
    <RecommendationCarousel products={recommendedProducts} onProductPress={onProductPress} />

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
};
// ── ÉCRAN PRINCIPAL ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { authUser } = useAuth();

  // State for Share Modal
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [productForShare, setProductForShare] = useState<Product | null>(null);

  // Fix 4: Le state 'suggestions' est déclaré une seule fois au niveau racine.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // États

  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
const [searchModalVisible, setSearchModalVisible] = useState(false);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Modals
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [myOrdersModalVisible, setMyOrdersModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [sellerProductsModalVisible, setSellerProductsModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [addProductVisible, setAddProductVisible] = useState(false);
  const [sellerDashboardVisible, setSellerDashboardVisible] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [selectedSellerProducts, setSelectedSellerProducts] = useState<Product[]>([]);
  const [selectedSellerName, setSelectedSellerName] = useState('');

  // Nouveaux états pour les fonctionnalités
  const [viewedProducts, setViewedProducts] = useState<string[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  // Filtres
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [cityFilter, setCityFilter] = useState('Toutes les villes');
  const categories = ['Tous', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];
  // Liste complète des principales villes de la RDC
  const cities = [
    'Toutes les villes',
    'Kinshasa',
    'Lubumbashi',
    'Mbuji-Mayi',
    'Kananga',
    'Kisangani',
    'Bukavu',
    'Goma',
    'Matadi',
    'Bunia',
    'Likasi',
    'Kolwezi',
    'Tshikapa',
    'Uvira',
    'Boma',
    'Butembo',
    'Kikwit',
    'Isiro',
    'Bandundu',
    'Kindu',
    'Gemena',
    'Kalemie',
    'Mwene-Ditu',
    'Mbandaka',
    'Kamina',
    'Beni',
    'Kipushi',
    'Baraka',
    'Kasumbalesa',
    'Kabinda',
    'Lodja',
    'Gbadolite',
    'Demba',
    'Mweka',
    'Boende',
    'Inongo',
    'Idiofa',
    'Basankusu',
    'Libenge',
    'Aketi',
    'Bondo',
    'Lisala',
    'Lusambo',
    'Tshela',
    'Zongo',
    'Mongbwalu',
    'Kasongo',
    'Dilolo',
    'Mongala',
    'Kabare',
    'Kasenga',
    'Kenge',
    'Kambove',
    'Kole',
    'Luebo',
    'Popokabaka',
    'Sandoa',
    'Kasaji',
    'Moba',
    'Fizi',
    'Bukama',
    'Kalehe',
    'Kibombo',
    'Kiri',
    'Lukolela',
    'Masi-Manimba',
    'Mitwaba',
    'Nyunzu',
    'Punia',
    'Shabunda',
    'Tshilenge',
    'Tshikapa',
    'Yakoma',
    'Zongo',
    // Ajoutez d'autres villes si besoin
  ];
  const orderStatusMap = {
    pending: { label: 'En attente', color: '#FF9800', icon: 'clock' as const },
    shipped: { label: 'Expédiée', color: '#2196F3', icon: 'truck' as const },
    delivered: { label: 'Livrée', color: '#4CAF50', icon: 'check-circle' as const },
    cancelled: { label: 'Annulée', color: '#f44336', icon: 'x-circle' as const },
  } as const;

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
  
  const displayedProducts = useMemo(() => {
    const favoriteProducts = products.filter(p => favorites.includes(p.id));
    const otherProducts = products.filter(p => !favorites.includes(p.id));
    return [...favoriteProducts, ...otherProducts];
  }, [products, favorites]);


  function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
  
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }


  useEffect(() => {
    const term = normalize(search.trim());
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
  
    const scored = allProducts
      .map(p => {
        const txt = normalize(
          `${p.name ?? ''} ${p.description ?? ''} ${p.category ?? ''} ${p.city ?? ''}`
        );
        const lev = levenshtein(term, txt);
        const keywordMatch = txt.includes(term) ? 1 : 0;
        const score = keywordMatch * 10 - lev;
        return { ...p, score };
      })
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);
  
    setSuggestions(scored.slice(0, 5).map(p => p.name));
    setShowSuggestions(scored.length > 0);
  }, [search, allProducts]);
  // Petite fonction de normalisation
const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enlève accents
    .replace(/s$/, '');             // enlève pluriel simple





    
  // Cart & Favorites
  useEffect(() => {
    (async () => {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      
      if (authUser?.uid) {
        const q = query(collection(db, 'userFavorites'), where('userId', '==', authUser.uid));
        const snap = await getDocs(q);
        setFavorites(snap.docs.map(d => d.data().productId));
      }
    })();
  }, [authUser]);
  

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'products'));
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setAllProducts(prods);
    })();
  }, []);

  // Recommandations
  useEffect(() => {
    const getCreatedAtMs = (p: Product): number => {
      const value: any = (p as any)?.createdAt;
      if (!value) return 0;
      if (typeof value === 'number') return value;
      if (value instanceof Date) return value.getTime();
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (typeof value.seconds === 'number') return value.seconds * 1000;
      return 0;
    };

    const fetchRecommendations = async () => {
      // Fix 2: viewedProducts vide au 1er lancement.
      const productIds = viewedProducts.length > 0
        ? viewedProducts
        : allProducts.slice(0, 3).map(p => p.id);

      // Si le tableau est vide (par exemple, allProducts est vide), on ne fait rien
      if (productIds.length === 0) {
        setRecommendedProducts([]);
        return;
      }
      
      try {
        const body = {
          product_ids: productIds,
          city: cityFilter === 'Toutes les villes' ? null : cityFilter,
          category: activeCategory === 'Tous' ? null : activeCategory,
        };

        const res = await fetch(RECOMMENDATION_WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        // Fix 1: Le worker renvoie 404 ou CORS
        if (!res.ok) throw new Error('Worker down');
        
        const data = await res.json();
        // Fix 3: Le worker attend 'product_ids' mais le champ de retour peut être différent.
        // On vérifie le nom de champ et on fallback à un tableau vide si nécessaire.
        setRecommendedProducts(data.recommended_products ?? []);
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
        // Fix 1: Fallback local si la requête échoue
        const fallback = allProducts
          .filter(p => viewedProducts.includes(p.id)) // produits déjà vus
          .sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a)) // tri par plus récents
          .slice(0, 5);
        setRecommendedProducts(fallback);
      }
    };

    const debounce = setTimeout(fetchRecommendations, 1000);
    return () => clearTimeout(debounce);

  }, [viewedProducts, cityFilter, activeCategory, allProducts]);

  useEffect(() => { if (myOrdersModalVisible) fetchMyOrders(); }, [myOrdersModalVisible]);

  useEffect(() => {
    AsyncStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Ajouter / retirer du panier
  const addToCart = (product: Product | null) => {
    // Fix 3: Guard pour s'assurer que product et product.id existent.
    if (!product?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCart(prev => {
      const exist = prev.find(i => i.id === product.id);
      if (exist) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const toggleFavorite = async (productId: string) => {
    // Fix 3: Guard pour s'assurer que productId existe.
    if (!productId) return;
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
    } catch (e: any) { Alert.alert("Erreur",`Impossible de modifier les favoris: ${e.message}`); }
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

  const fetchMyOrders = useCallback(async () => {
    if (!authUser?.uid) return;
    setLoadingOrders(true);
    try {
      const q = query(collection(db,'orders'), where('buyerId','==',authUser.uid), orderBy('orderDate','desc'));
      const snap = await getDocs(q);
      setMyOrders(snap.docs.map(d => ({ id:d.id, ...d.data(), orderDate:d.data().orderDate?.toDate() || new Date() })));
    } catch (e: any) { 
      Alert.alert("Erreur", `Impossible de charger vos commandes: ${e.message}`);
    } finally { 
      setLoadingOrders(false); 
    }
  }, [authUser]);

  const handleOpenSellerProducts = async (sellerId: string, sellerName: string) => {
    try {
      const q = query(collection(db, 'products'), where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const sellerProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setSelectedSellerProducts(sellerProducts);
      setSelectedSellerName(sellerName);
      setDetailModalVisible(false);
      setSellerProductsModalVisible(true);
    } catch (error: any) {
      Alert.alert("Erreur", `Impossible de charger les produits du vendeur: ${error.message}`);
    }
  };

  const searchProducts = (term: string): Product[] => {
    if (!term.trim()) return [];
    const needle = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return allProducts
      .map(p => {
        const hay = `${p.name} ${p.description} ${p.category} ${p.city}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const score = hay.includes(needle) ? 10 : 0;
        return { ...p, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  const fetchMyProducts = useCallback(async (): Promise<Product[]> => {
    try {
      if (!authUser?.uid) return [];
      const q = query(collection(db, 'products'), where('sellerId', '==', authUser.uid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    } catch {
      return [];
    }
  }, [authUser]);

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (id: string) => setCart(p => p.filter(i => i.id !== id));

  // Ouvrir détail produit
  const openDetailModal = async (product: Product) => {
    if (isOpeningModal || !product || !product.id) return;
    setIsOpeningModal(true);
    
    setViewedProducts(prev => {
      const newViewed = [product.id, ...prev.filter(id => id !== product.id)];
      return newViewed.slice(0, 5);
    });

    try {
      // Vérifier que le produit a un sellerId valide
      if (product.sellerId) {
        const snap = await getDoc(doc(db, 'users', product.sellerId));
        setSelectedProduct(product);
        setSellerInfo(snap.exists() ? (snap.data() as SellerInfo) : null);
        setDetailModalVisible(true);
      } else {
        console.warn('Product missing sellerId:', product);
        // Afficher quand même le produit sans info vendeur
        setSelectedProduct(product);
        setSellerInfo(null);
        setDetailModalVisible(true);
      }
    } catch (error) {
      console.error('Error opening product detail:', error);
      // En cas d'erreur, essayer d'afficher le produit quand même
      setSelectedProduct(product);
      setSellerInfo(null);
      setDetailModalVisible(true);
    } finally {
      setIsOpeningModal(false);
    }
  };

  // Handlers for Share Modal
  const handleLongPressProduct = (product: Product) => {
    setProductForShare(product);
    setShareModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleShareProduct = async () => {
    if (!productForShare) return;
    setShareModalVisible(false);
  
    const url   = `https://api.israelntalu328.workers.dev/product?id=${productForShare.id}`;
    const message = `${productForShare.name} - Découvrez ce produit sur Yass !\n${url}`;
  
    /* 3️⃣  Copie + alerte */
    Clipboard.setString(message);
    Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers.');
  
    /* 4️⃣  Sheet natif (WhatsApp, Telegram, etc.) */
    try {
      const result = await Share.share({ message });
      console.log('📤 résultat Share :', result);
    } catch (err) {
      console.warn('Share échoué :', err);
    }
  };

  
  
  const handleReportProduct = () => {
    if (!productForShare) return;
    setShareModalVisible(false);
    // In a real app, you would send this report to your backend
    Alert.alert(
      'Produit signalé',
      `Merci d'avoir signalé "${productForShare.name}". Notre équipe va examiner la situation.`,
      [{ text: 'OK' }]
    );
  };

  // Rendu
  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <ProductCard
      product={item}
      index={index}
      onPress={() => openDetailModal(item)}
      onAddToCart={() => addToCart(item)}
      isFavorite={favorites.includes(item.id)}
      onToggleFavorite={() => toggleFavorite(item.id)}
      onLongPress={handleLongPressProduct}
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
  
  const isSellerVerified = authUser?.isSellerVerified === true;

  const quickActions = [
    ...(isSellerVerified
      ? [
          {
            key: 'add',
            icon: 'plus',
            onPress: () => setAddProductVisible(true),
            color: COLORS.primary,
          },
          {
            key: 'dashboard',
            icon: 'grid',
            onPress: async () => {
              const myProducts = await fetchMyProducts();
              setSelectedSellerProducts(myProducts);
              setSelectedSellerName(authUser?.name || 'Mes produits');
              setSellerDashboardVisible(true);
            },
            color: '#333',
          },
          {
            key: 'orders',
            icon: 'shopping-bag',
            onPress: () => setMyOrdersModalVisible(true),
            color: COLORS.notification,
          },
        ]
      : []),
  ];


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      {isOpeningModal && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Rendu des suggestions de recherche */}
      {showSuggestions && (
          <FlatList
            horizontal
            style={styles.suggestionRow}
            data={suggestions}
            keyExtractor={(_, i) => i.toString()} // Fix 6: fallback pour keyExtractor
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => {
                  setSearch(item);
                  setShowSuggestions(false);
                }}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        )}

      <FlatList
        data={displayedProducts}
        renderItem={renderItem}
        // Fix 6: keyExtractor sur item.id peut être undefined. Ajout d'un fallback.
        keyExtractor={item => item.id ?? Math.random().toString()}
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
            cities={cities}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            categories={categories}
            onCityFilterPress={() => setCityModalVisible(true)}
            recommendedProducts={recommendedProducts}
            onProductPress={openDetailModal}
            searchProducts={searchProducts}
            setSearchResults={setSearchResults}
            setSearchModalVisible={setSearchModalVisible}
          />
        }
        ListEmptyComponent={renderListEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={COLORS.primary} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      />

      {/* Modals */}
      {/* Quick actions - BLOC MODIFIÉ */}
      {quickActions.length > 0 && (
        <View style={{ position: 'absolute', right: 16, bottom: 100, gap: 10, zIndex: 999 }}>
          {quickActions.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              onPress={btn.onPress}
              style={{
                backgroundColor: btn.color,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 24,
                ...S.shadows.soft,
              }}
            >
              <Feather name={btn.icon as any} size={22} color="#fff" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onPlaceOrder={() => {}}
        loadingOrder={null}
      />

      <SearchResultsModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        results={searchResults}
        onAddToCart={addToCart}
      />


      <ProductDetailModal
        visible={detailModalVisible}
        product={selectedProduct}
        sellerInfo={sellerInfo}
        isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
        onClose={() => setDetailModalVisible(false)}
        onAddToCart={() => addToCart(selectedProduct)}
        onToggleFavorite={() => selectedProduct && toggleFavorite(selectedProduct.id)}
        onOpenSellerProducts={handleOpenSellerProducts}
        onOpenReview={() => setReviewModalVisible(true)}
      />
      <SellerDashboardModal
        visible={sellerDashboardVisible}
        onClose={() => setSellerDashboardVisible(false)}
        products={selectedSellerProducts}
      />
      <SellerProductsModal
        visible={sellerProductsModalVisible}
        onClose={() => setSellerProductsModalVisible(false)}
        products={selectedSellerProducts}
        sellerName={selectedSellerName}
        onProductPress={openDetailModal} // ← même nom
      />
      <AddProductModal
        visible={addProductVisible}
        onClose={() => setAddProductVisible(false)}
        onProductAdded={() => {
          onRefresh();
          setAddProductVisible(false);
        }}
      />
      <MyOrdersModal visible={myOrdersModalVisible} onClose={() => setMyOrdersModalVisible(false)} orders={myOrders} loading={loadingOrders} orderStatusMap={orderStatusMap} />
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
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onShare={handleShareProduct}
        onReport={handleReportProduct}
        productName={productForShare?.name || ''}
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
  greeting: { fontSize: 18, fontWeight: 'bold' },
  subGreeting: { fontSize: 16 },
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
  recommendationContainer: { paddingHorizontal: S.spacing.md, paddingBottom: S.spacing.sm },
  recoCard: {
    width: 150,
    marginRight: S.spacing.sm,
    borderRadius: S.radius.md,
    backgroundColor: COLORS.card,
    ...S.shadows.soft,
    overflow: 'hidden',
  },
  recoImage: {
    width: '100%',
    height: 120,
  },
  recoInfo: {
    padding: S.spacing.sm,
  },
  recoName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  suggestionRow: { maxHeight: 40, marginTop: 8, paddingHorizontal: 16 },
suggestionChip: {
  backgroundColor: '#f2f2f2',
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 6,
  marginRight: 8,
},

searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: COLORS.card,
  borderRadius: S.radius.md,
  paddingHorizontal: S.spacing.md,
  height: 50,
  ...S.shadows.soft,
},
suggestionText: { fontSize: 14, color: '#333' },
  recoPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
});