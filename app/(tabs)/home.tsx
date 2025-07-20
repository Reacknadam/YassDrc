import React, { useEffect, useRef, useState } from 'react';
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
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

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
  DocumentSnapshot
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import {
  AntDesign, Feather,
  FontAwesome5,
  Ionicons
} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  star?: number;
  category?: string;
  sellerId: string;
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
}

type ProductData = {
  name: string;
  description: string;
  price: number;
  images: string[];
  category?: string;
  sellerId: string;
  sellerInfo?: SellerInfo;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
  const [loading, setLoading] = useState(false);

  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [star, setStar] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [navVisible, setNavVisible] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cartScale = useRef(new Animated.Value(1)).current;

  const categories = ['Tous', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];


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


// --- Gestion de la modale de détail du produit et récupération des infos vendeur ---
  // Modifiez la fonction openDetailModal
const openDetailModal = async (product: Product) => {
  setSelectedProduct(product);
  setSellerInfo(null);
  setDetailModalVisible(true);

  // Fallback si sellerInfo est null
  if (!product.sellerId) {
    setSellerInfo({
      email: "vendeur@inconnu.com",
      name: "Vendeur inconnu",
      photoBase64: null,
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
      });
    } else {
      setSellerInfo({
        email: product.sellerId,
        name: "Vendeur inconnu",
        photoBase64: null,
      });
    }
  } catch (err) {
    console.error("Erreur récupération vendeur:", err);
    setSellerInfo({
      email: "erreur@recuperation.com",
      name: "Erreur de chargement",
      photoBase64: null,
    });
  }
};

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedProduct(null);
    setSellerInfo(null);
  };

  // <-- NOUVELLE FONCTION : Pour gérer le clic sur le nom du vendeur
  const handleSellerNameClick = () => {
    if (sellerInfo) {
      // Logique pour "causer avec cette personne" - implémenter plus tard
      Alert.alert("Parler au vendeur", `Vous allez bientôt pouvoir discuter avec ${sellerInfo.name || sellerInfo.email}`);
      // Exemple de navigation vers un écran de chat : router.push(`/chat/${sellerInfo.email}`);
    }
  };




  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < -50) {
          closeNav();
        }
      },
    })
  ).current;

  const openNav = () => {
    setNavVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeNav = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setNavVisible(false));
  };


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
    let q = query(
      collection(firestore, 'products'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    if (!isRefreshing && lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setHasMore(false);
      return;
    }

    const fetched: Product[] = [];
    querySnapshot.forEach((doc) => {
      fetched.push({ id: doc.id, ...doc.data() } as Product);
    });

    if (isRefreshing) {
      setProducts(fetched);
    } else {
      setProducts(prev => [...prev, ...fetched]);
    }

    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    setLastVisible(lastDoc);

    if (fetched.length < 10) {
      setHasMore(false);
    }
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    Alert.alert('Erreur', 'Impossible de charger les produits');
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




  // Remplacez le useEffect existant par celui-ci
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    
    // Charger les produits
    const querySnapshot = await getDocs(collection(firestore, 'products'));
    const fetched: Product[] = [];
    querySnapshot.forEach((doc) => {
      fetched.push({ id: doc.id, ...doc.data() } as Product);
    });
    setProducts(fetched);
    
    // Vérifier le statut du vendeur
    if (user?.id) {
      try {
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsVerifiedSeller(userData.isSellerVerified || false);
        }
      } catch (error) {
        console.error("Erreur vérification vendeur:", error);
      }
    }
    
    setLoading(false);
  };

  fetchData();

  // Écouteur en temps réel pour les mises à jour
  let unsubscribeUser: () => void;
  if (user?.id) {
    const userRef = doc(db, 'users', user.id);
    unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsVerifiedSeller(userData.isSellerVerified || false);
      }
    });
  }

  return () => {
    if (unsubscribeUser) unsubscribeUser();
  };
}, [user]);
   


