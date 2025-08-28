import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated, Dimensions,
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
    title: 'Bienvenue sur Mon Appli !',
    description: 'Découvrez des produits uniques, connectez-vous avec les vendeurs locaux et simplifiez vos achats.',
    image: require('@/assets/images/icon.png'),
    backgroundColor: '#6C63FF',
  },
  {
    id: '2',
    title: 'Explorez nos Catégories',
    description: 'Parcourez facilement des milliers de produits organisés par catégories pour trouver ce que vous aimez.',
    image: require('@/assets/images/icon.png'),
    backgroundColor: '#FF6F61',
  },
  {
    id: '3',
    title: 'Paiement Sécurisé & Rapide',
    description: 'Achetez en toute confiance avec nos options de paiement sécurisées et un processus de commande simplifié.',
    image: require('@/assets/images/icon.png'),
    backgroundColor: '#4CAF50',
  },
  {
    id: '4',
    title: 'Commencez Votre Aventure',
    description: 'Prêt à découvrir ? Lancez-vous et explorez un monde de possibilités !',
    image: require('@/assets/images/icon.png'),
    backgroundColor: '#2196F3',
  },
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
        q = query(productsQuery, where('name', '>=', search), where('name', '<=', search + '\uf8ff'), orderBy('name'), limit(10));
      } else if (activeCategory !== 'Tous') {
        q = query(productsQuery, where('category', '==', activeCategory), orderBy('createdAt', 'desc'), limit(10));
      } else {
        q = query(productsQuery, orderBy('createdAt', 'desc'), limit(10));
      }

      if (!isRefreshing && lastVisible) {
        q = query(q, startAfter(lastVisible));
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
  }, []);

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
  }, [search, activeCategory]);

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
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
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
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

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
    <TouchableOpacity
      style={styles.card}
      onPress={() => openProductDetails(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardImageContainer}>
        {item.images && item.images.length > 0 ? (
          <OptimizedImage source={{ uri: item.images[0] }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imageLoadingContainer]} >
            <Feather name="image" size={40} color="#ccc" />
          </View>
        )}
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={(e) => { e.stopPropagation(); addToCart(item); }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
        >
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
              const dotWidth = scrollX.interpolate({ inputRange, outputRange: [10, 25, 10], extrapolate: 'clamp' });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
              return (<Animated.View key={index.toString()} style={[styles.onboardingDot, { width: dotWidth, opacity: dotOpacity }]} />);
            })}
          </View>
          <View style={styles.onboardingButtonsContainer}>
            {currentSlideIndex < onboardingSlides.length - 1 ? (
              <>
                <TouchableOpacity style={styles.onboardingSkipButton} onPress={skipOnboarding}><Text style={styles.onboardingSkipButtonText}>Passer</Text></TouchableOpacity>
                <TouchableOpacity style={styles.onboardingNextButton} onPress={goToNextSlide}><Text style={styles.onboardingNextButtonText}>Suivant</Text></TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.onboardingGetStartedButton} onPress={skipOnboarding}><Text style={styles.onboardingGetStartedButtonText}>Commencer</Text></TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setMyOrdersModalVisible(true)}>
            <Feather name="package" size={26} color="#333" />
          </TouchableOpacity>

          {isVerifiedSeller && (
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity style={styles.headerIcon} onPress={() => setSellerDashboardModalVisible(true)}>
                <Feather name="briefcase" size={26} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={() => setModalVisible(true)}>
                <Feather name="plus-circle" size={26} color="#6C63FF" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => setCartModalVisible(true)} style={styles.headerIcon}>
            <Animated.View style={{ transform: [{ scale: cartScale }] }}>
              <Feather name="shopping-bag" size={24} color="#333" />
            </Animated.View>
            {cart.length > 0 && (
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.length}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {initialLoading ? (
          <FlatList
            ListHeaderComponent={
              <>
                <View style={styles.titleContainer}><Text style={styles.title}>Bonjour,</Text><Text style={styles.subtitle}>Qu'allez-vous acheter aujourd'hui ?</Text></View>
                <View style={styles.searchContainer}><Feather name="search" size={22} color="#999" style={styles.searchIcon} /><TextInput placeholder="Rechercher un produit..." value={search} onChangeText={setSearch} style={styles.searchInput} /></View>
                <View><Text style={styles.sectionTitle}>Tous les produits</Text></View>
              </>
            }
            data={Array.from({ length: 6 })}
            keyExtractor={(_, index) => `skeleton-${index}`}
            renderItem={() => <SkeletonCard />}
            numColumns={2}
            contentContainerStyle={styles.productsGrid}
          />
        ) : (
          <FlatList
            ListHeaderComponent={
              <>
                <View style={styles.titleContainer}><Text style={styles.title}>Bonjour,</Text><Text style={styles.subtitle}>Qu'allez-vous acheter aujourd'hui ?</Text></View>
                <View style={styles.searchContainer}><Feather name="search" size={22} color="#999" style={styles.searchIcon} /><TextInput placeholder="Rechercher un produit..." value={search} onChangeText={setSearch} style={styles.searchInput} /></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat} style={[styles.categoryBtn, activeCategory === cat && styles.activeCategoryBtn]} onPress={() => setActiveCategory(cat)}>
                      <Text style={[styles.categoryText, activeCategory === cat && styles.activeCategoryText]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.sectionTitle}>Tous les produits</Text>
              </>
            }
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={2}
            contentContainerStyle={styles.productsGrid}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C63FF']} />}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="large" color="#6C63FF" style={{ marginVertical: 20 }} /> : null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="package" size={40} color="#999" />
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
                <Text style={styles.emptySubtext}>Essayez de changer de catégorie ou de recherche.</Text>
              </View>
            }
          />
        )}

        {/* Modale d'ajout de produit */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
            <View style={styles.bottomSheetContainer}>
              <View style={styles.handleBar} />
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}><Text style={styles.modalTitle}>Ajouter un produit</Text><TouchableOpacity onPress={() => setModalVisible(false)}><AntDesign name="close" size={24} color="#666" /></TouchableOpacity></View>
                <Text style={styles.inputLabel}>Nom du produit</Text><TextInput placeholder="iPhone 13 Pro Max" value={name} onChangeText={setName} style={styles.input} />
                <Text style={styles.inputLabel}>Description</Text><TextInput placeholder="Description détaillée..." value={description} onChangeText={setDescription} style={[styles.input, styles.multilineInput]} multiline />
                <Text style={styles.inputLabel}>Prix (CDF)</Text><TextInput placeholder="500000" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
                <Text style={styles.inputLabel}>Catégorie</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  {categories.filter(cat => cat !== 'Tous').map((cat) => (
                    <TouchableOpacity key={cat} style={[styles.categoryBtn, category === cat && styles.activeCategoryBtn, { marginBottom: 10 }]} onPress={() => setCategory(cat)}>
                      <Text style={[styles.categoryText, category === cat && styles.activeCategoryText]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Images (max 3)</Text>
                <View style={styles.imageButtonsContainer}><TouchableOpacity style={styles.imageButton} onPress={takePhoto}><Feather name="camera" size={20} color="#6C63FF" /><Text style={styles.imageButtonText}>Appareil photo</Text></TouchableOpacity><TouchableOpacity style={styles.imageButton} onPress={pickImage}><Feather name="image" size={20} color="#6C63FF" /><Text style={styles.imageButtonText}>Galerie</Text></TouchableOpacity></View>
                <View style={styles.imagePreviewContainer}>
                  {images.map((img, i) => (
                    <View key={i} style={styles.imagePreviewWrapper}><Image source={{ uri: img }} style={styles.imagePreview} /><TouchableOpacity style={styles.removeImageBtn} onPress={() => setImages(images.filter((_, index) => index !== i))}><AntDesign name="close" size={14} color="#fff" /></TouchableOpacity></View>
                  ))}
                  {images.length < 3 && (
                    <TouchableOpacity style={styles.addImagePlaceholder} onPress={() => Alert.alert("Ajouter une image", "Choisissez la source", [{ text: "Appareil photo", onPress: takePhoto }, { text: "Galerie", onPress: pickImage }, { text: "Annuler", style: "cancel" }])}><Feather name="plus" size={24} color="#ccc" /></TouchableOpacity>
                  )}
                </View>

                {loading && uploadProgress !== null && (
                  <View>
                    <Text style={styles.progressText}>Téléversement... {Math.round(uploadProgress)}%</Text>
                    <View style={styles.progressBarContainer}><View style={[styles.progressBar, { width: `${uploadProgress}%` }]} /></View>
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
        <Modal animationType="slide" transparent={true} visible={detailModalVisible} onRequestClose={closeDetailModal}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeDetailModal} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '90%' }]}>
              <View style={styles.handleBar} />
              {selectedProduct ? (
                <>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {selectedProduct.images && selectedProduct.images.length > 0 && (
                      <View>
                        <FlatList data={selectedProduct.images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => (<OptimizedImage source={{ uri: item }} style={styles.detailModalImageCarousel} />)} onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: productImagesScrollX } } }], { useNativeDriver: false })} scrollEventThrottle={16} />
                        <ImagePagination imagesCount={selectedProduct.images.length} scrollX={productImagesScrollX} />
                      </View>
                    )}
                    <View style={styles.detailModalInfo}>
                      <Text style={styles.detailModalCategory}>{selectedProduct.category || "Non spécifiée"}</Text>
                      <Text style={styles.detailModalName}>{selectedProduct.name}</Text>
                      <Text style={styles.detailModalPrice}>{selectedProduct.price.toLocaleString()} CDF</Text>
                      <Text style={styles.sectionTitle}>Description</Text>
                      <Text style={styles.detailModalDescription}>{selectedProduct.description}</Text>
                      <Text style={styles.sectionTitle}>Vendu par</Text>
                      {sellerInfo ? (
                        <TouchableOpacity onPress={startChatWithSeller} style={styles.sellerInfoCard} activeOpacity={0.7}>
                          <View style={styles.sellerImageContainer}>{sellerInfo.photoUrl ? (<Image source={{ uri: sellerInfo.photoUrl }} style={styles.sellerPhoto} />) : (<View style={styles.sellerPhotoPlaceholder}><Ionicons name="person-circle-outline" size={40} color="#888" /></View>)}</View>
                          <View style={styles.sellerDetails}><Text style={styles.sellerName} numberOfLines={1}>{sellerInfo.name || sellerInfo.email}</Text>{sellerInfo.shopName && (<Text style={styles.sellerShopName} numberOfLines={1}>{sellerInfo.shopName}</Text>)}</View>
                          <View style={styles.sellerAction}><Feather name="message-circle" size={24} color="#6C63FF" /></View>
                        </TouchableOpacity>
                      ) : (<View style={styles.sellerLoading}><ActivityIndicator size="small" color="#6C63FF" /><Text style={styles.sellerLoadingText}>Chargement du vendeur...</Text></View>)}
                      <TouchableOpacity style={styles.reviewButton} onPress={() => setReviewModalVisible(true)}><AntDesign name="staro" size={20} color="#fff" /><Text style={styles.reviewButtonText}>Laisser un avis</Text></TouchableOpacity>
                    </View>
                  </ScrollView>
                  <View style={styles.detailFooter}>
                    <TouchableOpacity style={styles.detailAddToCartButton} onPress={() => { addToCart(selectedProduct); closeDetailModal(); }}><Ionicons name="cart-outline" size={24} color="#fff" /><Text style={styles.detailAddToCartButtonText}>Ajouter au panier</Text></TouchableOpacity>
                  </View>
                </>
              ) : (<View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#6C63FF" /></View>)}
            </View>
          </View>
        </Modal>

        {/* Modale Panier */}
        <Modal visible={cartModalVisible} animationType="slide" transparent onRequestClose={() => setCartModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCartModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '85%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.cartModalHeader}><Text style={styles.modalTitle}>Mon Panier</Text><TouchableOpacity onPress={() => setCartModalVisible(false)}><AntDesign name="close" size={24} color="#666" /></TouchableOpacity></View>
              {cart.length === 0 ? (
                <View style={styles.emptyCartContainer}><Feather name="shopping-bag" size={60} color="#e0e0e0" /><Text style={styles.emptyCartText}>Votre panier est vide</Text><Text style={styles.emptyCartSubtext}>Parcourez nos produits !</Text><TouchableOpacity style={styles.continueShoppingBtn} onPress={() => setCartModalVisible(false)}><Text style={styles.continueShoppingText}>Continuer les achats</Text></TouchableOpacity></View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                  {Object.entries(groupCartBySeller()).map(([sellerId, sellerItems]) => (
                    <View key={sellerId} style={styles.sellerCartGroup}>
                      <Text style={styles.sellerGroupTitle}>Vendeur : {sellerItems[0]?.sellerName || 'Inconnu'}</Text>
                      {sellerItems.map((item) => (
                        <View key={item.id} style={styles.cartItem}><OptimizedImage source={{ uri: item.images[0] }} style={styles.cartItemImage} /><View style={styles.cartItemDetails}><Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text><Text style={styles.cartItemPrice}>{item.price.toLocaleString()} CDF</Text></View><View style={styles.quantityControls}><TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={styles.quantityBtn}><Feather name="minus" size={16} color="#6C63FF" /></TouchableOpacity><Text style={styles.quantityText}>{item.quantity}</Text><TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.quantityBtn}><Feather name="plus" size={16} color="#6C63FF" /></TouchableOpacity></View></View>
                      ))}
                      <View style={styles.sellerTotalContainer}><Text style={styles.sellerTotalText}>Total pour ce vendeur</Text><Text style={styles.sellerTotalAmount}>{sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()} CDF</Text></View>
                      <TouchableOpacity style={styles.checkoutBtn} onPress={() => placeOrder(sellerId, sellerItems, sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0))} disabled={loadingOrder === sellerId}>
                        {loadingOrder === sellerId ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.checkoutBtnText}>Commander</Text>)}
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              {cart.length > 0 && (
                <View style={styles.cartFooter}><View style={styles.cartTotalRow}><Text style={styles.cartTotalText}>Total général</Text><Text style={styles.cartTotalAmount}>{cartTotal.toLocaleString()} CDF</Text></View><TouchableOpacity style={styles.clearCartBtn} onPress={() => Alert.alert("Vider le panier", "Êtes-vous sûr ?", [{ text: "Annuler", style: "cancel" }, { text: "Oui", onPress: () => setCart([]) }])}><Text style={styles.clearCartText}>Vider le panier</Text></TouchableOpacity></View>
              )}
            </View>
          </View>
        </Modal>

        {/* Modale Laisser un avis */}
        <Modal animationType="slide" transparent={true} visible={reviewModalVisible} onRequestClose={() => setReviewModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setReviewModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '60%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Laisser un avis</Text><TouchableOpacity onPress={() => setReviewModalVisible(false)}><AntDesign name="close" size={24} color="#666" /></TouchableOpacity></View>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setCurrentRating(star)}><AntDesign name={star <= currentRating ? "star" : "staro"} size={30} color="#FFD700" style={{ marginHorizontal: 5 }} /></TouchableOpacity>
                ))}
              </View>
              <TextInput placeholder="Votre commentaire (facultatif)" value={reviewComment} onChangeText={setReviewComment} style={[styles.input, styles.multilineInput]} multiline />
              <TouchableOpacity style={styles.publishBtn} onPress={submitReview}><Text style={styles.publishBtnText}>Soumettre l'avis</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modale Mes Commandes */}
        <Modal animationType="slide" transparent={true} visible={myOrdersModalVisible} onRequestClose={() => setMyOrdersModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMyOrdersModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '90%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mes Commandes</Text>
                <TouchableOpacity onPress={() => setMyOrdersModalVisible(false)}>
                  <AntDesign name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              {loadingOrders ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#6C63FF" />
                  <Text style={styles.loadingText}>Chargement de vos commandes...</Text>
                </View>
              ) : myOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="clipboard" size={60} color="#e0e0e0" />
                  <Text style={styles.emptyText}>Aucune commande passée</Text>
                  <Text style={styles.emptySubtext}>Vos commandes apparaîtront ici.</Text>
                </View>
              ) : (
                <FlatList
                  data={myOrders}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item: order }) => {
                    const statusInfo = orderStatusMap[order.status as keyof typeof orderStatusMap] || { label: order.status, color: '#888', icon: 'help-circle' as const };
                    return (
                      <View style={styles.orderCard}>
                        <View style={styles.orderHeader}>
                          <Text style={styles.orderCardTitle}>Commande #{order.id.substring(0, 8)}</Text>
                          <View style={[styles.orderStatusContainer, { backgroundColor: `${statusInfo.color}20` }]}>
                            <Feather name={statusInfo.icon} size={16} color={statusInfo.color} />
                            <Text style={[styles.orderCardStatus, { color: statusInfo.color }]}>
                              {statusInfo.label}
                            </Text>
                          </View>
                        </View>
                        
                        <Text style={styles.orderCardDate}>
                          Passée le {new Date(order.orderDate).toLocaleDateString('fr-FR')}
                        </Text>
                        
                        <Text style={styles.orderCardItemsTitle}>Articles:</Text>
                        {order.items.map((item: any, index: number) => (
                          <View key={index} style={styles.orderItem}>
                            <OptimizedImage 
                              source={{ uri: item.imageUrl }} 
                              style={styles.orderItemImage} 
                            />
                            <View style={styles.orderItemDetails}>
                              <Text style={styles.orderItemName} numberOfLines={1}>{item.name}</Text>
                              <Text style={styles.orderItemQuantity}>Quantité: {item.quantity}</Text>
                              <Text style={styles.orderItemPrice}>{item.price.toLocaleString()} CDF</Text>
                            </View>
                          </View>
                        ))}
                        
                        <View style={styles.orderTotalContainer}>
                          <Text style={styles.orderCardTotal}>Total: {order.totalAmount.toLocaleString()} CDF</Text>
                        </View>
                      </View>
                    );
                  }}
                  contentContainerStyle={styles.ordersList}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Modale Tableau de bord du vendeur */}
        <Modal animationType="slide" transparent={true} visible={sellerDashboardModalVisible} onRequestClose={() => setSellerDashboardModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSellerDashboardModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '90%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Mon Magasin</Text><TouchableOpacity onPress={() => setSellerDashboardModalVisible(false)}><AntDesign name="close" size={24} color="#666" /></TouchableOpacity></View>

              <View style={styles.sellerStatsContainer}>
                <View style={styles.statBox}><Text style={styles.statValue}>{sellerProducts.length}</Text><Text style={styles.statLabel}>Produits Actifs</Text></View>
                <View style={styles.statBox}><Text style={styles.statValue}>0</Text><Text style={styles.statLabel}>Ventes ce mois</Text></View>
              </View>

              {sellerProducts.length === 0 ? (
                <View style={styles.emptyContainer}><Feather name="shopping-bag" size={60} color="#e0e0e0" /><Text style={styles.emptyText}>Aucun produit listé</Text><TouchableOpacity style={styles.continueShoppingBtn} onPress={() => { setSellerDashboardModalVisible(false); setModalVisible(true); }}><Text style={styles.continueShoppingText}>Ajouter un produit</Text></TouchableOpacity></View>
              ) : (
                <FlatList
                  data={sellerProducts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.sellerProductCard}><OptimizedImage source={{ uri: item.images[0] }} style={styles.sellerProductImage} /><View style={styles.sellerProductDetails}><Text style={styles.sellerProductName}>{item.name}</Text><Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text></View></View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

// --- FEUILLE DE STYLES COMPLÈTE ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, height: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerIcon: { padding: 8 },
  cartBadge: { position: 'absolute', right: 5, top: 5, backgroundColor: '#ff3b30', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  titleContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, marginHorizontal: 15, marginVertical: 15, paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 45, fontSize: 16, color: '#333' },
  categoriesContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  categoryBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 10 },
  activeCategoryBtn: { backgroundColor: '#6C63FF' },
  categoryText: { color: '#555', fontWeight: '500' },
  activeCategoryText: { color: '#fff' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 15, marginTop: 10, marginBottom: 10 },
  productsGrid: { paddingHorizontal: 10, paddingBottom: 20 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 15, margin: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, overflow: 'hidden', maxWidth: (width / 2) - 15 },
  cardImageContainer: { width: '100%', height: 150, position: 'relative', backgroundColor: '#f0f0f0' },
  cardImage: { width: '100%', height: '100%' },
  addToCartBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#6C63FF', borderRadius: 20, padding: 8, elevation: 5 },
  cardInfo: { padding: 10 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#6C63FF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 18, color: '#999', marginTop: 10, fontWeight: 'bold' },
  emptySubtext: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  bottomSheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: Platform.OS === 'android' ? 20 : 0, maxHeight: '90%', elevation: 10 },
  handleBar: { width: 40, height: 5, backgroundColor: '#e0e0e0', borderRadius: 2.5, alignSelf: 'center', marginVertical: 10 },
  modalContent: { paddingTop: 10, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  sellerProductCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, marginHorizontal: 15, marginVertical: 8, padding: 10, elevation: 1, alignItems: 'center' },
  sellerProductImage: { width: 80, height: 80, borderRadius: 10, marginRight: 15, backgroundColor: '#f0f0f0' },
  sellerProductDetails: { flex: 1 },
  sellerProductName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  sellerProductPrice: { fontSize: 15, color: '#6C63FF', fontWeight: 'bold' },
  skeletonImage: { width: '100%', height: 150, backgroundColor: '#e0e0e0' },
  skeletonTextLarge: { width: '80%', height: 20, backgroundColor: '#e0e0e0', borderRadius: 4, marginBottom: 8 },
  skeletonTextSmall: { width: '50%', height: 16, backgroundColor: '#e0e0e0', borderRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  productName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  starRating: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  starText: { marginLeft: 4, fontSize: 12, fontWeight: 'bold', color: '#E6A500' },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sellerAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
  sellerAvatarPlaceholder: { width: 20, height: 20, borderRadius: 10, marginRight: 6, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  sellerNameText: { fontSize: 12, color: '#777' },
  progressBarContainer: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, marginVertical: 5, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 4 },
  progressText: { textAlign: 'center', marginBottom: 5, color: '#555', fontWeight: '500' },
  orderStatusContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  orderCardStatus: { fontSize: 15, fontWeight: 'bold' },
  sellerStatsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#6C63FF' },
  statLabel: { fontSize: 14, color: '#666', marginTop: 4 },
  onboardingSlide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  onboardingImage: { width: width * 0.7, height: width * 0.7, resizeMode: 'contain', marginBottom: 30 },
  onboardingContent: { alignItems: 'center' },
  onboardingTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 10 },
  onboardingDescription: { fontSize: 16, color: '#f0f0f0', textAlign: 'center', lineHeight: 24 },
  imagePaginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, marginBottom: 15 },
  imageDot: { height: 8, borderRadius: 4, backgroundColor: '#6C63FF', marginHorizontal: 4 },
  imageLoadingContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  favoriteBtn: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 5, zIndex: 1 },
  onboardingContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#fff' },
  onboardingPagination: { position: 'absolute', bottom: height * 0.2, flexDirection: 'row', width: '100%', justifyContent: 'center', alignItems: 'center' },
  onboardingDot: { height: 10, borderRadius: 5, backgroundColor: '#ccc', marginHorizontal: 4 },
  onboardingButtonsContainer: { position: 'absolute', bottom: Platform.OS === 'android' ? 30 : 50, flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 20 },
  onboardingSkipButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)' },
  onboardingSkipButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  onboardingNextButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25, backgroundColor: '#fff' },
  onboardingNextButtonText: { color: '#6C63FF', fontSize: 16, fontWeight: 'bold' },
  onboardingGetStartedButton: { flex: 1, paddingVertical: 15, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center' },
  onboardingGetStartedButtonText: { color: '#6C63FF', fontSize: 18, fontWeight: 'bold' },
  inputLabel: { fontSize: 16, color: '#555', marginBottom: 8, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 15, height: 50, fontSize: 16, color: '#333', marginBottom: 15, backgroundColor: '#fdfdfd' },
  multilineInput: { height: 100, textAlignVertical: 'top', paddingVertical: 10 },
  imageButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  imageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, gap: 10 },
  imageButtonText: { color: '#6C63FF', fontWeight: 'bold', fontSize: 16 },
  imagePreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  imagePreviewWrapper: { position: 'relative', width: 100, height: 100, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  imagePreview: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: '#ff3b30', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  addImagePlaceholder: { width: 100, height: 100, backgroundColor: '#f0f0f0', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed' },
  publishBtn: { backgroundColor: '#6C63FF', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  publishBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  detailModalImageCarousel: { width: width - 40, height: 250, borderRadius: 10 },
  detailModalInfo: { paddingHorizontal: 10, paddingBottom: 20 },
  detailModalCategory: { fontSize: 14, color: '#6C63FF', fontWeight: 'bold', marginBottom: 5 },
  detailModalName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  detailModalPrice: { fontSize: 22, fontWeight: 'bold', color: '#6C63FF', marginBottom: 15 },
  detailModalDescription: { fontSize: 16, color: '#555', lineHeight: 24, marginBottom: 20 },
  sellerInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 10, padding: 15, marginTop: 10, borderWidth: 1, borderColor: '#eee' },
  sellerImageContainer: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', marginRight: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  sellerPhoto: { width: '100%', height: '100%' },
  sellerPhotoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  sellerDetails: { flex: 1 },
  sellerName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sellerShopName: { fontSize: 14, color: '#666', marginTop: 2 },
  sellerAction: { marginLeft: 10 },
  sellerLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sellerLoadingText: { marginLeft: 10, color: '#777' },
  reviewButton: { flexDirection: 'row', backgroundColor: '#6C63FF', paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 },
  reviewButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  detailFooter: { padding: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  detailAddToCartButton: { flexDirection: 'row', backgroundColor: '#6C63FF', paddingVertical: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 10 },
  detailAddToCartButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  cartModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  emptyCartContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyCartText: { fontSize: 20, fontWeight: 'bold', color: '#999', marginTop: 15 },
  emptyCartSubtext: { fontSize: 15, color: '#aaa', textAlign: 'center', marginTop: 5, marginBottom: 20 },
  continueShoppingBtn: { backgroundColor: '#6C63FF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 },
  continueShoppingText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sellerCartGroup: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 15, marginVertical: 10, paddingBottom: 15, elevation: 2, overflow: 'hidden' },
  sellerGroupTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#f9f9f9' },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, padding: 10, marginBottom: 10, elevation: 1, marginHorizontal: 15 },
  cartItemImage: { width: 70, height: 70, borderRadius: 10, marginRight: 10, backgroundColor: '#f0f0f0' },
  cartItemDetails: { flex: 1 },
  cartItemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cartItemPrice: { fontSize: 14, color: '#6C63FF', marginTop: 5 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 20, padding: 5 },
  quantityBtn: { padding: 5 },
  quantityText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginHorizontal: 8 },
  sellerTotalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sellerTotalText: { fontSize: 16, fontWeight: '600', color: '#555' },
  sellerTotalAmount: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  checkoutBtn: { backgroundColor: '#6C63FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 20, marginTop: 10 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cartFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 15, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cartTotalText: { fontSize: 18, fontWeight: '600', color: '#555' },
  cartTotalAmount: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  clearCartBtn: { alignItems: 'center' },
  clearCartText: { color: '#ff3b30', fontWeight: 'bold' },
  ratingContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  orderCard: { backgroundColor: '#fff', borderRadius: 15, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  orderCardDate: { fontSize: 14, color: '#777', marginBottom: 10 },
  orderCardItemsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 10, marginBottom: 8 },
  orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 10, padding: 8 },
  orderItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 10, backgroundColor: '#f0f0f0' },
  orderItemDetails: { flex: 1 },
  orderItemName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 4 },
  orderItemQuantity: { fontSize: 14, color: '#666', marginBottom: 4 },
  orderItemPrice: { fontSize: 14, fontWeight: 'bold', color: '#6C63FF' },
  orderTotalContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10, marginTop: 10 },
  orderCardTotal: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'right' },
  ordersList: { paddingBottom: 20 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#666' }
});