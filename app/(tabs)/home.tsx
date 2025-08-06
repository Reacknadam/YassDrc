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

// Assurez-vous que ces imports sont corrects et que vos fichiers Firebase sont configurés
import { db, firestore } from '@/firebase/config';
import { createProduct } from '@/services/productService';

import * as ImageManipulator from 'expo-image-manipulator';
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


// --- Définitions des types et composants utilitaires ---

// Slides pour le tutoriel d'onboarding
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

// Composant pour un slide individuel du tutoriel
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

// Types pour les produits, le panier et les informations du vendeur
type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  star?: number;
  category?: string;
  sellerId: string;
  sellerName?: string;
  isSellerVerified?: boolean;
  createdAt?: any;
};

type CartItem = Product & {
  quantity: number;
};

interface SellerInfo {
  email: string;
  name?: string;
  photoBase64?: string | null;
  phoneNumber?: string;
  shopName?: string;
  isVerified?: boolean;
}

// Interface pour la pagination des images dans la modale de détails
interface ImagePaginationProps {
  imagesCount: number;
  scrollX: Animated.Value;
}

// Composant pour les indicateurs de pagination des images (petits points)
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

// Interface pour le composant OptimizedImage
interface OptimizedImageProps {
  source: { uri: string };
  style: any;
  [key: string]: any;
}

// Fonction pour récupérer les morceaux d'images stockés en chunks dans Firestore
const getFullImageFromChunks = async (docId: string): Promise<string | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'imageChunks', docId));
    if (docSnap.exists()) {
      const { chunks } = docSnap.data();
      return chunks.join('');
    }
    return null;
  } catch (error) {
    console.error('Erreur récupération image:', error);
    return null;
  }
};

// Fonction pour charger et afficher les images (gère les formats base64, chunk, multichunk)
const loadImageForDisplay = async (imageRef: string): Promise<string> => {
  if (imageRef.startsWith('data:image')) {
    return imageRef;
  }

  if (imageRef.startsWith('chunk:')) {
    const docId = imageRef.split(':')[1];
    const fullImage = await getFullImageFromChunks(docId);
    return fullImage ? `data:image/jpeg;base64,${fullImage}` : 'https://via.placeholder.com/150';
  }

  if (imageRef.startsWith('multichunk:')) {
    const batchId = imageRef.split(':')[1];
    const chunksQuery = query(collection(db, 'imageChunks'), where('batchId', '==', batchId), orderBy('index'));
    const querySnapshot = await getDocs(chunksQuery);
    let fullImageBase64 = '';
    querySnapshot.forEach(docSnap => {
      fullImageBase64 += docSnap.data().chunk;
    });
    return fullImageBase64 ? `data:image/jpeg;base64,${fullImageBase64}` : 'https://via.placeholder.com/150';
  }

  if (imageRef.startsWith('/9j/') || imageRef.startsWith('iVBORw0KGgo')) {
    return `data:image/jpeg;base64,${imageRef}`;
  }

  return 'https://via.placeholder.com/150';
};