// Ajoutez ces useEffect pour la persistance du panier
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




const pickImage = async () => {
  try {
    console.log("Tentative de sélection d'image...");
    
    // Vérification des permissions pour iOS/Android
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

    console.log("Résultat du sélecteur:", result);

    if (!result.canceled && result.assets) {
      console.log(`${result.assets.length} images sélectionnées`);
      
      const newImages = await Promise.all(
        result.assets.slice(0, 3).map(async (asset) => {
          try {
            if (!asset.base64) {
              console.warn("Aucune donnée base64 dans l'image sélectionnée");
              return null;
            }
            
            console.log("Compression de l'image...");
            const compressed = await compressImage(asset.base64);
            
            if (!compressed) {
              console.warn("Échec de la compression");
              return null;
            }
            
            return `data:image/jpeg;base64,${compressed}`;
          } catch (error) {
            console.error("Erreur lors du traitement de l'image:", error);
            return null;
          }
        })
      );

      const validImages = newImages.filter(img => img !== null) as string[];
      console.log(`${validImages.length} images valides après traitement`);
      
      if (validImages.length > 0) {
        setImages(prev => [...prev, ...validImages].slice(0, 3));
      } else {
        Alert.alert("Erreur", "Aucune image valide n'a pu être chargée");
      }
    } else {
      console.log("Sélection annulée par l'utilisateur");
    }
  } catch (error) {
    console.error('Erreur lors de la sélection des images:', error);
    Alert.alert('Erreur', "Une erreur est survenue lors de la sélection des images");
  }
};




// Image compression function
const compressAndSplitImage = async (base64String: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return new Promise<string | null>((resolve) => {
        const img = new window.Image();
        img.src = `data:image/jpeg;base64,${base64String}`;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
        img.onerror = () => resolve(null);
      });
    } else {
      // Pour mobile, utilisez une bibliothèque comme react-native-image-resizer
      return base64String;
    }
  } catch (error) {
    console.error('Erreur compression image:', error);
    return null;
  }
};

// OptimizedImage component with proper typing
interface OptimizedImageProps {
  source: { uri: string };
  style: any;
  [key: string]: any;
}

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

const loadImageForDisplay = async (imageRef: string): Promise<string> => {
  // Si c'est une URI base64 complète
  if (imageRef.startsWith('data:image')) {
    return imageRef;
  }
  
  // Si c'est une référence à des chunks
  if (imageRef.startsWith('chunk:')) {
    const docId = imageRef.split(':')[1];
    const fullImage = await getFullImageFromChunks(docId);
    return fullImage ? `data:image/jpeg;base64,${fullImage}` : 'https://via.placeholder.com/150';
  }
  
  // Si c'est une string base64 sans prefix
  if (imageRef.startsWith('/9j/') || imageRef.startsWith('iVBORw0KGgo')) {
    return `data:image/jpeg;base64,${imageRef}`;
  }
  
  // Fallback
  return 'https://via.placeholder.com/150';
};


const takePhoto = async () => {
  try {
    console.log("Tentative de prise de photo...");
    
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

    console.log("Résultat de la caméra:", result);

    if (!result.canceled && result.assets[0]?.base64) {
      const base64Image = result.assets[0].base64;
      console.log("Photo prise, taille originale:", base64Image.length / 1024, "KB");
      
      try {
        const compressed = await compressImage(base64Image);
        if (compressed) {
          console.log("Photo compressée, taille:", compressed.length / 1024, "KB");
          setImages(prev => [...prev, `data:image/jpeg;base64,${compressed}`].slice(0, 3));
        } else {
          Alert.alert("Erreur", "Impossible de compresser la photo");
        }
      } catch (error) {
        console.error("Erreur de compression:", error);
        Alert.alert("Erreur", "Problème lors de la compression de la photo");
      }
    } else {
      console.log("Prise de photo annulée");
    }
  } catch (error) {
    console.error('Erreur caméra:', error);
    Alert.alert('Erreur', "Impossible d'accéder à la caméra");
  }
};

