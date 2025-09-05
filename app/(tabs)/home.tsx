import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

// --- IMPORTS POUR FIREBASE & FONCTIONNALITÉS AJOUTÉES ---
import { db, firestore, storage } from '@/firebase/config';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as Haptics from 'expo-haptics';
import { createProduct } from '@/services/productService';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  startAfter,
  limit,
  query,
  serverTimestamp,
  DocumentSnapshot,
  where,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import {
  AntDesign, Feather,
  Ionicons
} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// --- DÉFINITIONS DES TYPES ET COMPOSANTS UTILITAIRES ---
const onboardingSlides = [
  {
    id: '1',
    title: 'Bienvenue sur Jimmy !',
    description: 'Découvrez des produits uniques, connectez-vous avec les vendeurs locaux et simplifiez vos achats.',
    image: require('@/assets/images/icon.jpg'),
    backgroundColor: '#6C63FF',
  },
  {
    id: '2',
    title: 'Explorez nos Catégories',
    description: 'Parcourez facilement des milliers de produits organisés par catégories pour trouver ce que vous aimez.',
    image: require('@/assets/images/icon.jpg'),
    backgroundColor: '#FF6F61',
  },
  {
    id: '3',
    title: 'Paiement Sécurisé & Rapide',
    description: 'Achetez en toute confiance avec nos options de paiement sécurisées et un processus de commande simplifié.',
    image: require('@/assets/images/icon.jpg'),
    backgroundColor: '#4CAF50',
  },
  {
    id: '4',
    title: 'Commencez Votre Aventure',
    description: 'Prêt à découvrir ? Lancez-vous et explorez un monde de possibilités !',
    image: require('@/assets/images/icon.jpg'),
    backgroundColor: '#2196F3',
  },
];

const promoSlides = [
  { id: '1', title: 'Nouvelle Collection', subtitle: 'Jusqu\'à -40%', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff' },
  { id: '2', title: 'Ventes Flash', subtitle: 'Électronique à prix cassé', image: 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6' },
  { id: '3', title: 'Frais de livraison gratuits', subtitle: 'Pour toute commande > 50.000 CDF', image: 'https://images.unsplash.com/photo-1616212457850-209ff8274154' },
];

interface OnboardingItemProps {
  item: typeof onboardingSlides[0];
}

const { width, height } = Dimensions.get('window');

const OnboardingItem: React.FC<OnboardingItemProps> = ({ item }) => {
  return (
    <View style={[styles.onboardingSlide, { width, backgroundColor: item.backgroundColor }]}>
      <Image source={item.image} style={styles.onboardingImage} />
      <View style={styles.onboardingContent}>
        <Text style={styles.onboardingTitle}>{item.title}</Text>
        <Text style={styles.onboardingDescription}>{item.description}</Text>
      </View>
    </View>
  );
};

// Types mis à jour
type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[]; // Contient maintenant les URLs de Firebase Storage
  star?: number;
  category?: string;
  sellerId: string;
  // Données vendeur dénormalisées pour la performance
  sellerName: string;
  sellerPhotoUrl?: string;
  isSellerVerified?: boolean;
  createdAt?: any;
};

type CartItem = Product & {
  quantity: number;
};

interface SellerInfo {
  email: string;
  name?: string;
  photoUrl?: string; // On utilise maintenant une URL
  phoneNumber?: string;
  shopName?: string;
  isVerified?: boolean;
}

interface ImagePaginationProps {
  imagesCount: number;
  scrollX: Animated.Value;
}

const ImagePagination: React.FC<ImagePaginationProps> = ({ imagesCount, scrollX }) => {
  return (
    <View style={styles.imagePaginationContainer}>
      {Array.from({ length: imagesCount }).map((_, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 20, 8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i.toString()}
            style={[styles.imageDot, { width: dotWidth, opacity }]}
          />
        );
      })}
    </View>
  );
};

// Composant Squelette de Chargement
const SkeletonCard = () => (
  <View style={styles.card}>
    <View style={styles.skeletonImage} />
    <View style={styles.cardInfo}>
      <View style={styles.skeletonTextLarge} />
      <View style={styles.skeletonTextSmall} />
    </View>
  </View>
);

// Hook personnalisé pour le cache d'images
const useImageCache = () => {
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  // Charger le cache au démarrage
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cachedImages = await AsyncStorage.getItem('imageCache');
        if (cachedImages) {
          setImageCache(JSON.parse(cachedImages));
        }
      } catch (error) {
        console.error('Erreur lors du chargement du cache:', error);
      }
    };
    loadCache();
  }, []);

  // Mettre à jour le cache
  const updateCache = async (url: string, localUri: string) => {
    const newCache = { ...imageCache, [url]: localUri };
    setImageCache(newCache);
    try {
      await AsyncStorage.setItem('imageCache', JSON.stringify(newCache));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du cache:', error);
    }
  };

  return { imageCache, updateCache };
};