// Composant pour optimiser le chargement des images (avec indicateur de chargement)
const OptimizedImage: React.FC<OptimizedImageProps> = ({ source, style, ...props }) => {
  const [imageUri, setImageUri] = useState<string>('https://via.placeholder.com/150');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const uri = await loadImageForDisplay(source.uri);
        setImageUri(uri);
      } catch (error) {
        console.error('Erreur chargement image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [source.uri]);

  if (isLoading) {
    return (
      <View style={[style, styles.imageLoadingContainer]}>
        <ActivityIndicator size="small" color="#6C63FF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={style}
      resizeMode="cover"
      onError={() => console.log('Erreur affichage image')}
      {...props}
    />
  );
};


// --- Composant principal HomeScreen ---
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // États pour la pagination des produits
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // États liés à l'utilisateur et aux produits
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // États pour les différentes modales
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [sellerDashboardModalVisible, setSellerDashboardModalVisible] = useState(false);
  const [myOrdersModalVisible, setMyOrdersModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  // États pour le formulaire d'ajout de produit et l'avis
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [currentRating, setCurrentRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

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

  // Nouveaux états pour les favoris et les commandes
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);

  // Clés pour AsyncStorage
  const CHECK_ONBOARDING_KEY = 'hasSeenOnboarding';
  const CACHED_PRODUCTS_KEY = 'cached_products';
  const FAVORITES_KEY = 'user_favorites';

  // --- Effet pour les permissions (inchangé) ---
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

  // --- Fonctions Onboarding (inchangées) ---
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

  // --- Fonctionnalité 1: Gestion des favoris (Wishlist) ---
  const loadFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      return;
    }
    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', user.id));
      const querySnapshot = await getDocs(q);
      const fetchedFavorites: string[] = [];
      querySnapshot.forEach(docSnap => {
        fetchedFavorites.push(docSnap.data().productId);
      });
      setFavorites(fetchedFavorites);
    } catch (error) {
      console.error("Erreur lors du chargement des favoris:", error);
    }
  }, [user]);

  const toggleFavorite = async (productId: string) => {
    if (!user?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour gérer vos favoris.");
      router.push('/login');
      return;
    }

    try {
      const favoritesRef = collection(db, 'userFavorites');
      const q = query(favoritesRef, where('userId', '==', user.id), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Ajouter aux favoris
        await addDoc(favoritesRef, {
          userId: user.id,
          productId: productId,
          createdAt: serverTimestamp(),
        });
        setFavorites(prev => [...prev, productId]);
        Alert.alert("Favori", "Produit ajouté à vos favoris !");
      } else {
        // Retirer des favoris
        querySnapshot.forEach(async (docSnap) => {
          await deleteDoc(doc(db, 'userFavorites', docSnap.id));
        });
        setFavorites(prev => prev.filter(id => id !== productId));
        Alert.alert("Favori", "Produit retiré de vos favoris.");
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des favoris:", error);
      Alert.alert("Erreur", "Impossible de gérer les favoris pour le moment.");
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [user, loadFavorites]);

  // --- Fonctions de modale de détails produit (inchangées) ---
  const openDetailModal = async (product: Product) => {
    setSelectedProduct(product);
    setSellerInfo(null);
    setDetailModalVisible(true);

    if (!product.sellerId) {
      setSellerInfo({
        email: "vendeur@inconnu.com",
        name: "Vendeur inconnu",
        photoBase64: null,
        isVerified: false,
      });
      return;
    }

    try {
      const sellerRef = doc(db, 'users', product.sellerId);
      const sellerSnap = await getDoc(sellerRef);

      if (sellerSnap.exists()) {
        const data = sellerSnap.data();
        setSellerInfo({
          email: data.email,
          name: data.name || "Anonyme",
          photoBase64: data.photoBase64 || null,
          phoneNumber: data.sellerForm?.phoneNumber,
          shopName: data.sellerForm?.shopName,
          isVerified: data.isSellerVerified || false,
        });
      } else {
        setSellerInfo({
          email: product.sellerId,
          name: "Vendeur inconnu",
          photoBase64: null,
          isVerified: false,
        });
      }
    } catch (err) {
      console.error("Erreur récupération vendeur:", err);
      setSellerInfo({
        email: "erreur@recuperation.com",
        name: "Erreur de chargement",
        photoBase64: null,
        isVerified: false,
      });
    }
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedProduct(null);
    setSellerInfo(null);
  };

  // --- Fonction de chat avec le vendeur (inchangée) ---
  const startChatWithSeller = async () => {
    if (!user?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour discuter avec le vendeur.");
      router.push('/login');
      return;
    }

    if (!selectedProduct?.sellerId) {
      Alert.alert("Erreur", "Impossible de trouver l'ID du vendeur.");
      return;
    }

    const sellerId = selectedProduct.sellerId;
    const currentUserId = user.id;

    if (sellerId === currentUserId) {
      Alert.alert("Action impossible", "Vous ne pouvez pas discuter avec vous-même.");
      return;
    }

    setLoadingOrder('chat');

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef,
        where('participants', 'array-contains', currentUserId),
        limit(1)
      );
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
      Alert.alert("Erreur", "Impossible de démarrer la conversation. Veuillez réessayer.");
    } finally {
      setLoadingOrder(null);
    }
  };

  // --- Fonctions de gestion du panier (inchangées) ---
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

  const animateCart = () => {
    Animated.sequence([
      Animated.timing(cartScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cartScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogout = async () => {
    router.replace('/login');
  };

  // --- Fonctionnalité: Téléchargement des produits et recherche depuis Firebase ---
  const fetchProducts = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
      setProducts([]);
      setLastVisible(null);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      let productsQuery = collection(firestore, 'products');
      let q;

      if (search.trim() !== '') {
        // Recherche par nom de produit
        // Note: Firestore ne supporte pas les recherches 'contains' ou 'like' directement.
        // Pour une recherche plus avancée, vous devriez utiliser un service de recherche comme Algolia ou une fonction Cloud.
        // Ici, nous allons simuler une recherche "commence par" ou "est égal à"
        q = query(
          productsQuery,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          orderBy('name'), // Nécessaire pour les requêtes de plage
          limit(10)
        );
      } else if (activeCategory !== 'Tous') {
        q = query(
          productsQuery,
          where('category', '==', activeCategory),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
      } else {
        q = query(
          productsQuery,
          orderBy('createdAt', 'desc'),
          limit(10)
        );
      }

      if (!isRefreshing && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty && !isRefreshing) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const fetched: Product[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Product);
      });

      if (isRefreshing) {
        setProducts(fetched);
      } else {
        const combinedProducts = Array.from(new Map(
          [...(products || []), ...fetched].map(item => [item.id, item])
        ).values());
        setProducts(combinedProducts);
      }

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);

      if (fetched.length < 10) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

    } catch (error) {
      console.error('Erreur récupération produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits');
      setHasMore(false);
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const onRefresh = async () => {
    await fetchProducts(true);
  };

  const handleLoadMore = () => {
    fetchProducts();
  };

  // Déclenche la recherche chaque fois que le terme de recherche ou la catégorie change
  useEffect(() => {
    setProducts([]); // Réinitialise les produits pour une nouvelle recherche/catégorie
    setLastVisible(null);
    setHasMore(true);
    fetchProducts(true); // Effectue une nouvelle recherche
  }, [search, activeCategory]); // Dépendances pour la recherche et la catégorie

  // Effet initial pour charger les produits
  useEffect(() => {
    fetchProducts(true);
  }, []);


  // --- Effet pour le statut du vendeur (inchangé) ---
  useEffect(() => {
    if (!user?.id) {
      setIsVerifiedSeller(false);
      return;
    }

    const userRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setIsVerifiedSeller(userData.isSellerVerified || false);
      } else {
        setIsVerifiedSeller(false);
      }
    }, (error) => {
      console.error("Erreur de l'écouteur de statut vendeur:", error);
      setIsVerifiedSeller(false);
    });

    return () => unsubscribe();

  }, [user]);

  // --- Effets pour le panier (inchangés) ---
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem('cart');
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
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

  // --- Fonctions de sélection/prise d'image et compression (inchangées) ---
  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Nous avons besoin de la permission pour accéder à vos photos.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const newImages = await Promise.all(
          result.assets.slice(0, 3).map(async (asset) => {
            try {
              if (!asset.base64) return null;
              const compressed = await compressImage(asset.base64);
              return compressed ? `data:image/jpeg;base64,${compressed}` : null;
            } catch (error) {
              console.error("Erreur lors du traitement de l'image:", error);
              return null;
            }
          })
        );
        const validImages = newImages.filter(img => img !== null) as string[];
        if (validImages.length > 0) {
          setImages(prev => [...prev, ...validImages].slice(0, 3));
        } else {
          Alert.alert("Erreur", "Aucune image valide n'a pu être chargée");
        }
      }
    } catch (error) {
      console.error('Erreur lors de la sélection des images:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de la sélection des images");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de la permission pour utiliser la caméra');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = result.assets[0].base64;
        try {
          const compressed = await compressImage(base64Image);
          if (compressed) {
            setImages(prev => [...prev, `data:image/jpeg;base64,${compressed}`].slice(0, 3));
          } else {
            Alert.alert("Erreur", "Impossible de compresser la photo");
          }
        } catch (error) {
          console.error("Erreur de compression:", error);
          Alert.alert("Erreur", "Problème lors de la compression de la photo");
        }
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      Alert.alert('Erreur', "Impossible d'accéder à la caméra");
    }
  };

  const compressImage = async (base64String: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.src = `data:image/jpeg;base64,${base64String}`;

          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }

            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
              if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.7;
            let compressedData: string;

            do {
              compressedData = canvas.toDataURL('image/jpeg', quality).split(',')[1];
              quality -= 0.1;
            } while (compressedData.length > 750000 && quality > 0.1);

            resolve(compressedData.length <= 750000 ? compressedData : null);
          };
          img.onerror = () => resolve(null);
        });
      } else {
        const manipResult = await ImageManipulator.manipulateAsync(
          `data:image/jpeg;base64,${base64String}`,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        return manipResult.base64 ? (manipResult.base64.split(',')[1] || manipResult.base64) : null;
      }
    } catch (error) {
      console.error('Erreur détaillée lors de la compression:', error);
      return null;
    }
  };

  const confirmAndPublish = () => {
    Alert.alert(
      "Confirmer la publication",
      "Voulez-vous vraiment publier ce produit ?",
      [{ text: "Annuler", style: "cancel" }, { text: "Publier", onPress: handleAddProduct }]
    );
  };

  // --- Fonction d'ajout de produit (inchangée, ajout de `createdAt`) ---
  const handleAddProduct = async () => {
    if (loading) return;
    setLoading(true);

    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour publier un produit.');
      setLoading(false);
      return;
    }

    if (!name.trim() || !description.trim() || !price.trim()) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      setLoading(false);
      return;
    }

    if (parseFloat(price) <= 0) {
      Alert.alert('Erreur', 'Le prix doit être supérieur à 0');
      setLoading(false);
      return;
    }

    if (images.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins une image');
      setLoading(false);
      return;
    }

    try {
      const processedImages = await Promise.all(images.map(async (img) => {
        const base64Data = img.startsWith('data:image') ? img.split(',')[1] : img;
        if (base64Data.length > 900000) {
          const chunkDocs = [];
          const chunkSize = 900000;
          const totalChunks = Math.ceil(base64Data.length / chunkSize);
          const batchId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          for (let i = 0; i < totalChunks; i++) {
            const chunk = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
            const docRef = await addDoc(collection(db, 'imageChunks'), {
              chunk,
              index: i,
              totalChunks,
              batchId,
              createdAt: new Date()
            });
            chunkDocs.push(docRef.id);
          }
          return `multichunk:${batchId}`;
        }
        return base64Data;
      }));

      await createProduct({
        name,
        description,
        price: parseFloat(price),
        images: processedImages,
        category: category || 'Général',
        sellerId: user.id,
        sellerInfo: {
          email: user.email,
          name: user.name || '',
          phoneNumber: user.sellerForm?.phoneNumber || '',
          shopName: user.sellerForm?.shopName || '',
        },
        createdAt: serverTimestamp()
      });

      await fetchProducts(true);

      Alert.alert('Succès', 'Produit publié avec succès !');
      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Erreur publication produit:', error);
      Alert.alert('Erreur', "Impossible de publier l'annonce pour le moment.");
    } finally {
      setLoading(false);
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

  const addToCart = (product: Product | null) => {
    if (!product) {
      console.warn("Tentative d'ajout d'un produit null au panier");
      return;
    }

    animateCart();
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
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

  const cartTotal = cart.reduce<number>(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // --- Fonctionnalité 2: Soumettre un avis (Rating/Review System) ---
  const submitReview = async () => {
    if (!user?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour laisser un avis.");
      router.push('/login');
      return;
    }
    if (!selectedProduct?.id) {
      Alert.alert("Erreur", "Aucun produit sélectionné pour l'avis.");
      return;
    }
    if (currentRating === 0) {
      Alert.alert("Note requise", "Veuillez donner une note en étoiles.");
      return;
    }

    try {
      await addDoc(collection(db, 'productReviews'), {
        productId: selectedProduct.id,
        userId: user.id,
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
      Alert.alert("Erreur", "Impossible de soumettre votre avis pour le moment.");
    }
  };

  // --- Fonctionnalité 3: Passer une commande (depuis le panier) ---
  const placeOrder = async (sellerId: string, items: CartItem[], totalAmount: number) => {
    if (!user?.id) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour passer commande.");
      router.push('/login');
      return;
    }

    setLoadingOrder(sellerId);
    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        buyerId: user.id,
        sellerId: sellerId,
        items: items.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.images[0] || 'https://via.placeholder.com/50',
        })),
        totalAmount: totalAmount,
        orderDate: serverTimestamp(),
        status: 'pending',
      });

      // Retirer les articles commandés du panier
      setCart(prevCart => prevCart.filter(item => !items.some(orderedItem => orderedItem.id === item.id)));
      setCartModalVisible(false); // Fermer la modale du panier

      // Redirection vers la page de confirmation avec les informations de la commande
      router.push({
        pathname: '/pay',
        params: {
          orderId: orderRef.id,
          totalAmount: totalAmount.toString(),
          sellerId: sellerId,
          itemNames: JSON.stringify(items.map(item => item.name)), // Passer les noms des articles en chaîne JSON
          message: 'Votre commande a été passée avec succès !'
        }
      });

    } catch (error) {
      console.error("Erreur lors de la commande:", error);
      Alert.alert("Erreur", "Impossible de passer la commande pour le moment.");
    } finally {
      setLoadingOrder(null);
    }
  };

  // --- Fonctionnalité 4: Afficher l'historique des commandes (pour les acheteurs) ---
  const fetchMyOrders = useCallback(async () => {
    if (!user?.id) {
      setMyOrders([]);
      return;
    }
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('buyerId', '==', user.id), orderBy('orderDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedOrders: any[] = [];
      querySnapshot.forEach(docSnap => {
        fetchedOrders.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMyOrders(fetchedOrders);
    } catch (error) {
      console.error("Erreur lors du chargement des commandes:", error);
      Alert.alert("Erreur", "Impossible de charger vos commandes.");
    }
  }, [user]);

  useEffect(() => {
    if (myOrdersModalVisible) {
      fetchMyOrders();
    }
  }, [myOrdersModalVisible, fetchMyOrders]);


  // --- Fonctionnalité 5: Tableau de bord du vendeur (pour les vendeurs vérifiés) ---
  const fetchSellerProducts = useCallback(async () => {
    if (!user?.id) {
      setSellerProducts([]);
      return;
    }
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('sellerId', '==', user.id), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedProducts: Product[] = [];
      querySnapshot.forEach(docSnap => {
        fetchedProducts.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setSellerProducts(fetchedProducts);
    } catch (error) {
      console.error("Erreur lors du chargement des produits du vendeur:", error);
      Alert.alert("Erreur", "Impossible de charger les produits de votre magasin.");
    }
  }, [user]);

  useEffect(() => {
    if (sellerDashboardModalVisible) {
      fetchSellerProducts();
    }
  }, [sellerDashboardModalVisible, fetchSellerProducts]);

  // --- Fonctionnalité 6: Simuler une notification de nouveau produit (pour le débogage/démonstration) ---
  const simulateNewProductNotification = () => {
    Alert.alert("Notification", "Un nouveau produit vient d'être ajouté ! Explorez-le maintenant.");
  };

  // --- Fonction de rendu d'un élément de la FlatList (produit) ---
  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openProductDetails(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardImageContainer}>
        {item.images && item.images.length > 0 ? (
          <OptimizedImage
            source={{ uri: item.images[0] }}
            style={styles.cardImage}
          />
        ) : (
          <Image
            source={{ uri: 'https://via.placeholder.com/150' }}
            style={styles.cardImage}
          />
        )}
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={(e) => {
            e.stopPropagation();
            addToCart(item);
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
        {user?.id && (
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
          >
            <Ionicons
              name={favorites.includes(item.id) ? "heart" : "heart-outline"}
              size={24}
              color={favorites.includes(item.id) ? "#FF6F61" : "#fff"}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productPrice}>{item.price.toLocaleString()} CDF</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Modale d'onboarding (si showOnboarding est vrai) */}
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
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
          />

          {/* Indicateurs de progression (Points) pour l'onboarding */}
          <View style={styles.onboardingPagination}>
            {onboardingSlides.map((_, index) => {
              const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [10, 25, 10],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.5, 1, 0.5],
                extrapolate: 'clamp',
              });
              const dotBackgroundColor = scrollX.interpolate({
                inputRange,
                outputRange: ['#ccc', '#6C63FF', '#ccc'],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index.toString()}
                  style={[
                    styles.onboardingDot,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      backgroundColor: dotBackgroundColor,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Boutons Suivant/Passer/Commencer pour l'onboarding */}
          <View style={styles.onboardingButtonsContainer}>
            {currentSlideIndex < onboardingSlides.length - 1 ? (
              <>
                <TouchableOpacity style={styles.onboardingSkipButton} onPress={skipOnboarding}>
                  <Text style={styles.onboardingSkipButtonText}>Passer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.onboardingNextButton} onPress={goToNextSlide}>
                  <Text style={styles.onboardingNextButtonText}>Suivant</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.onboardingGetStartedButton} onPress={skipOnboarding}>
                <Text style={styles.onboardingGetStartedButtonText}>Commencer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <SafeAreaView style={styles.container}>
        {/* En-tête de l'application */}
        <View style={styles.header}>
          {/* Bouton Mes Favoris */}
          <TouchableOpacity style={styles.headerIcon} onPress={() => {
            if (!user?.id) {
              Alert.alert("Connexion requise", "Veuillez vous connecter pour voir vos favoris.");
              router.push('/login');
              return;
            }
            const favoriteProductsCount = products.filter(p => favorites.includes(p.id)).length;
            Alert.alert("Mes Favoris", `Vous avez ${favoriteProductsCount} produits favoris.`);
          }}>
            <Ionicons name="heart-outline" size={28} color="#333" />
          </TouchableOpacity>

      

          {isVerifiedSeller && (
            <>
              {/* Bouton Mon Magasin (pour les vendeurs vérifiés) */}
              <TouchableOpacity style={styles.headerAddProductIcon} onPress={() => setSellerDashboardModalVisible(true)} >
                <Feather name="briefcase" size={28} color="#6C63FF" />
              </TouchableOpacity>
              {/* Bouton Ajouter un produit */}
              <TouchableOpacity style={styles.headerAddProductIcon} onPress={() => setModalVisible(true)} >
                <Feather name="plus" size={28} color="#6C63FF" />
              </TouchableOpacity>
            </>
          )}

      

          {/* Icône du panier avec badge */}
          <TouchableOpacity onPress={() => setCartModalVisible(true)} style={styles.headerIcon} >
            <Animated.View style={{ transform: [{ scale: cartScale }] }}>
              <Feather name="shopping-bag" size={24} color="#333" />
            </Animated.View>
            {cart.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Liste principale des produits */}
        <FlatList
          ListHeaderComponent={
            <>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Bonjour,</Text>
                <Text style={styles.subtitle}>Qu'allez-vous acheter aujourd'hui ?</Text>
              </View>

              <View style={styles.searchContainer}>
                <Feather name="search" size={22} color="#999" style={styles.searchIcon} />
                <TextInput
                  placeholder="Rechercher un produit..."
                  placeholderTextColor="#999"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
              >
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      activeCategory === cat && styles.activeCategoryBtn
                    ]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        activeCategory === cat && styles.activeCategoryText
                      ]}
                    >
                      {cat}
                    </Text>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
              colors={['#6C63FF']}
            />
          }
          ListFooterComponent={
            loadingMore && hasMore ? <ActivityIndicator size="large" color="#6C63FF" style={{ marginVertical: 20 }} /> : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Feather name="package" size={40} color="#999" />
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
                <Text style={styles.emptySubtext}>Essayez de changer de catégorie ou de recherche.</Text>
              </View>
            ) : null
          }
        />

        {/* Modale d'ajout de produit */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
            <View style={styles.bottomSheetContainer}>
              <View style={styles.handleBar} />
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Ajouter un produit</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <AntDesign name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Nom du produit</Text>
                <TextInput
                  placeholder="iPhone 13 Pro Max"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  placeholder="Description détaillée du produit..."
                  value={description}
                  onChangeText={setDescription}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                />

                <Text style={styles.inputLabel}>Prix (CDF)</Text>
                <TextInput
                  placeholder="500000"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Catégorie</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  {categories.filter(cat => cat !== 'Tous').map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryBtn,
                        category === cat && styles.activeCategoryBtn,
                        { marginBottom: 10 }
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          category === cat && styles.activeCategoryText
                        ]}
                      >
                        {cat}
                      </Text>
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
                      <Image
                        source={{ uri: img }}
                        style={styles.imagePreview}
                        onError={(e) => console.log("Erreur de chargement de l'image:", e.nativeEvent.error)}
                      />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setImages(images.filter((_, index) => index !== i))}
                      >
                        <AntDesign name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < 3 && (
                    <TouchableOpacity
                      style={styles.addImagePlaceholder}
                      onPress={() => {
                        Alert.alert(
                          "Ajouter une image",
                          "Choisissez la source",
                          [
                            { text: "Appareil photo", onPress: takePhoto },
                            { text: "Galerie", onPress: pickImage },
                            { text: "Annuler", style: "cancel" }
                          ]
                        );
                      }}
                    >
                      <Feather name="plus" size={24} color="#ccc" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={confirmAndPublish}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.publishBtnText}>Publier le produit</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modale de détails du produit (avec ajout bouton avis) */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailModalVisible}
          onRequestClose={closeDetailModal}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeDetailModal} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '90%' }]}>
              <View style={styles.handleBar} />
              {selectedProduct ? (
                <>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {selectedProduct.images && selectedProduct.images.length > 0 && (
                      <View>
                        <FlatList
                          data={selectedProduct.images}
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          keyExtractor={(item, index) => index.toString()}
                          renderItem={({ item }) => (
                            <OptimizedImage
                              source={{ uri: item }}
                              style={styles.detailModalImageCarousel}
                            />
                          )}
                          onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: productImagesScrollX } } }],
                            { useNativeDriver: false }
                          )}
                          scrollEventThrottle={16}
                        />
                        <ImagePagination
                          imagesCount={selectedProduct.images.length}
                          scrollX={productImagesScrollX}
                        />
                      </View>
                    )}
                    <View style={styles.detailModalInfo}>
                      <Text style={styles.detailModalCategory}>
                        {selectedProduct.category || "Non spécifiée"}
                      </Text>
                      <Text style={styles.detailModalName}>{selectedProduct.name}</Text>
                      <Text style={styles.detailModalPrice}>
                        {selectedProduct.price.toLocaleString()} CDF
                      </Text>

                      <Text style={styles.sectionTitle}>Description</Text>
                      <Text style={styles.detailModalDescription}>
                        {selectedProduct.description}
                      </Text>

                      <Text style={styles.sectionTitle}>Vendu par</Text>
                      {sellerInfo ? (
                        <TouchableOpacity onPress={startChatWithSeller} style={styles.sellerInfoCard} activeOpacity={0.7}>
                          <View style={styles.sellerImageContainer}>
                            {sellerInfo.photoBase64 ? (
                              <Image
                                source={{ uri: `data:image/jpeg;base64,${sellerInfo.photoBase64}` }}
                                style={styles.sellerPhoto}
                              />
                            ) : (
                              <View style={styles.sellerPhotoPlaceholder}>
                                <Ionicons name="person-circle-outline" size={40} color="#888" />
                              </View>
                            )}
                          </View>
                          <View style={styles.sellerDetails}>
                            <Text style={styles.sellerName} numberOfLines={1}>
                              {sellerInfo.name || sellerInfo.email}
                            </Text>
                            {sellerInfo.shopName && (
                              <Text style={styles.sellerShopName} numberOfLines={1}>
                                {sellerInfo.shopName}
                              </Text>
                            )}
                          </View>
                          <View style={styles.sellerAction}>
                            <Feather name="message-circle" size={24} color="#6C63FF" />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.sellerLoading}>
                          <ActivityIndicator size="small" color="#6C63FF" />
                          <Text style={styles.sellerLoadingText}>Chargement du vendeur...</Text>
                        </View>
                      )}

                      {/* Bouton pour laisser un avis */}
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => setReviewModalVisible(true)}
                      >
                        <AntDesign name="staro" size={20} color="#fff" />
                        <Text style={styles.reviewButtonText}>Laisser un avis</Text>
                      </TouchableOpacity>

                    </View>
                  </ScrollView>

                  <View style={styles.detailFooter}>
                    <TouchableOpacity
                      style={styles.detailAddToCartButton}
                      onPress={() => {
                        addToCart(selectedProduct);
                        closeDetailModal();
                      }}
                    >
                      <Ionicons name="cart-outline" size={24} color="#fff" />
                      <Text style={styles.detailAddToCartButtonText}>Ajouter au panier</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#6C63FF" />
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Modale Panier */}
        <Modal
          visible={cartModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCartModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCartModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '85%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.cartModalHeader}>
                <Text style={styles.modalTitle}>Mon Panier</Text>
                <TouchableOpacity onPress={() => setCartModalVisible(false)}>
                  <AntDesign name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {cart.length === 0 ? (
                <View style={styles.emptyCartContainer}>
                  <Feather name="shopping-bag" size={60} color="#e0e0e0" />
                  <Text style={styles.emptyCartText}>Votre panier est vide</Text>
                  <Text style={styles.emptyCartSubtext}>Parcourez nos produits pour trouver votre bonheur !</Text>
                  <TouchableOpacity style={styles.continueShoppingBtn} onPress={() => setCartModalVisible(false)}>
                    <Text style={styles.continueShoppingText}>Continuer les achats</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                  {Object.entries(groupCartBySeller()).map(([sellerId, sellerItems]) => (
                    <View key={sellerId} style={styles.sellerCartGroup}>
                      <Text style={styles.sellerGroupTitle}>
                        Vendeur : {products.find(p => p.sellerId === sellerId)?.sellerName || 'Inconnu'}
                      </Text>
                      {sellerItems.map((item) => (
                        <View key={item.id} style={styles.cartItem}>
                          <OptimizedImage
                            source={{ uri: item.images[0] }}
                            style={styles.cartItemImage}
                          />
                          <View style={styles.cartItemDetails}>
                            <Text style={styles.cartItemName} numberOfLines={2}>
                              {item.name}
                            </Text>
                            <Text style={styles.cartItemPrice}>
                              {item.price.toLocaleString()} CDF
                            </Text>
                          </View>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, item.quantity - 1)}
                              style={styles.quantityBtn}
                            >
                              <Feather name="minus" size={16} color="#6C63FF" />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, item.quantity + 1)}
                              style={styles.quantityBtn}
                            >
                              <Feather name="plus" size={16} color="#6C63FF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      <View style={styles.sellerTotalContainer}>
                        <Text style={styles.sellerTotalText}>Total pour ce vendeur</Text>
                        <Text style={styles.sellerTotalAmount}>
                          {sellerItems.reduce((sum: number, item) => sum + (item.price * item.quantity), 0).toLocaleString()} CDF
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.checkoutBtn}
                        onPress={() => placeOrder(sellerId, sellerItems, sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                        disabled={loadingOrder === sellerId}
                      >
                        {loadingOrder === sellerId ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.checkoutBtnText}>Commander</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {cart.length > 0 && (
                <View style={styles.cartFooter}>
                  <View style={styles.cartTotalRow}>
                    <Text style={styles.cartTotalText}>Total général</Text>
                    <Text style={styles.cartTotalAmount}>{cartTotal.toLocaleString()} CDF</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearCartBtn}
                    onPress={() => Alert.alert(
                      "Vider le panier",
                      "Êtes-vous sûr ?",
                      [
                        { text: "Annuler", style: "cancel" },
                        { text: "Oui", onPress: () => setCart([]) }
                      ]
                    )}
                  >
                    <Text style={styles.clearCartText}>Vider le panier</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Nouvelle Modale: Laisser un avis */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={reviewModalVisible}
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setReviewModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '60%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Laisser un avis pour {selectedProduct?.name}</Text>
                <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                  <AntDesign name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setCurrentRating(star)}>
                    <AntDesign
                      name={star <= currentRating ? "star" : "staro"}
                      size={30}
                      color="#FFD700"
                      style={{ marginHorizontal: 5 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder="Votre commentaire (facultatif)"
                value={reviewComment}
                onChangeText={setReviewComment}
                style={[styles.input, styles.multilineInput]}
                multiline
              />
              <TouchableOpacity style={styles.publishBtn} onPress={submitReview}>
                <Text style={styles.publishBtnText}>Soumettre l'avis</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Nouvelle Modale: Mes Commandes */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={myOrdersModalVisible}
          onRequestClose={() => setMyOrdersModalVisible(false)}
        >
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
              {myOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="clipboard" size={60} color="#e0e0e0" />
                  <Text style={styles.emptyText}>Aucune commande passée</Text>
                  <Text style={styles.emptySubtext}>Commencez vos achats pour voir vos commandes ici !</Text>
                </View>
              ) : (
                <FlatList
                  data={myOrders}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item: order }) => (
                    <View style={styles.orderCard}>
                      <Text style={styles.orderCardTitle}>Commande #{order.id.substring(0, 8)}</Text>
                      <Text style={styles.orderCardDate}>Date: {new Date(order.orderDate?.toDate()).toLocaleDateString()}</Text>
                      <Text style={styles.orderCardStatus}>Statut: {order.status}</Text>
                      <Text style={styles.orderCardSeller}>Vendeur: {products.find(p => p.sellerId === order.sellerId)?.sellerName || 'Inconnu'}</Text>
                      <Text style={styles.orderCardItemsTitle}>Articles:</Text>
                      {order.items.map((item: any, index: number) => (
                        <View key={index} style={styles.orderItem}>
                          <OptimizedImage source={{ uri: item.imageUrl }} style={styles.orderItemImage} />
                          <View style={styles.orderItemDetails}>
                            <Text style={styles.orderItemName}>{item.name}</Text>
                            <Text style={styles.orderItemQuantity}>Quantité: {item.quantity}</Text>
                            <Text style={styles.orderItemPrice}>Prix: {item.price.toLocaleString()} CDF</Text>
                          </View>
                        </View>
                      ))}
                      <Text style={styles.orderCardTotal}>Total: {order.totalAmount.toLocaleString()} CDF</Text>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Nouvelle Modale: Tableau de bord du vendeur */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={sellerDashboardModalVisible}
          onRequestClose={() => setSellerDashboardModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSellerDashboardModalVisible(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: '90%' }]}>
              <View style={styles.handleBar} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mon Magasin</Text>
                <TouchableOpacity onPress={() => setSellerDashboardModalVisible(false)}>
                  <AntDesign name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              {sellerProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="shopping-bag" size={60} color="#e0e0e0" />
                  <Text style={styles.emptyText}>Aucun produit listé</Text>
                  <Text style={styles.emptySubtext}>Commencez à ajouter des produits pour les voir ici !</Text>
                  <TouchableOpacity style={styles.continueShoppingBtn} onPress={() => { setSellerDashboardModalVisible(false); setModalVisible(true); }}>
                    <Text style={styles.continueShoppingText}>Ajouter un produit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={sellerProducts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.sellerProductCard}>
                      <OptimizedImage source={{ uri: item.images[0] }} style={styles.sellerProductImage} />
                      <View style={styles.sellerProductDetails}>
                        <Text style={styles.sellerProductName}>{item.name}</Text>
                        <Text style={styles.sellerProductPrice}>{item.price.toLocaleString()} CDF</Text>
                        <Text style={styles.sellerProductCategory}>Catégorie: {item.category}</Text>
                      </View>
                    </View>
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

const styles = StyleSheet.create({
  // --- NOUVEAU DESIGN ---
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerIcon: {
    padding: 8,
  },
  headerAddProductIcon: {
    padding: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
  },
  cartBadge: {
    position: 'absolute',
    right: 5,
    top: 5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  titleContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginVertical: 15,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#333',
  },
  categoriesContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  categoryBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  activeCategoryBtn: {
    backgroundColor: '#6C63FF',
  },
  categoryText: {
    color: '#555',
    fontWeight: '500',
  },
  activeCategoryText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
  },
  productsGrid: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    margin: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
    maxWidth: (width / 2) - 15,
  },
  cardImageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  addToCartBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#6C63FF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  cardInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 10,
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 5,
  },
  // --- Modales (Bottom Sheet) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    backgroundColor: '#fdfdfd',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 10,
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
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  addImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  publishBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // --- Detail Modal ---
  detailModalImageCarousel: {
    width: width - 40,
    height: 250,
    resizeMode: 'cover',
    borderRadius: 10,
  },
  imagePaginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 15,
  },
  imageDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C63FF',
    marginHorizontal: 4,
  },
  detailModalInfo: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  detailModalCategory: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  detailModalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailModalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 15,
  },
  detailModalDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 20,
  },
  sellerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sellerImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  sellerPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sellerPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sellerShopName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sellerAction: {
    marginLeft: 10,
  },
  sellerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sellerLoadingText: {
    marginLeft: 10,
    color: '#777',
  },
  detailFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  detailAddToCartButton: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    paddingVertical: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  detailAddToCartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  // --- Cart Modal ---
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyCartText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyCartSubtext: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  continueShoppingBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  continueShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    marginHorizontal: 15,
  },
  cartItemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 10,
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#6C63FF',
    marginTop: 5,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 5,
  },
  quantityBtn: {
    padding: 5,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  cartFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cartTotalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
  },
  cartTotalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  clearCartBtn: {
    alignItems: 'center',
  },
  clearCartText: {
    color: '#ff3b30',
    fontWeight: 'bold',
  },
  sellerCartGroup: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 15,
    marginVertical: 10,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden'
  },
  sellerGroupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f9f9f9',
  },
  sellerTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sellerTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  sellerTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  checkoutBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Onboarding styles
  onboardingContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: '#fff',
  },
  onboardingSlide: {
    flex: 1/2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  onboardingImage: {
    width: width * 0.7,
    height: width * 0.7,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  onboardingContent: {
    alignItems: 'center',
  },
  onboardingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  onboardingDescription: {
    fontSize: 16,
    color: '#f0f0f0',
    textAlign: 'center',
    lineHeight: 24,
  },
  onboardingPagination: {
    position: 'absolute',
    bottom: height * 0.25,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingDot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  onboardingButtonsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 30 : 50,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  onboardingSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  onboardingSkipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onboardingNextButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  onboardingNextButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onboardingGetStartedButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  onboardingGetStartedButtonText: {
    color: '#6C63FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  overlayVisible: {
    opacity: 1,
  },
  overlayHidden: {
    opacity: 0,
  },
  navDrawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#2c3e50',
    zIndex: 1000,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#34495e',
    marginBottom: 10,
  },
  navTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 15,
  },
  navText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 5,
    zIndex: 1,
  },
  reviewButton: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  orderCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  orderCardDate: {
    fontSize: 14,
    color: '#777',
    marginBottom: 5,
  },
  orderCardStatus: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C63FF',
    marginBottom: 10,
  },
  orderCardSeller: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
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
  },
  orderItemDetails: {
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
  orderCardTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    textAlign: 'right',
  },
  sellerProductCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    alignItems: 'center',
  },
  sellerProductImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  sellerProductDetails: {
    flex: 1,
  },
  sellerProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sellerProductPrice: {
    fontSize: 15,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  sellerProductCategory: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
});