const confirmAndPublish = () => {
  Alert.alert(
    "Confirmer la publication",
    "Voulez-vous vraiment publier ce produit ?",
    [
      { text: "Annuler", style: "cancel" },
      { text: "Publier", onPress: handleAddProduct }
    ]
  );
};


const compressImage = async (base64String: string): Promise<string | null> => {
  console.log("Début de la compression...");
  try {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.src = `data:image/jpeg;base64,${base64String}`;
        
        img.onload = () => {
          console.log("Image chargée, début compression web");
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.log("Contexte canvas non disponible");
            resolve(null);
            return;
          }
          
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.7;
          let compressedData: string;

          do {
            compressedData = canvas.toDataURL('image/jpeg', quality).split(',')[1];
            quality -= 0.1;
            console.log(`Tentative avec qualité ${quality}, taille: ${compressedData.length / 1024}KB`);
          } while (compressedData.length > 750000 && quality > 0.1);

          const finalSizeKB = compressedData.length / 1024;
          console.log(`Compression réussie, taille finale: ${finalSizeKB.toFixed(2)}KB`);
          
          resolve(compressedData.length <= 750000 ? compressedData : null);
        };
        
        img.onerror = () => {
          console.log("Erreur de chargement de l'image");
          resolve(null);
        };
      });
    } else {
      console.log("Compression mobile...");
      const manipResult = await ImageManipulator.manipulateAsync(
        `data:image/jpeg;base64,${base64String}`,
        [{ resize: { width: 1024 } }],
        { 
          compress: 0.7, 
          format: ImageManipulator.SaveFormat.JPEG, 
          base64: true 
        }
      );
      
      if (!manipResult.base64) {
        console.log("Aucune donnée base64 retournée par ImageManipulator");
        return null;
      }
      
      const compressedData = manipResult.base64.split(',')[1] || manipResult.base64;
      console.log(`Taille compressée: ${compressedData.length / 1024}KB`);
      
      return compressedData;
    }
  } catch (error) {
    console.error('Erreur détaillée lors de la compression:', error);
    return null;
  }
};







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

// Remplacer cette ligne:
// fetchProducts();
// Par:
await fetchProducts(true);

    Alert.alert('Succès', 'Produit publié avec succès !');
    setModalVisible(false);
    resetForm();
    fetchProducts();
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
    setStar('');
    setCategory('');
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
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

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

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
      <View style={styles.ratingBadge}>
        <Ionicons name="star" color="#FFD700" size={12} />
        <Text style={styles.ratingText}>{item.star || 0}</Text>
      </View>
    </View>
    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
    <Text style={styles.productPrice}>{item.price.toLocaleString()} CDF</Text>
    <TouchableOpacity 
      style={styles.addToCartBtn}
      onPress={() => addToCart(item)}
    >
      <Feather name="plus" size={16} color="#fff" />
    </TouchableOpacity>
  </TouchableOpacity>
);




  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (activeCategory === 'Tous' || p.category === activeCategory)
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Navigation Drawer */}
      <Animated.View 
        style={[
          styles.overlay, 
          { opacity: fadeAnim },
          navVisible ? styles.overlayVisible : styles.overlayHidden
        ]} 
        onTouchStart={closeNav}
      />
      
      <Animated.View 
        style={[
          styles.navDrawer,
          { transform: [{ translateX: slideAnim }] }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.navHeader}>
          <Text style={styles.navTitle}>Menu</Text>
          <TouchableOpacity onPress={closeNav}>
            <AntDesign name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
  style={styles.navItem}
  onPress={() => {
    closeNav();
    router.push('/profile');
  }}
>
  <Ionicons name="person-outline" size={20} color="#fff" />
  <Text style={styles.navText}>Mon Profil</Text>
</TouchableOpacity>

<TouchableOpacity 
  style={styles.navItem}
  onPress={() => {
    closeNav();
    router.push('/favorites');
  }}
>
  <Ionicons name="heart-outline" size={20} color="#fff" />
  <Text style={styles.navText}>Favoris</Text>
</TouchableOpacity>

<TouchableOpacity 
  style={styles.navItem}
  onPress={() => {
    closeNav();
    router.push('/history');
  }}
>
  <Ionicons name="time-outline" size={20} color="#fff" />
  <Text style={styles.navText}>Historique</Text>
</TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.navText}>Déconnexion</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main Content */}
     <ScrollView
  style={styles.content}
  showsVerticalScrollIndicator={false}
  refreshControl={                   // ← On ajoute cette prop
    <RefreshControl                  // ← Et ce composant à l’intérieur
      refreshing={refreshing}        // ← Booléen d’état
      onRefresh={onRefresh}          // ← Callback quand on tire vers le bas
      tintColor="#6C63FF"            // ← Couleur de l’indicateur iOS
      colors={['#6C63FF']}           // ← Couleur(s) de l’indicateur Android
    />
  }
