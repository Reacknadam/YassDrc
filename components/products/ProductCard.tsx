import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import OptimizedImage from '../../components/OptimizedImage';
import { Product } from '../../types'; // Assurez-vous d'ajouter promotionTag à votre type Product

interface ProductCardProps {
  product: Product & { promotionTag?: string }; // Ajout de la promotion ici
  isFavorite: boolean;
  onPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  index: number;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isFavorite,
  onPress,
  onAddToCart,
  onToggleFavorite,
  index,
}) => {
  // L'animation est conservée, elle est excellente !
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={[
        styles.cardWrapper, // Style pour le conteneur dans la FlatList
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity style={styles.card} onPress={() => onPress(product)} activeOpacity={0.9}>
        <View style={styles.cardImageContainer}>
          {product.images && product.images.length > 0 ? (
            <OptimizedImage source={{ uri: product.images[0] }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.imageLoadingContainer]}>
              <Feather name="image" size={40} color="#ccc" />
            </View>
          )}

          {/* ✨ NOUVEAU : Badge de mise en avant */}
          {product.promotionTag && (
            <View style={styles.promotionBanner}>
              <Text style={styles.promotionText}>{product.promotionTag}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#FF6F61' : '#333'}
            />
          </TouchableOpacity>
        </View>

        {/* --- NOUVELLE STRUCTURE D'INFORMATION --- */}
        <View style={styles.cardInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          
          <Text style={styles.productPrice}>
            {typeof product.price === 'number' 
              ? product.price.toLocaleString() 
              : product.price || '0'
            } CDF
          </Text>

          <View style={styles.bottomRow}>
            <View style={styles.sellerInfo}>
              {product.sellerPhotoUrl ? (
                <Image source={{ uri: product.sellerPhotoUrl }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Ionicons name="person" size={12} color="#888" />
                </View>
              )}
              <Text style={styles.sellerNameText} numberOfLines={1}>
                {product.sellerName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addToCartBtn}
              onPress={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- NOUVEAUX STYLES ---
const styles = StyleSheet.create({
  // NOUVEAU: Conteneur pour la FlatList. Assure un espacement correct dans une grille à 2 colonnes.
  cardWrapper: {
    width: '50%',
    padding: 6,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
    borderColor: '#f0f0f0',
    borderWidth: 1,
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // NOUVEAU: Style du badge de promotion
  promotionBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#FFD700', // Jaune Or pour la visibilité
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  promotionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    minHeight: 34, // Espace pour 2 lignes
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C63FF', // Couleur conservée
    marginVertical: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Permet au texte de prendre l'espace disponible
    marginRight: 8,
  },
  sellerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sellerAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerNameText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
    flex: 1,
  },
  addToCartBtn: {
    backgroundColor: '#6C63FF', // Couleur conservée
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Les styles de rating et de localisation peuvent être ajoutés ici si nécessaire
});

export default ProductCard;