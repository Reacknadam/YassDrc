import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { AntDesign, Feather, Ionicons } from '@expo/vector-icons';
import { Product } from '../../types';
import OptimizedImage from '../../components/OptimizedImage';

interface ProductCardProps {
  product: Product;
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
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity style={styles.card} onPress={() => onPress(product)} activeOpacity={0.8}>
        <View style={styles.cardImageContainer}>
          {product.images && product.images.length > 0 ? (
            <OptimizedImage source={{ uri: product.images[0] }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.imageLoadingContainer]}>
              <Feather name="image" size={40} color="#ccc" />
            </View>
          )}
          <TouchableOpacity
            style={styles.addToCartBtn}
            onPress={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#FF6F61' : '#fff'}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>
            {product.star && (
              <View style={styles.starRating}>
                <AntDesign name="star" size={14} color="#FFD700" />
                <Text style={styles.starText}>{product.star.toFixed(1)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.productPrice}>{product.price.toLocaleString()} CDF</Text>
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
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({


  container: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  card: {
    width: '60%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    backgroundColor: '#f0f0f0',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 4,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 5,
  },
  sellerAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  sellerNameText: {
    fontSize: 11,
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
});

export default ProductCard;