>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={openNav}>
            <Feather name="menu" size={28} color="#6C63FF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <FontAwesome5 name="store" size={20} color="#6C63FF" />
    
            <Text style={styles.title}>YassDRC</Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => setCartModalVisible(true)}
            style={styles.cartIcon}
          >
            <Animated.View style={{ transform: [{ scale: cartScale }] }}>
              <Feather name="shopping-cart" size={24} color="#6C63FF" />
            </Animated.View>
            {cart.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Le marché dans la paume de votre main</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            placeholder="Rechercher un produit..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>

        {/* Categories */}
        
<ScrollView 
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.categoriesContainer}
  decelerationRate="fast"
  snapToInterval={100} // Pour un défilement plus fluide
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
      <Text style={[
        styles.categoryText,
        activeCategory === cat && styles.activeCategoryText
      ]}>
        {cat}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

        {/* Featured Products */}
        {filteredProducts.length > 0 && (
          <View style={styles.featuredContainer}>
            <Text style={styles.sectionTitle}>Produits en vedette</Text>
            <FlatList
              data={filteredProducts.slice(0, 3)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.featuredCard}
                  onPress={() => openProductDetails(item)}
                >
                  <OptimizedImage
                    source={{ uri: item.images[0] }}
                    style={styles.featuredImage}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.featuredGradient}
                  />
                  <View style={styles.featuredTextContainer}>
                    <Text style={styles.featuredName}>{item.name}</Text>
                    <Text style={styles.featuredPrice}>{item.price.toLocaleString()} CDF</Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.featuredList}
            />
          </View>
        )}
<Text style={styles.sectionTitle}>Tous les produits</Text>
{filteredProducts.length === 0 ? (
  <View style={styles.emptyContainer}>
    <Feather name="package" size={40} color="#999" />
    <Text style={styles.emptyText}>Aucun produit trouvé</Text>
  </View>
) : (
  <>
    <FlatList
      data={filteredProducts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={2}
      scrollEnabled={false}
      contentContainerStyle={styles.productsGrid}
    />
    {hasMore && (
      <TouchableOpacity 
        style={styles.loadMoreButton}
        onPress={handleLoadMore}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color="#6C63FF" />
        ) : (
          <Text style={styles.loadMoreText}>Charger plus</Text>
        )}
      </TouchableOpacity>
    )}
  </>
)}