// Composant OptimizedImage avec cache
interface OptimizedImageProps {
  source: { uri: string };
  style: any;
  [key: string]: any;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ source, style, ...props }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const { imageCache, updateCache } = useImageCache();

  useEffect(() => {
    const loadImage = async () => {
      if (!source.uri) {
        setIsLoading(false);
        return;
      }

      // Vérifier si l'image est en cache
      if (imageCache[source.uri]) {
        setLocalUri(imageCache[source.uri]);
        setIsLoading(false);
        return;
      }

      // Télécharger et mettre en cache l'image
      try {
        const response = await fetch(source.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64data = reader.result as string;
          setLocalUri(base64data);
          updateCache(source.uri, base64data);
          setIsLoading(false);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Erreur de chargement image:', error);
        setLocalUri(source.uri);
        setIsLoading(false);
      }
    };

    loadImage();
  }, [source.uri, imageCache]);

  return (
    <View style={style}>
      {isLoading && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          size="small"
          color="#6C63FF"
        />
      )}
      <Image
        source={localUri ? { uri: localUri } : source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        {...props}
      />
    </View>
  );
};

// --- COMPOSANT PRINCIPAL : HomeScreen ---
export default function HomeScreen() {
  const router = useRouter();
  const { authUser } = useAuth();

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
  const [loading, setLoading] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // États pour les modales
  const [modalVisible, setModalVisible] = useState(false);
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
  const [images, setImages] = useState<string[]>([]); // Contient maintenant les URIs locales des images à uploader
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [currentRating, setCurrentRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

  // États et références pour le tutoriel d'onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const productImagesScrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList | null>(null);

  // États pour les favoris et les commandes
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Clé pour AsyncStorage
  const CHECK_ONBOARDING_KEY = 'hasSeenOnboarding';

  // Effet pour les permissions d'accès aux médias
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission requise', 'Nous avons besoin de la permission pour accéder à vos photos.');
        }

        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus.status !== 'granted') {
          Alert.alert('Permission requise', 'Nous avons besoin de la permission pour utiliser la caméra.');
        }
      }
    })();
  }, []);

  // Fonctions pour le tutoriel d'onboarding
  const checkFirstLaunch = async () => {
    try {
      const hasSeen = await AsyncStorage.getItem(CHECK_ONBOARDING_KEY);
      if (hasSeen === null) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du tutoriel:", error);
    }
  };

  const skipOnboarding = async () => {
    try {
      await AsyncStorage.setItem(CHECK_ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du tutoriel:", error);
    }
  };

  const handleOnboardingScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleOnboardingViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentSlideIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToNextSlide = () => {
    const nextSlideIndex = currentSlideIndex + 1;
    if (nextSlideIndex < onboardingSlides.length) {
      flatListRef.current?.scrollToIndex({ index: nextSlideIndex, animated: true });
    } else {
      skipOnboarding();
    }
  };

  useEffect(() => {
    checkFirstLaunch();
  }, []);

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

  // Démarrer une conversation avec le vendeur
  const startChatWithSeller = async () => {
    if (!authUser?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour discuter avec le vendeur.");
      router.push('/login');
      return;
    }

    if (!selectedProduct?.sellerId) {
      Alert.alert("Erreur", "Impossible de trouver l'ID du vendeur.");
      return;
    }

    const sellerId = selectedProduct.sellerId;
    const currentUserId = authUser.id;

    if (sellerId === currentUserId) {
      Alert.alert("Action impossible", "Vous ne pouvez pas discuter avec vous-même.");
      return;
    }

    setLoadingOrder('chat');
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', currentUserId), limit(1));
      const querySnapshot = await getDocs(q);

      let chatId = null;
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.participants.includes(sellerId)) {
          chatId = docSnap.id;
        }
      });

      if (chatId) {
        router.push({ pathname: '/chat', params: { id: chatId } });
      } else {
        const newChatRef = await addDoc(chatsRef, {
          participants: [currentUserId, sellerId],
          createdAt: serverTimestamp(),
          lastMessage: null,
        });
        router.push({ pathname: '/chat', params: { id: newChatRef.id } });
      }
      setDetailModalVisible(false);
    } catch (error) {
      console.error("Erreur lors de l'initialisation du chat:", error);
      Alert.alert("Erreur", "Impossible de démarrer la conversation.");
    } finally {
      setLoadingOrder(null);
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

  // Remplacer la fonction uploadImageAsync par cette version corrigée
  const uploadImageAsync = async (uri: string): Promise<string> => {
    try {
      // Convertir l'URI en blob correctement
      const response = await fetch(uri);
      const blob = await response.blob();

      const fileName = `${authUser?.id}_${Date.now()}`;
      const storageRef = ref(storage, `products/${authUser?.id}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload error:", error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              console.error("Error getting download URL:", error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error creating blob:", error);
      throw new Error("Failed to upload image");
    }
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
        // Combine all search-related filters in a single query() call
        q = query(
          productsQuery,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          orderBy('name', 'asc'),
          limit(10)
        );
      } else {
        // Build an array of query constraints
        const constraints: any[] = [];

        switch (sortBy) {
          case 'price_asc':
            constraints.push(orderBy('price', 'asc'));
            break;
          case 'price_desc':
            constraints.push(orderBy('price', 'desc'));
            break;
          case 'star_desc':
            constraints.push(orderBy('star', 'desc'));
            break;
          case 'createdAt_desc':
          default:
            constraints.push(orderBy('createdAt', 'desc'));
            break;
        }

        if (activeCategory !== 'Tous') {
          constraints.push(where('category', '==', activeCategory));
        }
        if (minPrice) {
          constraints.push(where('price', '>=', parseFloat(minPrice)));
        }
        if (maxPrice) {
          constraints.push(where('price', '<=', parseFloat(maxPrice)));
        }
        if (minRating > 0) {
          constraints.push(where('star', '>=', minRating));
        }

        constraints.push(limit(10));

        if (!isRefreshing && lastVisible) {
          constraints.push(startAfter(lastVisible));
        }

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
      } catch (error) {
        console.error('Erreur chargement panier:', error);
      }
    };
    loadCart();
  }, []);

  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('cart', JSON.stringify(cart));
      } catch (error) {
        console.error('Erreur sauvegarde panier:', error);
      }
    };
    saveCart();
  }, [cart]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Réduisez légèrement la qualité si nécessaire
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.slice(0, 3).map(asset => asset.uri);
      setImages(prev => [...prev, ...uris].slice(0, 3));
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, 3));
    }
  };

  const confirmAndPublish = () => {
    Alert.alert(
      "Confirmer la publication",
      "Voulez-vous vraiment publier ce produit ?",
      [{ text: "Annuler", style: "cancel" }, { text: "Publier", onPress: handleAddProduct }]
    );
  };

  // Fonction d'ajout de produit utilisant Firebase Storage
  const handleAddProduct = async () => {
    if (loading) return;
    if (!authUser?.id || !name.trim() || !description.trim() || !price.trim() || images.length === 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs et ajouter au moins une image.');
      return;
    }
    setLoading(true);
    setUploadProgress(0);
    try {
      const imageUrls = await Promise.all(images.map(uri => uploadImageAsync(uri)));
      setUploadProgress(null);
      await createProduct({
        name,
        description,
        price: parseFloat(price),
        images: imageUrls,
        category: category || 'Général',
        sellerId: authUser.id,
        sellerName: authUser.shopName || authUser.name || 'Vendeur Anonyme',
        sellerPhotoUrl: authUser.photoUrl || '',
        createdAt: serverTimestamp()
      });
      onRefresh();
      Alert.alert('Succès', 'Produit publié avec succès !');
      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Erreur publication produit:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de la publication.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setImages([]);
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    openDetailModal(product);
  };

  // Fonctions de gestion du panier
  const addToCart = (product: Product | null) => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    animateCart();
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
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
    setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);



  const handleSearchChange = (text: string) => {
  setSearch(text);
  if (text.length > 1) {
    // Suggestions locales (sur les produits déjà chargés)
    const suggestions = products
      .map(p => p.name)
      .filter(name => name.toLowerCase().includes(text.toLowerCase()))
      .slice(0, 5); // Limite à 5 suggestions
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

  // Mappage des statuts de commande pour l'affichage
  const orderStatusMap = {
    pending: { label: 'En attente', color: '#FFA500', icon: 'clock' as const },
    shipped: { label: 'Expédiée', color: '#3498db', icon: 'truck' as const },
    delivered: { label: 'Livrée', color: '#2ecc71', icon: 'check-circle' as const },
    cancelled: { label: 'Annulée', color: '#e74c3c', icon: 'x-circle' as const },
  };

  // Fonction de rendu d'un produit dans la grille
  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.card} onPress={() => openProductDetails(item)} activeOpacity={0.8} >
      <View style={styles.cardImageContainer}>
        {item.images && item.images.length > 0 ? (
          <OptimizedImage source={{ uri: item.images[0] }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imageLoadingContainer]} >
            <Feather name="image" size={40} color="#ccc" />
          </View>
        )}
        <TouchableOpacity style={styles.addToCartBtn} onPress={(e) => { e.stopPropagation(); addToCart(item); }} >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.favoriteBtn} onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} >
          <Ionicons name={favorites.includes(item.id) ? "heart" : "heart-outline"} size={24} color={favorites.includes(item.id) ? "#FF6F61" : "#fff"} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.star && (
            <View style={styles.starRating}>
              <AntDesign name="star" size={14} color="#FFD700" />
              <Text style={styles.starText}>{item.star.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.productPrice}>{item.price.toLocaleString()} CDF</Text>
        <View style={styles.sellerInfo}>
          {item.sellerPhotoUrl ? (
            <Image source={{ uri: item.sellerPhotoUrl }} style={styles.sellerAvatar} />
          ) : (
            <View style={styles.sellerAvatarPlaceholder}>
              <Ionicons name="person" size={12} color="#888" />
            </View>
          )}
          <Text style={styles.sellerNameText} numberOfLines={1}>{item.sellerName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {showOnboarding && (
        <View style={styles.onboardingContainer}>
          <FlatList
            ref={flatListRef}
            data={onboardingSlides}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <OnboardingItem item={item} />}
            onScroll={handleOnboardingScroll}
            onViewableItemsChanged={handleOnboardingViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
          <View style={styles.onboardingPagination}>
            {onboardingSlides.map((_, index) => {
              const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [10, 25, 10],
                extrapolate: 'clamp'
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.5, 1, 0.5],
                extrapolate: 'clamp'
              });
              return (
                <Animated.View
                  key={index.toString()}
                  style={[styles.onboardingDot, { width: dotWidth, opacity: dotOpacity }]}
                />
              );
            })}
          </View>
          <TouchableOpacity style={styles.onboardingBtn} onPress={goToNextSlide}>
            <Text style={styles.onboardingBtnText}>{currentSlideIndex === onboardingSlides.length - 1 ? 'Démarrer' : 'Suivant'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!showOnboarding && (
        <SafeAreaView style={styles.container}>
          <ScrollView
            style={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Header et SearchBar */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Bonjour, {authUser?.name || 'Visiteur'} !</Text>
                <Text style={styles.subGreeting}>Que cherchez-vous aujourd'hui ?</Text>
              </View>
              <View style={styles.headerIcons}>
                <TouchableOpacity style={styles.iconButton} onPress={() => setCartModalVisible(true)}>
                  <Animated.View style={{ transform: [{ scale: cartScale }] }}>
                    <Feather name="shopping-cart" size={24} color="#333" />
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
  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Laisse le temps de cliquer sur une suggestion
/>
{showSuggestions && searchSuggestions.length > 0 && (
  <View style={{
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 15,
    marginTop: -10,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  }}>
    {searchSuggestions.map((suggestion, idx) => (
      <TouchableOpacity
        key={idx}
        onPress={() => {
          setSearch(suggestion);
          setShowSuggestions(false);
        }}
        style={{ padding: 12, borderBottomWidth: idx < searchSuggestions.length - 1 ? 1 : 0, borderBottomColor: '#eee' }}
      >
        <Text style={{ color: '#333' }}>{suggestion}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
            </View>

            {/* Catégories de Produits */}
            <Text style={styles.sectionTitle}>Catégories</Text>
            <View style={styles.categoryContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {categories.map((cat, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.categoryBtn,
                      activeCategory === cat && styles.activeCategoryBtn
                    ]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryBtnText,
                      activeCategory === cat && styles.activeCategoryBtnText
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Bouton "Publier un produit" */}
            {isVerifiedSeller && (
              <TouchableOpacity
                style={styles.publishBtn}
                onPress={() => setModalVisible(true)}
              >
                <Feather name="upload" size={20} color="#fff" />
                <Text style={styles.publishBtnText}>Publier un Produit</Text>
              </TouchableOpacity>
            )}

            {/* Mes commandes et Tableau de bord vendeur */}
            <View style={styles.dashboardButtonsContainer}>
              <TouchableOpacity style={styles.dashboardButton} onPress={() => setMyOrdersModalVisible(true)}>
                <Feather name="list" size={20} color="#6C63FF" />
                <Text style={styles.dashboardButtonText}>Mes Commandes</Text>
              </TouchableOpacity>
              {isVerifiedSeller && (
                <TouchableOpacity style={styles.dashboardButton} onPress={() => setSellerDashboardModalVisible(true)}>
                  <Feather name="bar-chart-2" size={20} color="#6C63FF" />
                  <Text style={styles.dashboardButtonText}>Ventes</Text>
                </TouchableOpacity>
              )}
            </View>

   
   

            {/* Grille de Produits */}
            <Text style={styles.sectionTitle}>Produits Récents</Text>
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

          {/* Modale d'ajout de produit */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => {
              setModalVisible(!modalVisible);
              resetForm();
            }}
          >
            <View style={styles.modalOverlay}>
  <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
  <View style={styles.bottomSheetContainer}>
    <View style={styles.handleBar} />
    <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Ajouter un produit</Text>
        <TouchableOpacity onPress={() => setModalVisible(false)}>
          <AntDesign name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      <Text style={styles.inputLabel}>Nom du produit</Text>
      <TextInput placeholder="iPhone 13 Pro Max" value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.inputLabel}>Description</Text>
      <TextInput placeholder="Description détaillée..." value={description} onChangeText={setDescription} style={[styles.input, styles.multilineInput]} multiline />
      <Text style={styles.inputLabel}>Prix (CDF)</Text>
      <TextInput placeholder="500000" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
      <Text style={styles.inputLabel}>Catégorie</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {categories.filter(cat => cat !== 'Tous').map((cat) => (
          <TouchableOpacity key={cat} style={[styles.categoryBtn, category === cat && styles.activeCategoryBtn, { marginBottom: 10 }]} onPress={() => setCategory(cat)}>
            <Text style={[styles.categoryText, category === cat && styles.activeCategoryText]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.inputLabel}>Images (max 3)</Text>
      <View style={styles.imageButtonsContainer}>
        <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
          <Feather name="camera" size={20} color="#6C63FF" />
          <Text style={styles.imageButtonText}>Appareil photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Feather name="image" size={20} color="#6C63FF" />
          <Text style={styles.imageButtonText}>Galerie</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.imagePreviewContainer}>
        {images.map((img, i) => (
          <View key={i} style={styles.imagePreviewWrapper}>
            <Image source={{ uri: img }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImages(images.filter((_, index) => index !== i))}>
              <AntDesign name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 3 && (
          <TouchableOpacity style={styles.addImagePlaceholder} onPress={() => Alert.alert("Ajouter une image", "Choisissez la source", [{ text: "Appareil photo", onPress: takePhoto }, { text: "Galerie", onPress: pickImage }, { text: "Annuler", style: "cancel" }])}>
            <Feather name="plus" size={24} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>
      {loading && uploadProgress !== null && (
        <View>
          <Text style={styles.progressText}>Téléversement... {Math.round(uploadProgress)}%</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}
      <TouchableOpacity style={[styles.publishBtn, (loading) && { backgroundColor: '#ccc' }]} onPress={confirmAndPublish} disabled={loading}>
        {loading && uploadProgress === null ? (<Text style={styles.publishBtnText}>Finalisation...</Text>) : loading ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.publishBtnText}>Publier le produit</Text>)}
      </TouchableOpacity>
    </ScrollView>
  </View>
</View>
          </Modal>

          {/* Modale de détails du produit */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={detailModalVisible}
            onRequestClose={closeDetailModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.detailModalView}>
                <TouchableOpacity style={styles.closeBtn} onPress={closeDetailModal}>
                  <Ionicons name="close-circle-outline" size={30} color="#333" />
                </TouchableOpacity>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {selectedProduct && (
                    <>
                      <FlatList
                        data={selectedProduct.images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => (
                          <Image source={{ uri: item }} style={styles.detailImage} />
                        )}
                        onScroll={Animated.event(
                          [{ nativeEvent: { contentOffset: { x: productImagesScrollX } } }],
                          { useNativeDriver: false }
                        )}
                      />
                      <ImagePagination imagesCount={selectedProduct.images.length} scrollX={productImagesScrollX} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
                          {selectedProduct.star && (
                            <View style={styles.starRating}>
                              <AntDesign name="star" size={20} color="#FFD700" />
                              <Text style={styles.starTextLarge}>{selectedProduct.star.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.detailPrice}>{selectedProduct.price.toLocaleString()} CDF</Text>
                        <Text style={styles.detailDescription}>{selectedProduct.description}</Text>

                        {/* Infos du Vendeur */}
                        {sellerInfo && (
                          <View style={styles.sellerSection}>
                            <Text style={styles.sellerSectionTitle}>Informations sur le vendeur</Text>
                            <View style={styles.sellerRow}>
                              <View style={styles.sellerAvatarContainer}>
                                {sellerInfo.photoUrl ? (
                                  <Image source={{ uri: sellerInfo.photoUrl }} style={styles.sellerAvatarLarge} />
                                ) : (
                                  <View style={styles.sellerAvatarLargePlaceholder}>
                                    <Ionicons name="person" size={40} color="#888" />
                                  </View>
                                )}
                                {sellerInfo.isVerified && (
                                  <AntDesign name="checkcircle" size={20} color="#2ecc71" style={styles.verifiedIcon} />
                                )}
                              </View>
                              <View style={styles.sellerDetails}>
                                <Text style={styles.sellerNameLarge}>{sellerInfo.shopName || sellerInfo.name}</Text>
                                <Text style={styles.sellerEmail}>{sellerInfo.email}</Text>
                              </View>
                            </View>
                          
                            <TouchableOpacity style={styles.seeSellerProductsBtn} onPress={() => openSellerProductsModal(selectedProduct.sellerId, sellerInfo.shopName || sellerInfo.name || 'Vendeur Anonyme')}>
                              <Text style={styles.seeSellerProductsBtnText}>Voir tous les produits de ce vendeur</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </ScrollView>

                {/* Boutons d'action */}
                <View style={styles.detailFooter}>
                  <TouchableOpacity style={styles.addToCartDetailBtn} onPress={() => addToCart(selectedProduct)}>
                    <Text style={styles.addToCartDetailText}>Ajouter au panier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.favoriteBtn} onPress={() => toggleFavorite(selectedProduct?.id || '')}>
                    <Ionicons
                      name={favorites.includes(selectedProduct?.id || '') ? "heart" : "heart-outline"}
                      size={30}
                      color={favorites.includes(selectedProduct?.id || '') ? "#FF6F61" : "#888"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reviewBtn} onPress={() => setReviewModalVisible(true)}>
                    <Text style={styles.reviewBtnText}>Avis</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
                      <Image source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
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
                          <Image source={{ uri: item.images[0] }} style={styles.cartItemImage} />
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
if (!statusInfo) {
  // Statut inconnu → on affiche un défaut
  return (
    <View style={styles.orderCard}>
      <Text style={{ color: '#888' }}>Statut inconnu : {item.status}</Text>
    </View>
  );
}
                      return (
                        <View style={styles.orderCard}>
                          <View style={styles.orderHeader}>
                            <Text style={styles.orderCardTitle}>Commande #{item.id.slice(-6).toUpperCase()}</Text>
                            <View style={styles.statusBadge}>
                              <Feather name={statusInfo.icon} size={16} color={statusInfo.color} />
                              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                {statusInfo.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.orderCardDate}>
                            Date : {item.orderDate.toLocaleDateString()}
                          </Text>
                          <Text style={styles.orderCardItemsTitle}>Articles :</Text>
                          {item.items.map((cartItem: any, index: number) => (
                            <View key={index} style={styles.orderItem}>
                              <Image source={{ uri: cartItem.imageUrl }} style={styles.orderItemImage} />
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
                          <Image source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
                          <View style={styles.sellerProductDetails}>
                            <Text style={styles.sellerProductName}>{item.name}</Text>
                            <Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text>
                          </View>
                          {/* Ajoutez des boutons d'édition/suppression ici */}
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
      )}
    </>
  );
}




const styles = StyleSheet.create({
  // Styles existants
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6F61',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
  },
  categoryContainer: {
    marginBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 15,
  },
  categoryBtn: {
    backgroundColor: '#eee',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  activeCategoryBtn: {
    backgroundColor: '#6C63FF',
  },
  categoryBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  activeCategoryBtnText: {
    color: '#fff',
  },
  dashboardButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 15,
    marginBottom: 15,
  },
  dashboardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dashboardButtonText: {
    marginLeft: 10,
    fontWeight: '600',
    color: '#6C63FF',
  },
  publishBtn: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
    marginBottom: 15,
  },
  publishBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0'
  },
  imageLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#6C63FF',
    borderRadius: 20,
    padding: 8,
  },
  favoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 5,
  },
  cardInfo: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 5,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  sellerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
  },
  sellerAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  sellerNameText: {
    fontSize: 12,
    color: '#888',
    flexShrink: 1,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  noProductsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  noProductsText: {
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  endOfListText: {
    textAlign: 'center',
    color: '#888',
    padding: 20,
  },
  // Styles pour les modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  inputArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
borderRadius: 10,
padding: 15,
fontSize: 16,
color: '#333',
height: 100,
textAlignVertical: 'top',
},
pickerContainer: {
backgroundColor: '#fff',
borderWidth: 1,
borderColor: '#ddd',
borderRadius: 10,
overflow: 'hidden',
},
picker: {
height: 50,
width: '100%',
},
imagePickerContainer: {
flexDirection: 'row',
flexWrap: 'wrap',
marginTop: 10,
marginBottom: 20,
},
thumbnailContainer: {
position: 'relative',
marginRight: 10,
marginBottom: 10,
},
thumbnail: {
width: 80,
height: 80,
borderRadius: 10,
},
removeImageBtn: {
position: 'absolute',
top: -5,
right: -5,
backgroundColor: '#fff',
borderRadius: 15,
},
imagePlaceholder: {
width: 80,
height: 80,
backgroundColor: '#eee',
borderRadius: 10,
justifyContent: 'center',
alignItems: 'center',
},
imagePlaceholderText: {
fontSize: 10,
color: '#888',
textAlign: 'center',
marginTop: 5,
},
progressBarContainer: {
height: 10,
backgroundColor: '#e0e0e0',
borderRadius: 5,
marginVertical: 10,
overflow: 'hidden',
},
progressBar: {
height: '100%',
backgroundColor: '#6C63FF',
},
uploadCompleteText: {
textAlign: 'center',
color: '#6C63FF',
fontWeight: 'bold',
marginTop: 10,
},
// Styles pour les promos
promoCard: {
width: width - 30,
height: 150,
borderRadius: 15,
marginHorizontal: 15,
overflow: 'hidden',
marginBottom: 15,
},
promoImage: {
width: '100%',
height: '100%',
resizeMode: 'cover',
},
promoOverlay: {
...StyleSheet.absoluteFillObject,
backgroundColor: 'rgba(0,0,0,0.4)',
justifyContent: 'center',
padding: 20,
},
promoTitle: {
fontSize: 24,
fontWeight: 'bold',
color: '#fff',
},
promoSubtitle: {
fontSize: 16,
color: '#fff',
marginTop: 5,
},
// Styles de la modale de détails
detailModalView: {
backgroundColor: '#f8f8f8',
borderRadius: 20,
width: '100%',
height: '100%',
maxHeight: '100%',
},
closeBtn: {
position: 'absolute',
top: 10,
right: 10,
zIndex: 1,
},
detailImage: {
width: width,
height: width,
},
imagePaginationContainer: {
flexDirection: 'row',
justifyContent: 'center',
alignItems: 'center',
marginTop: 10,
},
imageDot: {
height: 8,
borderRadius: 4,
backgroundColor: '#6C63FF',
marginHorizontal: 4,
},
detailContent: {
padding: 20,
},
detailHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
},
detailTitle: {
fontSize: 24,
fontWeight: 'bold',
flex: 1,
},
detailPrice: {
fontSize: 22,
fontWeight: 'bold',
color: '#6C63FF',
marginTop: 10,
},
detailDescription: {
fontSize: 16,
color: '#555',
marginTop: 15,
lineHeight: 24,
},
detailFooter: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
padding: 15,
borderTopWidth: 1,
borderTopColor: '#eee',
backgroundColor: '#fff',
},
addToCartDetailBtn: {
backgroundColor: '#6C63FF',
padding: 15,
borderRadius: 10,
flex: 1,
marginRight: 10,
alignItems: 'center',
},
addToCartDetailText: {
color: '#fff',
fontWeight: 'bold',
fontSize: 16,
},
reviewBtn: {
backgroundColor: '#eee',
padding: 15,
borderRadius: 10,
alignItems: 'center',
marginLeft: 10,
},
reviewBtnText: {
fontWeight: 'bold',
fontSize: 16,
},
sellerSection: {
marginTop: 20,
padding: 15,
backgroundColor: '#f0f0f0',
borderRadius: 10,
},
sellerSectionTitle: {
fontSize: 18,
fontWeight: 'bold',
color: '#333',
marginBottom: 10,
},
sellerRow: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 10,
},
sellerAvatarContainer: {
position: 'relative',
},
sellerAvatarLarge: {
width: 60,
height: 60,
borderRadius: 30,
},
sellerAvatarLargePlaceholder: {
width: 60,
height: 60,
borderRadius: 30,
backgroundColor: '#ddd',
justifyContent: 'center',
alignItems: 'center',
},
verifiedIcon: {
position: 'absolute',
bottom: 0,
right: 0,
},
sellerDetails: {
marginLeft: 15,
},
sellerNameLarge: {
fontSize: 18,
fontWeight: 'bold',
},
sellerEmail: {
fontSize: 14,
color: '#777',
},
chatBtn: {
flexDirection: 'row',
backgroundColor: '#2ecc71',
padding: 12,
borderRadius: 10,
alignItems: 'center',
justifyContent: 'center',
},
chatBtnText: {
color: '#fff',
fontWeight: 'bold',
marginLeft: 10,
},
seeSellerProductsBtn: {
marginTop: 10,
padding: 12,
backgroundColor: '#e9e9e9',
borderRadius: 10,
alignItems: 'center',
},
seeSellerProductsBtnText: {
color: '#6C63FF',
fontWeight: 'bold',
},
// Styles pour les commandes
orderCard: {
backgroundColor: '#fff',
borderRadius: 15,
marginHorizontal: 15,
marginVertical: 8,
padding: 15,
elevation: 1,
},
orderHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: 10,
},
orderCardTitle: {
fontSize: 18,
fontWeight: 'bold',
color: '#333',
},
orderCardDate: {
fontSize: 14,
color: '#777',
marginBottom: 10,
},
statusBadge: {
flexDirection: 'row',
alignItems: 'center',
backgroundColor: '#eee',
paddingVertical: 5,
paddingHorizontal: 10,
borderRadius: 20,
},
statusText: {
marginLeft: 5,
fontWeight: 'bold',
},
orderCardItemsTitle: {
fontSize: 16,
fontWeight: 'bold',
color: '#333',
marginTop: 10,
marginBottom: 8,
},
orderItem: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 10,
backgroundColor: '#f9f9f9',
borderRadius: 10,
padding: 8,
},
orderItemImage: {
width: 50,
height: 50,
borderRadius: 8,
marginRight: 10,
backgroundColor: '#f0f0f0',
},
orderItemDetails: {
flex: 1,
},
orderItemName: {
fontSize: 15,
fontWeight: '500',
color: '#333',
marginBottom: 4,
},
orderItemQuantity: {
fontSize: 14,
color: '#666',
marginBottom: 4,
},
orderItemPrice: {
fontSize: 14,
fontWeight: 'bold',
color: '#6C63FF',
},
orderTotalContainer: {
borderTopWidth: 1,
borderTopColor: '#eee',
paddingTop: 10,
marginTop: 10,
alignItems: 'flex-end',
},
orderTotalText: {
fontSize: 18,
fontWeight: 'bold',
color: '#6C63FF',
},
// Styles pour la modale du panier
cartSection: {
marginBottom: 20,
padding: 10,
backgroundColor: '#fff',
borderRadius: 10,
shadowColor: '#000',
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.1,
shadowRadius: 1,
elevation: 2,
},
sellerHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: 10,
},
checkoutBtn: {
backgroundColor: '#2ecc71',
paddingVertical: 8,
paddingHorizontal: 15,
borderRadius: 20,
},
checkoutBtnText: {
color: '#fff',
fontWeight: 'bold',
},
cartItem: {
flexDirection: 'row',
alignItems: 'center',
paddingVertical: 10,
borderBottomWidth: 1,
borderBottomColor: '#eee',
},
cartItemImage: {
width: 60,
height: 60,
borderRadius: 10,
marginRight: 15,
},
cartItemDetails: {
flex: 1,
},
cartItemName: {
fontSize: 16,
fontWeight: 'bold',
},
cartItemPrice: {
fontSize: 14,
color: '#6C63FF',
},
cartItemControls: {
flexDirection: 'row',
alignItems: 'center',
},
cartItemQuantity: {
fontSize: 16,
marginHorizontal: 10,
},
cartFooter: {
borderTopWidth: 1,
borderTopColor: '#eee',
paddingTop: 10,
marginTop: 10,
alignItems: 'flex-end',
},
cartTotalText: {
fontSize: 20,
fontWeight: 'bold',
color: '#6C63FF',
},
// Styles Onboarding
onboardingContainer: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
backgroundColor: '#f5f5f5',
},
onboardingSlide: {
justifyContent: 'center',
alignItems: 'center',
padding: 20,
},
onboardingImage: {
width: width * 0.8,
height: width * 0.8,
resizeMode: 'contain',
},
onboardingContent: {
marginTop: 30,
alignItems: 'center',
},
onboardingTitle: {
fontSize: 28,
fontWeight: 'bold',
color: '#fff',
textAlign: 'center',
},
onboardingDescription: {
fontSize: 16,
color: '#fff',
textAlign: 'center',
marginTop: 10,
},
onboardingPagination: {
flexDirection: 'row',
position: 'absolute',
bottom: 150,
},
onboardingDot: {
height: 10,
borderRadius: 5,
backgroundColor: '#fff',
marginHorizontal: 5,
},
onboardingBtn: {
backgroundColor: '#fff',
paddingVertical: 15,
paddingHorizontal: 40,
borderRadius: 30,
position: 'absolute',
bottom: 50,
},
onboardingBtnText: {
fontSize: 18,
fontWeight: 'bold',
color: '#6C63FF',
},
// Styles pour les squelettes de chargement
skeletonCard: {
width: '47%',
backgroundColor: '#fff',
borderRadius: 15,
marginBottom: 15,
overflow: 'hidden',
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 4,
elevation: 3,
},
skeletonImage: {
width: '100%',
aspectRatio: 1,
backgroundColor: '#e0e0e0',
},
skeletonTextLarge: {
width: '80%',
height: 15,
backgroundColor: '#e0e0e0',
borderRadius: 4,
marginTop: 10,
marginLeft: 10,
},
skeletonTextSmall: {
width: '50%',
height: 12,
backgroundColor: '#e0e0e0',
borderRadius: 4,
marginTop: 5,
marginLeft: 10,
marginBottom: 10,
},
// Styles pour les produits du vendeur
sellerProductItem: {
flexDirection: 'row',
alignItems: 'center',
backgroundColor: '#fff',
borderRadius: 10,
padding: 10,
marginBottom: 10,
shadowColor: '#000',
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.1,
shadowRadius: 2,
elevation: 1,
},
sellerProductImage: {
width: 70,
height: 70,
borderRadius: 8,
marginRight: 15,
},
sellerProductDetails: {
flex: 1,
},
sellerProductName: {
fontSize: 16,
fontWeight: 'bold',
},
sellerProductPrice: {
fontSize: 14,
color: '#6C63FF',
marginTop: 5,
},
// Style pour le titre du tableau de bord vendeur
dashboardSectionTitle: {
fontSize: 20,
fontWeight: 'bold',
color: '#333',
marginVertical: 15,
textAlign: 'center',
},
// Styles pour l'avis
reviewContent: {
padding: 10,
},
reviewProductTitle: {
fontSize: 20,
fontWeight: 'bold',
textAlign: 'center',
marginBottom: 10,
},
ratingContainer: {
flexDirection: 'row',
justifyContent: 'center',
marginVertical: 20,
},
submitReviewBtn: {
backgroundColor: '#6C63FF',
padding: 15,
borderRadius: 10,
alignItems: 'center',
marginTop: 20,
},
submitReviewBtnText: {
color: '#fff',
fontWeight: 'bold',
fontSize: 16,
},
starTextLarge: {
fontSize: 18,
color: '#333',
marginLeft: 6,
fontWeight: 'bold',
},
// Styles pour le formulaire de publication de produit
bottomSheetContainer: {
backgroundColor: '#fff',
borderTopLeftRadius: 20,
borderTopRightRadius: 20,
paddingHorizontal: 20,
paddingBottom: Platform.OS === 'android' ? 20 : 0,
maxHeight: '90%',
elevation: 10,
},
handleBar: {
width: 40,
height: 5,
backgroundColor: '#e0e0e0',
borderRadius: 2.5,
alignSelf: 'center',
marginVertical: 10,
},
modalContent: {
paddingTop: 10,
paddingBottom: 30,
},
multilineInput: {
height: 100,
textAlignVertical: 'top',
paddingVertical: 10,
},
categoryText: {
color: '#333',
fontWeight: '500',
},
activeCategoryText: {
color: '#fff',
},
imageButtonsContainer: {
flexDirection: 'row',
justifyContent: 'space-around',
marginBottom: 20,
},
imageButton: {
flexDirection: 'row',
alignItems: 'center',
backgroundColor: '#eef',
paddingVertical: 12,
paddingHorizontal: 20,
borderRadius: 10,
gap: 10,
},
imageButtonText: {
color: '#6C63FF',
fontWeight: 'bold',
fontSize: 16,
},
imagePreviewContainer: {
flexDirection: 'row',
flexWrap: 'wrap',
gap: 10,
marginBottom: 20,
},
imagePreviewWrapper: {
position: 'relative',
width: 100,
height: 100,
borderRadius: 10,
overflow: 'hidden',
borderWidth: 1,
borderColor: '#eee',
},
imagePreview: {
width: '100%',
height: '100%',
},
progressText: {
textAlign: 'center',
color: '#555',
fontWeight: '500',
marginBottom: 5,
},
addImagePlaceholder: {
  width: 100,
height: 100,
backgroundColor: '#eee',
borderRadius: 10,
justifyContent: 'center',
alignItems: 'center',},
},


)