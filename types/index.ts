// types/index.ts

import { FieldValue } from 'firebase/firestore'; // Assurez-vous d'importer FieldValue

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  sellerId: string;
  sellerName: string;
  city: string;
  sellerPhotoUrl?: string;
  isSellerVerified?: boolean;
  createdAt: FieldValue;
  category?: string;
  star?: number;
}

export interface ProductData { // Utilisé pour la création de produit (sans l'ID généré par Firestore)
  name: string;
  description: string;
  price: number;
  images: string[];
  sellerId: string;
  sellerName: string;
  city: string;
  isSellerVerified?: boolean;
  createdAt: FieldValue;
  category: string; // Gardé comme string car une valeur par défaut est toujours fournie
  star?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export type SellerInfo = {
  email: string;
  name: string;
  photoUrl?: string | null;
  phoneNumber?: string;
  shopName?: string;
  isVerified: boolean;
};

export interface UserType { // Étendue avec les propriétés utilisées dans home.tsx
  uid: string; // L'ID utilisateur est essentiel
  email: string;
  name?: string;
  isSeller?: boolean; // Indique si l'utilisateur est un vendeur
  isVerified?: boolean; // Indique si le compte est vérifié
  address?: string; // Adresse de l'utilisateur
  city?: string; // Ville de l'utilisateur
  phoneNumber?: string; // Numéro de téléphone de l'utilisateur
  // Ajoutez d'autres propriétés d'utilisateur si nécessaire
}

// Pour les interfaces de style, importez de react-native
import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

export interface HomeStyles {
  // Styles généraux
  container: ViewStyle;
  loadingContainer: ViewStyle;
  errorContainer: ViewStyle;
  loaderText: TextStyle;
  // Header Styles
  header: ViewStyle;
  headerCenter: ViewStyle;
  title: TextStyle;
  cartIcon: ViewStyle;
  cartBadge: ViewStyle;
  cartBadgeText: TextStyle;
  // Search Bar Styles
  searchContainer: ViewStyle;
  searchIcon: TextStyle;
  searchInput: TextStyle;
  // Categories Styles
  categoriesContainer: ViewStyle;
  categoryBtn: ViewStyle;
  activeCategoryBtn: ViewStyle;
  categoryText: TextStyle;
  activeCategoryText: TextStyle;
  // Product Grid Styles
  productsGrid: ViewStyle;
  card: ViewStyle;
  cardImageContainer: ViewStyle;
  cardImage: ImageStyle; // Doit être ImageStyle
  ratingBadge: ViewStyle;
  ratingText: TextStyle;
  productName: TextStyle;
  productPrice: TextStyle;
  addToCartBtn: ViewStyle;
  checkoutButtonText: TextStyle;
  loadMoreButton: ViewStyle;
  loadMoreText: TextStyle;
  emptyContainer: ViewStyle;
  emptyText: TextStyle;
  loadingOverlay: ViewStyle;

  // Styles spécifiques aux modales (ProductAddModal, ProductDetailModal, CartModal)
  modalContainer: ViewStyle;
  modalView: ViewStyle;
  modalTitle: TextStyle;
  modalCloseButton: ViewStyle;
  modalCloseText: TextStyle;
  modalInput: TextStyle;
  modalButton: ViewStyle;
  modalButtonText: TextStyle;
  imagePickerButtons: ViewStyle;
  imagePreviewContainer: ViewStyle;
  imagePreview: ImageStyle;
  removeImageBtn: ViewStyle; // Bouton de suppression d'image (attention aux homonymes)
  removeImageText: TextStyle;
  imageCountText: TextStyle;
  modalProductImage: ImageStyle;
  modalProductDetailText: TextStyle;
  modalProductDetailPrice: TextStyle;
  quantitySelector: ViewStyle;
  quantityButton: ViewStyle;
  quantityDisplay: TextStyle;
  addToCartDetailBtn: ViewStyle;
  sellerInfoContainer: ViewStyle;
  sellerNameText: TextStyle;
  verifiedBadge: TextStyle;
  detailModalScrollContent: ViewStyle;
  descriptionContainer: ViewStyle;
  descriptionText: TextStyle;
  cartModalContent: ViewStyle;
  cartHeader: ViewStyle;
  cartItem: ViewStyle;
  cartItemDetails: ViewStyle;
  cartItemImage: ImageStyle;
  cartItemName: TextStyle;
  cartItemPrice: TextStyle;
  quantityControls: ViewStyle;
  quantityBtn: ViewStyle;
  quantityText: TextStyle;
  removeItemBtn: ViewStyle; // Bouton de suppression d'article du panier
  cartFooter: ViewStyle;
  cartTotalContainer: ViewStyle;
  cartTotalText: TextStyle;
  checkoutButton: ViewStyle;
  clearCartButton: ViewStyle;
  clearCartText: TextStyle;
  sellerCartGroup: ViewStyle;
  sellerGroupTitle: TextStyle;
  sellerTotalContainer: ViewStyle;
  sellerTotalText: TextStyle;

  // Styles pour le Drawer de Navigation
  drawerOverlay: ViewStyle;
  drawerContainer: ViewStyle;
  drawerHeader: ViewStyle;
  drawerHeaderText: TextStyle;
  drawerItem: ViewStyle;
  drawerItemText: TextStyle;
  drawerCloseButton: ViewStyle;
  drawerCloseButtonText: TextStyle;
  drawerProfileContainer: ViewStyle;
  drawerProfileName: TextStyle;
  drawerProfileEmail: TextStyle;
  signOutButton: ViewStyle;
  signOutButtonText: TextStyle;

  // Styles spécifiques pour les animations (overlay)
  overlayVisible: ViewStyle;
  overlayHidden: ViewStyle;
  imageLoadingContainer: ViewStyle; // Pour le composant OptimizedImage
}