{/* Add Product Modal */}
<Modal 
  visible={modalVisible} 
  animationType="slide" 
  transparent
  onRequestClose={() => setModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <ScrollView 
        contentContainerStyle={styles.modalContent}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Catégorie par boutons */}
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
              <Text style={[
                styles.categoryText,
                category === cat && styles.activeCategoryText
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Images */}
        <Text style={styles.inputLabel}>Images (max 3)</Text>
        <View style={styles.imageButtonsContainer}>
          <TouchableOpacity 
            style={styles.imageButton}
            onPress={takePhoto}
          >
            <Feather name="camera" size={20} color="#6C63FF" />
            <Text style={styles.imageButtonText}>Appareil photo</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageButton}
            onPress={pickImage}
          >
            <Feather name="image" size={20} color="#6C63FF" />
            <Text style={styles.imageButtonText}>Galerie</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={resetForm} style={{ marginTop: 10 }}>
          <Text style={{ color: '#6C63FF', textAlign: 'center' }}>Réinitialiser</Text>
        </TouchableOpacity>
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

        {/* Bouton publier avec confirmation */}
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


 {/* Product Detail Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={detailModalVisible}
  onRequestClose={closeDetailModal}
>
  <View style={styles.detailModalContainer}>
    <View style={styles.detailModalContent}>
      {selectedProduct ? (
        <>
          {selectedProduct.images && selectedProduct.images.length > 0 && (
            <OptimizedImage
              source={{ uri: selectedProduct.images[0] }}
              style={styles.detailModalImage}
            />
          )}
          
          <TouchableOpacity 
            style={styles.closeDetailModalButton} 
            onPress={closeDetailModal}
          >
            <Ionicons name="close-circle" size={30} color="#6C63FF" />
          </TouchableOpacity>

          <View style={styles.detailModalInfo}>
            <Text style={styles.detailModalName}>{selectedProduct.name}</Text>
            <Text style={styles.detailModalPrice}>
              {selectedProduct.price.toLocaleString()} CDF
            </Text>
            <Text style={styles.detailModalCategory}>
              Catégorie: {selectedProduct.category || "Non spécifiée"}
            </Text>
            <Text style={styles.detailModalDescription}>
              {selectedProduct.description}
            </Text>

            <Text style={styles.sellerInfoTitle}>Sécurisation des infos prsonnelles</Text>
            
            {sellerInfo ? (
              <TouchableOpacity 
                onPress={handleSellerNameClick} 
                style={styles.sellerInfoCard}
                activeOpacity={0.7}
              >
                <View style={styles.sellerImageContainer}>
                  {sellerInfo.photoBase64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${sellerInfo.photoBase64}` }}
                      style={styles.sellerPhoto}
                    />
                  ) : (
                    <View style={styles.sellerPhotoPlaceholder}>
                      <Ionicons name="person-circle-outline" size={50} color="#888" />
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
                  {sellerInfo.phoneNumber && (
                    <Text style={styles.sellerContact}>
                      <Ionicons name="call-outline" size={14} color="#6C63FF" /> 
                      {sellerInfo.phoneNumber}
                    </Text>
                  )}
                </View>

                <View style={styles.sellerAction}>
                  <Ionicons 
                    name="chatbox-ellipses-outline" 
                    size={28} 
                    color="#6C63FF" 
                  />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.sellerLoading}>
                <ActivityIndicator size="small" color="#6C63FF" />
                <Text style={styles.sellerLoadingText}>Hachage et cryptage en base64...</Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.detailAddToCartButton} 
              onPress={() => {
                if (selectedProduct) {
                  addToCart(selectedProduct);
                  closeDetailModal();
                }
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


      {/* Cart Modal */}
