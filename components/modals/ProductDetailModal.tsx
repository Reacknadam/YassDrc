import { Product, SellerInfo } from '../../types';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import OptimizedImage from '../OptimizedImage';

const { width } = Dimensions.get('window');

interface ImagePaginationProps {
  imagesCount: number;
  scrollX: Animated.Value;
}

const ImagePagination: React.FC<ImagePaginationProps> = ({ imagesCount, scrollX }) => {
  if (imagesCount === 0) return null;
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

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  sellerInfo: SellerInfo | null;
  isFavorite: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  onOpenSellerProducts: (sellerId: string, sellerName: string) => void;
  onOpenReview: () => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  visible,
  product,
  sellerInfo,
  isFavorite,
  onClose,
  onAddToCart,
  onToggleFavorite,
  onOpenSellerProducts,
  onOpenReview,
}) => {
  const productImagesScrollX = React.useRef(new Animated.Value(0)).current;

  if (!product) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailModalView}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close-circle-outline" size={30} color="#333" />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            <>
              <FlatList
                data={product.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <OptimizedImage source={{ uri: item }} style={styles.detailImage} />
                )}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: productImagesScrollX } } }],
                  { useNativeDriver: false }
                )}
              />
              <ImagePagination imagesCount={product.images.length} scrollX={productImagesScrollX} />
              <View style={styles.detailContent}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{product.name}</Text>
                  {product.star && (
                    <View style={styles.starRating}>
                      <AntDesign name="star" size={20} color="#FFD700" />
                      <Text style={styles.starTextLarge}>{product.star.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detailPrice}>{product.price.toLocaleString()} CDF</Text>
                <Text style={styles.detailDescription}>{product.description}</Text>

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
                  
                    <TouchableOpacity style={styles.seeSellerProductsBtn} onPress={() => onOpenSellerProducts(product.sellerId, sellerInfo.shopName || sellerInfo.name || 'Vendeur Anonyme')}>
                      <Text style={styles.seeSellerProductsBtnText}>Voir tous les produits de ce vendeur</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          </ScrollView>

          <View style={styles.detailFooter}>
            <TouchableOpacity style={styles.addToCartDetailBtn} onPress={() => onAddToCart(product)}>
              <Text style={styles.addToCartDetailText}>Ajouter au panier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.favoriteBtn} onPress={() => onToggleFavorite(product.id)}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={30}
                color={isFavorite ? "#FF6F61" : "#888"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewBtn} onPress={onOpenReview}>
              <Text style={styles.reviewBtnText}>Avis</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalView: {
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 15,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 15,
  },
  detailImage: {
    width: width,
    height: width,
  },
  imagePaginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: width - 30,
    alignSelf: 'center',
  },
  imageDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1}
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
  favoriteBtn: {
    padding: 10,
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderRadius: 10,
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
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starTextLarge: {
    fontSize: 18,
    color: '#333',
    marginLeft: 6,
    fontWeight: 'bold',
  },
});

export default ProductDetailModal;