<Modal
  visible={cartModalVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setCartModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.cartModalContainer}>
      <View style={styles.cartModalHeader}>
        <Text style={styles.cartModalTitle}>Votre Panier</Text>
        <TouchableOpacity onPress={() => setCartModalVisible(false)}>
          <AntDesign name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyCartContainer}>
          <Feather name="shopping-cart" size={40} color="#ccc" />
          <Text style={styles.emptyCartText}>Votre panier est vide</Text>
          <TouchableOpacity 
            style={styles.continueShoppingBtn}
            onPress={() => setCartModalVisible(false)}
          >
            <Text style={styles.continueShoppingText}>Continuer vos achats</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView>
          {Object.entries(groupCartBySeller()).map(([sellerId, sellerItems]) => (
            <View key={sellerId} style={styles.sellerCartGroup}>
              <Text style={styles.sellerGroupTitle}>
                Nom du produit :  {products.find(p => p.sellerId === sellerId)?.name || 'Inconnu'}
              </Text>
              
              <FlatList
                data={sellerItems}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.cartItem}>
                     <Text>__</Text><OptimizedImage
                    source={{ uri: item.images[0] }}
                    style={styles.cartItemImage}
                  />
                
                    <View style={styles.cartItemDetails}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        {item.price.toLocaleString()} CDF
                      </Text>
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
                    <TouchableOpacity 
                      style={styles.removeItemBtn}
                      onPress={() => removeFromCart(item.id)}
                    >
                      <Feather name="trash-2" size={18} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                )}
                scrollEnabled={false}
              />
              
              <View style={styles.sellerTotalContainer}>
                <Text style={styles.sellerTotalText}>Total pour ce vendeur:</Text>
                <Text style={styles.sellerTotalAmount}>
                  {sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()} CDF
                </Text>
              </View>

              <TouchableOpacity 
  style={styles.checkoutBtn}
  onPress={async () => {
    setLoadingOrder(sellerId);
    try {
      if (!user?.id) {
        Alert.alert('Erreur', 'Vous devez être connecté pour passer commande');
        setLoadingOrder(null);
        return;
      }

      const orderRef = await addDoc(collection(db, 'orders'), {
        sellerId,
        buyerId: user.id,
        products: sellerItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          images: item.images,
          quantity: item.quantity
        })),
        total: sellerItems.reduce((sum: number, item) => sum + (item.price * item.quantity), 0),
        status: 'pending',
        createdAt: new Date(),
      });

      router.push({ pathname: '/confirm/[id]', params: { id: orderRef.id } });
      setCart(prev => prev.filter(item => !sellerItems.includes(item)));
      setCartModalVisible(false);
    } catch (error) {
      console.error("Erreur création commande:", error);
      Alert.alert("Erreur", "Impossible de créer la commande");
    } finally {
      setLoadingOrder(null);
    }
  }}
  disabled={loadingOrder === sellerId}
>
  {loadingOrder === sellerId ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.checkoutBtnText}>Commander chez ce vendeur</Text>
  )}
</TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  </View>
</Modal>

    </SafeAreaView>
    
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  
  overlayVisible: {
    display: 'flex',
  },
  
  overlayHidden: {
    display: 'none',
  },
  navDrawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#6C63FF',
    zIndex: 20,
    paddingTop: 60,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  navText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 15,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: '#F8F9FA',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginLeft: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  cartIcon: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },


  imageButtonsContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 15,
  gap: 10,
},

loadMoreButton: {
  padding: 15,
  backgroundColor: '#f5f5f5',
  borderRadius: 10,
  alignItems: 'center',
  marginHorizontal: 20,
  marginTop: 10,
},
loadMoreText: {
  color: '#6C63FF',
  fontWeight: 'bold',
},

imageButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
  paddingVertical: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#6C63FF',
},
imageButtonText: {
  marginLeft: 8,
  color: '#6C63FF',
  fontSize: 14,
},
imagePreviewContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: 10,
  gap: 10,
},
imagePreviewWrapper: {
  width: 80,
  height: 80,
  borderRadius: 10,
  position: 'relative',
},
imagePreview: {
  width: '100%',
  height: '100%',
  borderRadius: 10,
},
removeImageBtn: {
  position: 'absolute',
  top: 5,
  right: 5,
  backgroundColor: 'rgba(0,0,0,0.6)',
  width: 20,
  height: 20,
  borderRadius: 10,
  justifyContent: 'center',
  alignItems: 'center',
},
addImagePlaceholder: {
  width: 80,
  height: 80,
  borderRadius: 10,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ccc',
  borderStyle: 'dashed',
},


  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  categoryBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCategoryBtn: {
    backgroundColor: '#6C63FF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  activeCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  featuredContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  featuredList: {
    paddingHorizontal: 20,
  },
  featuredCard: {
    width: width * 0.7,
    height: 180,
    borderRadius: 15,
    marginRight: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  featuredTextContainer: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 15,
  },
  featuredName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  featuredPrice: {
    fontSize: 14,
    color: '#fff',
  },
  productsGrid: {
    paddingHorizontal: 15,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  cardImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },





  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  sellerInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginTop: 10, // Un peu d'espace avant le titre
  },
  sellerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Une couleur de fond légère pour la carte
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sellerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30, // Pour une forme circulaire
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#6C63FF', // Une petite bordure pour encadrer
  },
  sellerPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: '#e0e0e0', // Couleur de fond pour le placeholder
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerDetails: {
    flex: 1, // Prend l'espace restant
    justifyContent: 'center',
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
  sellerContact: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },



  ratingText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 10,
  },
  addToCartBtn: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
  fab: {
    position: 'absolute',
    right: 25,
    bottom: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C43aF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },


  imageLoadingContainer: {
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#f5f5f5',
},
imageErrorContainer: {
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#f5f5f5',
},
detailModalImage: {
  width: '100%',
  height: 250,
  resizeMode: 'cover',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},


  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  modalContent: {
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },



  // Dans votre StyleSheet.create()
sellerImageContainer: {
  marginRight: 15,
},


sellerCartGroup: {
  marginBottom: 25,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
  paddingBottom: 15,
},
sellerGroupTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 10,
  paddingLeft: 10,
},
sellerTotalContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 10,
  marginBottom: 15,
  paddingHorizontal: 10,
},
sellerTotalText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
},
sellerTotalAmount: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#6C63FF',
},

sellerAction: {
  marginLeft: 'auto',
  paddingLeft: 10,
},
sellerLoading: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 15,
  backgroundColor: '#f8f9fa',
  borderRadius: 10,
},
sellerLoadingText: {
  marginLeft: 10,
  color: '#666',
},




  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },






detailModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  detailModalContent: {
    width: '90%',
    height: '85%', // Ajustez la hauteur selon vos préférences
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden', // Pour que l'image ne dépasse pas les coins arrondis
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },

  closeDetailModalButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(255,255,255,0.8)', // Fond semi-transparent pour le bouton
    borderRadius: 20,
    padding: 2,
  },
  detailModalInfo: {
    padding: 20,
  },
  detailModalName: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  detailModalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6C63FF', // Couleur d'accent pour le prix
    marginBottom: 10,
  },
  detailModalCategory: {
    fontSize: 16,
    color: '#777',
    marginBottom: 15,
  },
  detailModalDescription: {
    fontSize: 10,
    color: '#555',
    lineHeight: 24, // Pour une meilleure lisibilité
    marginBottom: 20,
    height: 10

  },
  detailAddToCartButton: {
    backgroundColor: '#6C63FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%', // Prend toute la largeur disponible dans la modale
  },
  detailAddToCartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10, // Espace entre l'icône et le texte
  },

 







  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

 
  closeDetailModal: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageCarousel: {
    height: 300,
    width: '100%',
  },
  productDetailImage: {
    width: '100%',
    height: '100%',
  },
  productInfoContainer: {
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  productDetailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCategory: {
    fontSize: 14,
    color: '#6C63FF',
    marginBottom: 15,
  },
  productDetailPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 20,
  },
  productDetailDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 30,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  wishlistBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartDetailBtn: {
    flex: 1,
    marginLeft: 15,
    borderRadius: 25,
    backgroundColor: '#6C63FF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  addToCartDetailText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  cartModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cartModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyCartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    marginBottom: 25,
  },
  continueShoppingBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  continueShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartList: {
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cartItemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 15,
  },
  cartItemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 15,
    color: '#333',
  },

  // Ajoutez à l'objet StyleSheet.create
loadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(255,255,255,0.7)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
},


  removeItemBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartFooter: {
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  checkoutBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});