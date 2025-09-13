import { useAuth } from '@/context/AuthContext';
import { db, storage } from '@/firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePickerExpo from 'expo-image-picker';
import { router, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import moment from 'moment';
import 'moment/locale/fr';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View
} from 'react-native';

// =================================================================================
// CONSTANTES
// =================================================================================
const SCREEN_WIDTH = Dimensions.get('window').width;
const SUBSCRIPTION_COLLECTION = 'subscriptions';
const DEFAULT_SUBSCRIPTION_PRICE = 5000;

// =================================================================================
// INTERFACES & TYPES
// =================================================================================

type LoadingStates = {
  profile: boolean;
  sellerForm: boolean;
  payment: boolean;
  products: boolean;
  orders: boolean;
  promotions: boolean;
  profileEdit: boolean;
  subscriptionPrice: boolean;
  reports: boolean;
  reviews: boolean;
  activity: boolean;
};

type ActiveTab = 'profile' | 'orders' | 'products' | 'stats' | 'activity' | 'settings' | 'promotions' | 'reviews';

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  isDefault: boolean;
}


interface ManualConfirmationModalProps { 
  visible: boolean; 
  onClose: () => void; 
  onConfirm: (confirmationCode: string, smsMessage: string) => void;
  loading: boolean;
  authUser: any; // Ajoutez cette ligne
}


interface Promotion {
  id: string;
  code: string;
  discountPercentage: number;
  expiresAt: Timestamp;
  isActive: boolean;
}

interface UserProfile {
  email: string;
  name?: string;
  id: string;
  photoUrl?: string | null;
  phoneNumber?: string | null;
  isSellerRequested?: boolean;
  isSellerVerified?: boolean;
  sellerForm?: SellerForm;
  sellerRequestId?: string;
  photoBase64?: string | null;
  uid?: string;
  paymentId?: string;
  paymentStatus?: 'idle' | 'pending' | 'success' | 'failed' | 'saved';
  paymentPhoneNumber?: string;
  selectedProvider?: string | null;
  notificationsEnabled?: boolean;
  theme?: 'light' | 'dark';
  addresses?: Address[];
  vacationMode?: boolean;
  subscriptionExpiry?: Timestamp;
}

interface SellerForm {
  shopName: string;
  idNumber: string;
  idType: string;
  businessDescription: string;
  phoneNumber: string;
  location: string;
  address: string;
  isAdult: boolean;
}

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  productName: string;
  totalPrice: number;
  deliveryLocation: string;
  deliveryAddress: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Timestamp;
  productId: string;
  quantity: number;
  sellerId: string;
  trackingNumber?: string;
  statusHistory: {
    status: Order['status'];
    timestamp: Timestamp;
    note?: string;
  }[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  images: string[];
  sellerId: string;
  createdAt: Timestamp;
  star: number;
  reviews?: Review[];
  stock: number;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
  productId: string;
}

interface UserActivity {
  id: string;
  type: 'order' | 'product_added' | 'product_updated' | 'profile_updated' | 'seller_request' | 'promotion_added' | 'report_submitted' | 'review_added';
  description: string;
  timestamp: Timestamp;
}

interface Report {
  id: string;
  type: 'technical' | 'payment' | 'product' | 'user' | 'other';
  description: string;
  status: 'new' | 'in_progress' | 'resolved';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
}

interface PromotionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (promotion: Omit<Promotion, 'id' | 'isActive'>) => void;
}

interface PromotionsTabProps {
  promotions: Promotion[];
  onAddPromotion: () => void;
  onTogglePromotion: (promotionId: string, currentStatus: boolean) => void;
  onDeletePromotion: (promotionId: string) => void;
  loading: boolean;
}

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ProductModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  sellerId: string;
  onProductSaved: () => void;
}

interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, newStatus: Order['status'], tracking?: string, note?: string) => void;
  isSeller: boolean;
}

interface SellerFormModalProps {
  visible: boolean;
  onClose: () => void;
  sellerForm: SellerForm;
  setSellerForm: React.Dispatch<React.SetStateAction<SellerForm>>;
  onSubmitForm: () => void;
  loading: boolean;
  subscriptionPrice: number;
}

interface OrdersTabProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  loading: boolean;
}

interface ProductsTabProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  loading: boolean;
}

interface StatsTabProps {
  stats: {
    productsCount: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
    activePromotions: number;
    averageRating: number;
  };
  loading: boolean;
}

interface ActivityTabProps {
  activities: UserActivity[];
  loading: boolean;
}

interface SettingsTabProps {
  onLogout: () => void;
  onDeleteAccount: () => void;
  userProfile: UserProfile | null;
  updateProfileSettings: (settings: Partial<UserProfile>) => void;
  onChangePassword: () => void;
  onManageAddresses: () => void;
  onEditProfile: () => void;
  onOpenReportModal: () => void;
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onSave: (newProfile: { photoUrl?: string | null; phoneNumber?: string | null }) => void;
  loading: boolean;
}

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: { type: Report['type']; description: string }) => void;
  loading: boolean;
}

interface ReviewsTabProps {
  reviews: Review[];
  loading: boolean;
}

// =================================================================================
// STYLES
// =================================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 100,
    paddingTop: 30,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editProfileButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#6C63FF',
  },
  tabText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
  tabContentContainer: {
    flex: 1,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitleConfirm: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'center',
  },
  actionButton: {
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  confirmDeleteButton: {
    backgroundColor: '#FF6347',
  },
  cancelDeleteButton: {
    backgroundColor: '#eee',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
    padding: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  orderStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  detailSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
  },
  timelineContainer: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
    marginTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C63FF',
    position: 'absolute',
    left: -6,
    top: 4,
  },
  timelineContent: {
    marginLeft: 14,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineDate: {
    fontSize: 12,
    color: '#999',
  },
  timelineNote: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  orderActions: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  confirmOrderButton: {
    backgroundColor: '#28A745',
  },
  shipOrderButton: {
    backgroundColor: '#FFC107',
  },
  deliverButton: {
    backgroundColor: '#6C63FF',
  },
  statusPending: {
    color: '#FFC107',
  },
  statusConfirmed: {
    color: '#007BFF',
  },
  statusShipped: {
    color: '#6C63FF',
  },
  statusDelivered: {
    color: '#28A745',
  },
  statusCancelled: {
    color: '#FF6347',
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addProductButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  productImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  productPrice: {
    fontSize: 15,
    color: '#6C63FF',
    fontWeight: '600',
    marginTop: 4,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  productStock: {
    fontSize: 12,
    color: '#999',
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 6,
    backgroundColor: '#007BFF',
    borderRadius: 20,
    marginLeft: 6,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: '#FF6347',
    borderRadius: 20,
    marginLeft: 6,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  filterButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#6C63FF',
    marginBottom: 5,
  },
  activeFilter: {
    backgroundColor: '#6C63FF',
  },
  filterText: {
    color: '#6C63FF',
    fontSize: 12,
  },
  activeFilterText: {
    color: '#fff',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  orderStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderProduct: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderBuyer: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C63FF',
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  ordersList: {
    paddingBottom: 16,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6E4FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  imagePickerButtonText: {
    marginLeft: 10,
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 14,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  deleteImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  formStepContainer: {
    flex: 1,
  },
  formStepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  paymentStepContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  paymentIcon: {
    marginBottom: 10,
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  subscriptionCard: {
    backgroundColor: '#E6E4FF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 8,
  },
  subscriptionPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginTop: 4,
  },
  subscriptionPeriod: {
    fontSize: 13,
    color: '#6C63FF',
    opacity: 0.8,
  },
  subscriptionFeatures: {
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  featureText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  providerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  providerButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  selectedProviderButton: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  providerButtonText: {
    color: '#333',
    fontSize: 14,
  },
  selectedProviderButtonText: {
    color: '#fff',
  },
  paymentStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  paymentStatusText: {
    marginLeft: 8,
    color: '#6C63FF',
  },
  paymentSuccessText: {
    marginLeft: 8,
    color: '#28A745',
    fontWeight: '600',
  },
  paymentFailedText: {
    marginLeft: 8,
    color: '#FF6347',
    fontWeight: '600',
  },
  retryButton: {
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#007BFF',
    fontWeight: '600',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  statIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E6E4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    marginLeft: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityIcon: {
    marginRight: 8,
  },
  activityType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  activityDescription: {
    fontSize: 13,
    color: '#666',
  },
  activityTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
    marginLeft: 12,
    color: '#333',
  },
  settingIcon: {
    width: 30,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#FF6347',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteAccountButton: {
    backgroundColor: '#FF6347',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  promotionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promotionCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  promotionStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#28A745',
  },
  promotionInfo: {
    marginTop: 8,
  },
  promotionDiscount: {
    fontSize: 14,
    color: '#333',
  },
  promotionExpiry: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  promotionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  promotionActionButton: {
    marginLeft: 12,
  },
  sellerProfileContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sellerStatusIcon: {
    marginBottom: 10,
  },
  sellerStatusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  sellerStatusText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  requestSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginTop: 16,
  },
  requestSellerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

// =================================================================================
// COMPOSANTS ENFANTS
// =================================================================================

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ visible, title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler" }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.centeredView}>
        <Animated.View style={[styles.modalView, { opacity: fadeAnim }]}>
          <Ionicons name="alert-circle-outline" size={50} color="#FFC107" style={{ marginBottom: 15 }} />
          <Text style={styles.modalTitleConfirm}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.actionButton, styles.confirmDeleteButton]} onPress={onConfirm}>
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.cancelDeleteButton]} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: '#333' }]}>{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};









const [userProfile, setUserProfile] = useState<UserProfile | null>(null);





const ProductModal: React.FC<ProductModalProps> = ({ visible, onClose, product, sellerId, onProductSaved }) => {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price || '');
  const [category, setCategory] = useState(product?.category || '');
  const [stock, setStock] = useState(product?.stock ? String(product.stock) : '0');
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [loading, setLoading] = useState(false);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePickerExpo.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Veuillez autoriser l'accès à votre galerie dans les paramètres.");
      return;
    }

    const pickerResult = await ImagePickerExpo.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) return;

    try {
      setLoading(true);
      const imageUri = pickerResult.assets[0].uri;
      const imagePath = `products/${sellerId}/${Date.now()}_${imageUri.split('/').pop()}`;
      const imageUrl = await uploadImageAsync(imageUri, imagePath);
      
      setImages((prev: string[]) => [...prev, imageUrl]);
    } catch (error) {
      console.error('Erreur upload image: ', error);
      Alert.alert('Erreur', "Impossible d'uploader l'image.");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);
  const handleSaveProduct = async () => {
    if (!name || !description || !price || !category || images.length === 0 || !stock) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs et ajouter au moins une image.');
      return;
    }

    if (parseInt(stock) < 0) {
      Alert.alert('Stock invalide', 'Le stock ne peut pas être négatif.');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name,
        description,
        price: parseFloat(price).toFixed(2),
        category,
        images,
        sellerId,
        stock: parseInt(stock),
        createdAt: serverTimestamp(),
        star: product?.star || 0,
      };

      if (product) {
        await updateDoc(doc(db, 'products', product.id), {
          ...productData,
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Succès', 'Produit mis à jour avec succès !');
      } else {
        await addDoc(collection(db, 'products'), productData);
        Alert.alert('Succès', 'Produit ajouté avec succès !');
      }
      onProductSaved();
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde produit: ', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le produit.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = (indexToDelete: number) => {
    setImages((prev: string[]) => prev.filter((_, i) => i !== indexToDelete));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{product ? 'Modifier le Produit' : 'Ajouter un Produit'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom du produit</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom du produit" />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description détaillée"
              multiline
            />
            
            <Text style={styles.inputLabel}>Prix (CDF)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="numeric"
            />
            
            <Text style={styles.inputLabel}>Catégorie</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Ex: Électronique, Vêtements"
            />
            
            <Text style={styles.inputLabel}>Stock</Text>
            <TextInput
              style={styles.input}
              value={stock}
              onChangeText={setStock}
              placeholder="Quantité disponible"
              keyboardType="numeric"
            />
            
            <Text style={styles.inputLabel}>Images ({images.length} ajoutée{images.length > 1 ? 's' : ''})</Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={24} color="#6C63FF" />
              <Text style={styles.imagePickerButtonText}>Choisir une image</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewContainer}>
                {images.map((imgBase64, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <Image source={{ uri: `data:image/jpeg;base64,${imgBase64}` }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.deleteImageButton}
                      onPress={() => handleDeleteImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF6347" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSaveProduct}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{product ? 'Sauvegarder' : 'Ajouter le Produit'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const OrderModal: React.FC<OrderModalProps> = ({ visible, onClose, order, onStatusChange, isSeller }) => {
  const [trackingNumber, setTrackingNumber] = useState(order?.trackingNumber || '');
  const [statusNote, setStatusNote] = useState('');
  
  if (!order) return null;

  const statusMap: Record<Order['status'], { text: string; style: StyleProp<TextStyle>; icon: string }> = {
    pending: { text: 'En attente', style: styles.statusPending, icon: 'hourglass-outline' },
    confirmed: { text: 'Confirmée', style: styles.statusConfirmed, icon: 'checkmark-circle-outline' },
    shipped: { text: 'Expédiée', style: styles.statusShipped, icon: 'car-outline' },
    delivered: { text: 'Livrée', style: styles.statusDelivered, icon: 'checkmark-done-outline' },
    cancelled: { text: 'Annulée', style: styles.statusCancelled, icon: 'close-circle-outline' },
  };

  const currentStatus = statusMap[order.status] || statusMap.pending;

  const handleStatusChangeAction = (newStatus: Order['status']) => {
    if (isSeller && newStatus === 'shipped' && !trackingNumber) {
      Alert.alert('Numéro de suivi requis', 'Veuillez entrer un numéro de suivi avant d\'expédier la commande.');
      return;
    }
    onStatusChange(order.id, newStatus, trackingNumber, statusNote);
  };
    
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Détails de la Commande</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.orderStatusHeader}>
              <Ionicons name={currentStatus.icon as any} size={30} color={(currentStatus.style as any).color} />
              <Text style={[styles.orderStatusText, currentStatus.style]}>{currentStatus.text}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>ID Commande:</Text>
              <Text style={styles.detailValue}>#{order.id.slice(0, 10)}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Produit:</Text>
              <Text style={styles.detailValue}>{order.productName}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Quantité:</Text>
              <Text style={styles.detailValue}>{order.quantity}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Prix Total:</Text>
              <Text style={styles.detailValue}>{(order.totalPrice || 0).toFixed(2)} </Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Acheteur:</Text>
              <Text style={styles.detailValue}>{order.buyerName}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Lieu de Livraison:</Text>
              <Text style={styles.detailValue}>{order.deliveryLocation}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Adresse de Livraison:</Text>
              <Text style={styles.detailValue}>{order.deliveryAddress}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Date de la commande:</Text>
              <Text style={styles.detailValue}>{order.createdAt?.toDate().toLocaleString()}</Text>
            </View>
            
            {isSeller && order.status === 'shipped' && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Numéro de suivi:</Text>
                <Text style={styles.detailValue}>{order.trackingNumber || 'Non renseigné'}</Text>
              </View>
            )}

            {/* Historique du statut */}
            <Text style={styles.sectionSubtitle}>Historique du statut</Text>
            <View style={styles.timelineContainer}>
              {order.statusHistory?.map((status, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStatus, statusMap[status.status].style]}>
                      {statusMap[status.status].text}
                    </Text>
                    <Text style={styles.timelineDate}>
                      {moment(status.timestamp.toDate()).format('DD MMM YYYY, HH:mm')}
                    </Text>
                    {status.note && (
                      <Text style={styles.timelineNote}>{status.note}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Actions pour le vendeur */}
            {isSeller && (
              <View style={styles.orderActions}>
                {order.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.submitButton, styles.confirmOrderButton]}
                    onPress={() => handleStatusChangeAction('confirmed')}

                  >
                    <Text style={styles.submitButtonText}>Confirmer la Commande</Text>
                  </TouchableOpacity>
                )}
                
                {order.status === 'confirmed' && (
                  <>
                    <Text style={styles.inputLabel}>Numéro de suivi</Text>
                    <TextInput
                      style={styles.input}
                      value={trackingNumber}
                      onChangeText={setTrackingNumber}
                      placeholder="Entrez le numéro de suivi"
                    />
                    <TouchableOpacity
                      style={[styles.submitButton, styles.shipOrderButton]}
                      onPress={() => handleStatusChangeAction('shipped')}
                    >
                      <Text style={styles.submitButtonText}>Marquer comme Expédié</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                {order.status === 'shipped' && (
                  <TouchableOpacity
                    style={[styles.submitButton, styles.deliverButton]}
                    onPress={() => handleStatusChangeAction('delivered')}
                  >
                    <Text style={styles.submitButtonText}>Marquer comme Livrée</Text>
                  </TouchableOpacity>
                )}
                
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <>
                    <Text style={styles.inputLabel}>Note (optionnelle)</Text>
                    <TextInput
                      style={styles.input}
                      value={statusNote}
                      onChangeText={setStatusNote}
                      placeholder="Ajouter une note"
                    />
                    <TouchableOpacity
                      style={[styles.cancelButton, { marginTop: 10 }]}
                      onPress={() => handleStatusChangeAction('cancelled')}
                    >
                      <Text style={styles.cancelButtonText}>Annuler la Commande</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            
            <TouchableOpacity style={[styles.cancelButton, { marginTop: 20 }]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Fermer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const SellerFormModal: React.FC<SellerFormModalProps> = ({
  visible,
  onClose,
  sellerForm,
  setSellerForm,
  onSubmitForm,
  loading,
  subscriptionPrice
}) => {
  const isFormValid = useMemo(() => {
    return (
      sellerForm.shopName.trim() !== '' &&
      sellerForm.businessDescription.trim() !== '' &&
      sellerForm.phoneNumber.trim() !== '' &&
      sellerForm.location.trim() !== '' &&
      sellerForm.address.trim() !== '' &&
      sellerForm.isAdult
    );
  }, [sellerForm]);

  const provincesRDC = [
    "Bas-Uele", "Haut-Uele", "Ituri", "Nord-Kivu", "Sud-Kivu",
    "Équateur", "Tshuapa", "Mongala", "Nord-Ubangi", "Sud-Ubangi",
    "Kasaï", "Kasaï-Central", "Kasaï-Oriental", "Kwango", "Kwilu",
    "Mai-Ndombe", "Sankuru", "Maniema", "Haut-Lomami", "Lomami",
    "Tanganyika", "Haut-Katanga", "Lualaba", "Haut-Kasaï", "Kinshasa", "Kongo-Central"
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <View style={{ flex: 1, margin: 20, backgroundColor: '#fff', borderRadius: 15, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#6C63FF' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Devenir Vendeur</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Informations du Vendeur</Text>
            <Text style={{ color: '#666', marginBottom: 20 }}>Remplissez ces informations pour enregistrer votre profil vendeur.</Text>

            {/* Nom de la Boutique */}
            <Text style={{ marginBottom: 5, fontWeight: '500' }}>Nom de la Boutique</Text>
            <TextInput
              style={{ backgroundColor: '#f0f0f0', borderRadius: 8, padding: 10, marginBottom: 15 }}
              placeholder="Ex: Mon Super Magasin"
              value={sellerForm.shopName}
              onChangeText={text => setSellerForm(prev => ({ ...prev, shopName: text }))}
            />

            {/* Catégorie d'activité */}
            <Text style={{ marginBottom: 5, fontWeight: '500' }}>Catégorie d'activité</Text>
            <View style={{ backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15 }}>
              <Picker
                selectedValue={sellerForm.businessDescription}
                onValueChange={itemValue => setSellerForm(prev => ({ ...prev, businessDescription: itemValue }))}>
                <Picker.Item label="Sélectionnez une catégorie" value="" />
                <Picker.Item label="Vêtements" value="Vêtements" />
                <Picker.Item label="Électronique" value="Électronique" />
                <Picker.Item label="Alimentation" value="Alimentation" />
                <Picker.Item label="Autre" value="Autre" />
              </Picker>
            </View>

            {/* Téléphone */}
            <Text style={{ marginBottom: 5, fontWeight: '500' }}>Numéro de Téléphone</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, marginBottom: 15 }}>
              <Text style={{ marginRight: 5, fontWeight: 'bold' }}>+243</Text>
              <TextInput
                style={{ flex: 1, height: 40 }}
                placeholder="999 999 999"
                keyboardType="phone-pad"
                value={sellerForm.phoneNumber}
                onChangeText={text => {
                  let formatted = text.replace(/[^0-9]/g, '');
                  if (formatted && !formatted.startsWith('9')) formatted = '9' + formatted;
                  setSellerForm(prev => ({ ...prev, phoneNumber: formatted }));
                }}
                maxLength={9}
              />
            </View>

            {/* Province */}
            <Text style={{ marginBottom: 5, fontWeight: '500' }}>Province</Text>
            <View style={{ backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15 }}>
              <Picker
                selectedValue={sellerForm.location}
                onValueChange={itemValue => setSellerForm(prev => ({ ...prev, location: itemValue }))}>
                <Picker.Item label="Sélectionnez une province" value="" />
                {provincesRDC.map(province => (
                  <Picker.Item key={province} label={province} value={province} />
                ))}
              </Picker>
            </View>

            {/* Adresse */}
            <Text style={{ marginBottom: 5, fontWeight: '500' }}>Adresse Complète</Text>
            <TextInput
              style={{ backgroundColor: '#f0f0f0', borderRadius: 8, padding: 10, height: 60, textAlignVertical: 'top', marginBottom: 15 }}
              placeholder="Ex: Av. De la Paix, Q. Les Volcans, N°123"
              value={sellerForm.address}
              onChangeText={text => setSellerForm(prev => ({ ...prev, address: text }))}
              multiline
            />

            {/* Switch 18+ */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
              <Text style={{ fontWeight: '500' }}>J'ai plus de 18 ans</Text>
              <Switch
                trackColor={{ false: '#ccc', true: '#6C63FF' }}
                thumbColor={sellerForm.isAdult ? '#6C63FF' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={value => setSellerForm(prev => ({ ...prev, isAdult: value }))}
                value={sellerForm.isAdult}
              />
            </View>

            {/* Bouton Submit */}
            <TouchableOpacity
              style={{
                backgroundColor: isFormValid ? '#6C63FF' : '#aaa',
                paddingVertical: 15,
                borderRadius: 10,
                alignItems: 'center',
                marginBottom: 30
              }}
              onPress={onSubmitForm}
              disabled={!isFormValid || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Envoyer la demande</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};




const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose, userProfile, onSave, loading }) => {
  const { authUser } = useAuth(); // Ajouter useAuth
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(userProfile?.photoUrl || null);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePickerExpo.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Veuillez autoriser l'accès à votre galerie dans les paramètres.");
      return;
    }

    const pickerResult = await ImagePickerExpo.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) return;

    try {
      const imageUri = pickerResult.assets[0].uri;
      const imagePath = `profiles/${authUser?.id}/${Date.now()}_${imageUri.split('/').pop()}`;
      const uploadedUrl = await uploadImageAsync(imageUri, imagePath);
      
      setPhotoUrl(uploadedUrl);
    } catch (error) {
      console.error('Erreur upload image: ', error);
      Alert.alert('Erreur', "Impossible d'uploader l'image.");
    }
  }, [authUser]);

  const handleSave = () => {
    onSave({ photoUrl, phoneNumber }); // Changer photoBase64 par photoUrl
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier le Profil</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Photo de profil</Text>
            <View style={styles.avatarContainer}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={60} color="#ccc" />
                </View>
              )}
              <TouchableOpacity style={styles.editIconOverlay} onPress={handlePickImage}>
                <Ionicons name="camera" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Numéro de téléphone</Text>
<View style={{ 
  flexDirection: 'row', 
  alignItems: 'center', 
  borderWidth: 1, 
  borderColor: '#ccc', 
  borderRadius: 8, 
  paddingHorizontal: 10 
}}>
  <Text style={{ marginRight: 5, fontWeight: 'bold' }}>+243</Text>
  <TextInput
    style={{ flex: 1, height: 40 }}
    value={phoneNumber}
    onChangeText={(text) => {
      // Supprime tout sauf les chiffres
      let formatted = text.replace(/[^0-9]/g, '');
      // Forcer à commencer par 9
      if (formatted && !formatted.startsWith('9')) {
        formatted = '9' + formatted;
      }
      setPhoneNumber(formatted);
    }}
    placeholder="999 999 999"
    keyboardType="phone-pad"
    maxLength={9} 
  />
</View>


            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Sauvegarder</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
















// Fonction pour uploader une image vers Firebase Storage
const uploadImageAsync = async (uri: string, path: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  
  return await getDownloadURL(storageRef);
};


// en haut de ton composant Profile (ou dans le bon onglet)
const [transactionId, setTransactionId] = useState("");
const [smsMessage, setSmsMessage] = useState("");
const operatorId = userProfile?.uid || ""; // ID de l’utilisateur connecté

const { authUser } = useAuth();


const sendManualConfirmation = async (
  transactionId: string,
  confirmationMessage: string,
  operatorId: string,
  authUser: UserProfile | null
) => {
  if (!authUser) {
    Alert.alert('Erreur', "Utilisateur non connecté.");
    return;
  }

  try {
    await addDoc(collection(db, 'manual-confirm'), {
      transactionId,
      confirmationMessage,
      operatorId,
      createdAt: serverTimestamp(),
      user: {
  id: authUser.id,
  email: authUser.email,
  name: authUser.name,
  isSellerVerified: authUser.isSellerVerified ?? false,
  photoUrl: authUser.photoUrl ?? null,
  phoneNumber: authUser.phoneNumber ?? null,
  sellerForm: authUser.sellerForm || null,
},
    });

    Alert.alert('Succès', 'Le message de confirmation a été envoyé.');
  } catch (error) {
    console.error("Erreur lors de l'envoi de la confirmation manuelle: ", error);
    Alert.alert('Erreur', "Impossible d'envoyer le message de confirmation.");
  }
};





const OrdersTab: React.FC<OrdersTabProps> = ({ orders, onSelectOrder, loading }) => {
  const [filter, setFilter] = useState<'all' | Order['status']>('all');
  const filteredOrders = filter === 'all' ? orders : orders.filter(order => order.status === filter);
  const statusCounts = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<Order['status'], number>);
  }, [orders]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des commandes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vos Commandes ({orders.length})</Text>
        <View style={styles.filterContainer}>
          <TouchableOpacity style={[styles.filterButton, filter === 'all' && styles.activeFilter]} onPress={() => setFilter('all')} >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>Toutes</Text>
          </TouchableOpacity>
          {Object.entries(statusCounts).map(([status, count]) => (
            <TouchableOpacity key={status} style={[styles.filterButton, filter === status && styles.activeFilter]} onPress={() => setFilter(status as Order['status'])} >
              <Text style={[styles.filterText, filter === status && styles.activeFilterText]}>
                {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.orderCard} onPress={() => onSelectOrder(item)}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                <Text
                  style={[
                    styles.orderStatus,
                    item.status === 'pending' ? styles.statusPending : item.status === 'confirmed' ? styles.statusConfirmed : item.status === 'shipped' ? styles.statusShipped : item.status === 'delivered' ? styles.statusDelivered : styles.statusCancelled
                  ]}
                >
                  {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Inconnu'}
                </Text>
              </View>
              <Text style={styles.orderProduct}>{item.productName}</Text>
              <Text style={styles.orderBuyer}>Client: {item.buyerName}</Text>
              <Text style={styles.orderTotal}>{(item.totalPrice || 0).toFixed(2)} </Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderDate}>
                  {item.createdAt?.toDate().toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune commande pour le moment.</Text>
        </View>
      )}
    </View>
  );
};

const ProductsTab: React.FC<ProductsTabProps> = ({ products, onAddProduct, onEditProduct, onDeleteProduct, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des produits...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentContainer}>
      <View style={styles.productsHeader}>
        <Text style={styles.sectionTitle}>Vos Produits ({products.length})</Text>
        <TouchableOpacity style={styles.addProductButton} onPress={onAddProduct}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addProductButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
      {products.length > 0 ? (
        <FlatList
          data={products}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <View style={styles.productImageContainer}>
                {item.images && item.images.length > 0 ? (
                  <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                  <Ionicons name="image-outline" size={50} color="#999" />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price} </Text>
                <View style={styles.productMeta}>
                  <Text style={styles.productCategory}>{item.category}</Text>
                  <Text style={styles.productStock}>Stock: {item.stock || 0}</Text>
                </View>
              </View>
              <View style={styles.productActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => onEditProduct(item)}>
                  <Ionicons name="create-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteProduct(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          keyExtractor={item => item.id}
          
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bag-handle-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucun produit ajouté pour le moment.</Text>
        </View>
      )}
    </View>
  );
};

const StatsTab: React.FC<StatsTabProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Calcul des statistiques...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContentContainer}>
      <Text style={styles.sectionTitle}>Statistiques de Vente</Text>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: '#E6E4FF' }]}>
          <Ionicons name="cube-outline" size={30} color="#6C63FF" />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{stats.productsCount || 0}</Text>
          <Text style={styles.statLabel}>Produits en ligne</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: '#D4EDDA' }]}>
          <Ionicons name="checkmark-done-circle-outline" size={30} color="#28A745" />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{stats.completedOrders || 0}</Text>
          <Text style={styles.statLabel}>Commandes livrées</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: '#FFEDD5' }]}>
          <Ionicons name="hourglass-outline" size={30} color="#FFC107" />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{stats.pendingOrders || 0}</Text>
          <Text style={styles.statLabel}>Commandes en attente</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: '#F8D7DA' }]}>
          <Ionicons name="cash-outline" size={30} color="#FF6347" />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{(stats.totalRevenue || 0).toFixed(2)} </Text>
          <Text style={styles.statLabel}>Revenu total</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: '#D1ECF1' }]}>
          <Ionicons name="star-outline" size={30} color="#17A2B8" />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{(stats.averageRating || 0).toFixed(1)}</Text>
          <Text style={styles.statLabel}>Note moyenne</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const ActivityTab: React.FC<ActivityTabProps> = ({ activities, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des activités...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentContainer}>
      <Text style={styles.sectionTitle}>Votre Activité Récente</Text>
      {activities.length > 0 ? (
        <FlatList
          data={activities}
          renderItem={({ item }) => (
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Ionicons name="arrow-forward-circle-outline" size={24} color="#6C63FF" style={styles.activityIcon} />
                <Text style={styles.activityType}>{item.type.replace('_', ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</Text>
              </View>
              <Text style={styles.activityDescription}>{item.description}</Text>
              <Text style={styles.activityTimestamp}>{moment(item.timestamp.toDate()).fromNow()}</Text>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune activité récente.</Text>
        </View>
      )}
    </View>
  );
};

const SettingsTab: React.FC<SettingsTabProps> = ({ onLogout, onDeleteAccount, userProfile, updateProfileSettings, onChangePassword, onManageAddresses, onEditProfile, onOpenReportModal }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(userProfile?.notificationsEnabled || false);

  useEffect(() => {
    setNotificationsEnabled(userProfile?.notificationsEnabled || false);
  }, [userProfile]);

  const toggleNotifications = (value: boolean) => {
    setNotificationsEnabled(value);
    updateProfileSettings({ notificationsEnabled: value });
  };

  return (
    <ScrollView style={styles.tabContentContainer}>
      <Text style={styles.sectionTitle}>Paramètres du Compte</Text>
      <TouchableOpacity style={styles.settingItem} onPress={onEditProfile}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIcon}>
            <Ionicons name="person-circle-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Modifier le profil</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={onManageAddresses}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIcon}>
            <Ionicons name="location-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Gérer les adresses</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={onChangePassword}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIcon}>
            <Ionicons name="lock-closed-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Changer le mot de passe</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/upload-qr')}>
  <View style={styles.settingLeft}>
    <Ionicons name="qr-code" size={24} color="#6C63FF" />
    <Text style={styles.settingText}>Ajouter mes QR codes Mobile Money</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color="#ccc" />
</TouchableOpacity>



      <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
         
          <View style={styles.settingIcon}>
            <Ionicons name="notifications-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Notifications</Text>
        </View>
        <Switch
          trackColor={{ false: '#767577', true: '#6C63FF' }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleNotifications}
          value={notificationsEnabled}
        />
      </View>
      <Text style={styles.sectionTitle}>Assistance</Text>
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/(tabs)/help')}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIcon}>
            <Ionicons name="help-circle-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Centre d'aide / FAQ</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={onOpenReportModal}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIcon}>
            <Ionicons name="bug-outline" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.settingText}>Signaler un problème</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Danger Zone</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.submitButtonText}>Se déconnecter</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAccountButton} onPress={onDeleteAccount}>
        <Text style={styles.submitButtonText}>Supprimer le compte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const ReportModal: React.FC<ReportModalProps> = ({ visible, onClose, onSubmit, loading }) => {
  const [reportType, setReportType] = useState<Report['type']>('technical');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Champs requis', 'Veuillez décrire le problème.');
      return;
    }
    onSubmit({ type: reportType, description });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Signaler un Problème</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Type de rapport</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={reportType}
                onValueChange={(itemValue) => setReportType(itemValue)}
              >
                <Picker.Item label="Problème technique" value="technical" />
                <Picker.Item label="Problème de paiement" value="payment" />
                <Picker.Item label="Problème de produit" value="product" />
                <Picker.Item label="Problème d'utilisateur" value="user" />
                <Picker.Item label="Autre" value="other" />
              </Picker>
            </View>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez le problème en détail..."
              multiline
            />
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Envoyer le rapport</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};


const ManualConfirmationModal: React.FC<{ 
  visible: boolean; 
  onClose: () => void; 
  onConfirm: (confirmationCode: string, smsMessage: string) => void;
  loading: boolean;
  authUser: any;
}> = ({ visible, onClose, onConfirm, loading, authUser }) => {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  useEffect(() => {
    if (!visible) {
      setConfirmationCode('');
      setSmsMessage('');
    }
  }, [visible]);


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmation Manuelle</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Si vous avez reçu un message de confirmation de transaction, veuillez le saisir ci-dessous.
            </Text>
            
            <Text style={styles.inputLabel}>Message de confirmation de confirmation de la transaction selon l'operateur </Text>
            <TextInput
              style={styles.input}
              value={confirmationCode}
              onChangeText={setConfirmationCode}
              placeholder="Entrez le message reçu par SMS"
            />
            
          <TouchableOpacity
  style={styles.submitButton}
  onPress={() => sendManualConfirmation(
    transactionId,
    confirmationCode,
    operatorId,
    authUser
      ? {
          ...authUser,
          sellerForm: authUser.sellerForm && 'idNumber' in authUser.sellerForm
            ? authUser.sellerForm as SellerForm
            : undefined
        }
      : null
  )}
>
  <Text style={styles.submitButtonText}>Envoyer la confirmation</Text>
</TouchableOpacity>

            
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};








const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des avis...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentContainer}>
      <Text style={styles.sectionTitle}>Vos Avis (Total: {reviews.length})</Text>
      {reviews.length > 0 ? (
        <FlatList
          data={reviews}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor}>{item.author}</Text>
                <View style={styles.ratingContainer}>
                  {[...Array(5)].map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < item.rating ? "star" : "star-outline"}
                      size={16}
                      color="#FFC107"
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewComment}>{item.comment}</Text>
              <Text style={styles.reviewDate}>{moment(item.createdAt?.toDate()).fromNow()}</Text>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbox-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucun avis pour le moment.</Text>
        </View>
      )}
    </View>
  );
};

const PromotionModal: React.FC<PromotionModalProps> = ({ visible, onClose, onSave }) => {
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  const handleSave = () => {
    if (!code || !discountPercentage || !expiryDate) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    const discount = parseInt(discountPercentage);
    if (isNaN(discount) || discount < 1 || discount > 100) {
      Alert.alert('Pourcentage invalide', 'Le pourcentage doit être un nombre entre 1 et 100.');
      return;
    }
    onSave({ code, discountPercentage: discount, expiresAt: Timestamp.fromDate(expiryDate) });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ajouter une Promotion</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Code de la promotion</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Ex: ETE2025"
            />
            <Text style={styles.inputLabel}>Pourcentage de réduction</Text>
            <TextInput
              style={styles.input}
              value={discountPercentage}
              onChangeText={setDiscountPercentage}
              placeholder="Ex: 15"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Date d'expiration</Text>
            {/* Vous devrez ajouter un DatePicker ici. Pour l'instant, c'est un TextInput */}
            <TextInput
              style={styles.input}
              placeholder="Ex: YYYY-MM-DD"
              value={expiryDate ? moment(expiryDate).format('YYYY-MM-DD') : ''}
              onChangeText={(text) => setExpiryDate(new Date(text))}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleSave}>
              <Text style={styles.submitButtonText}>Sauvegarder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const PromotionsTab: React.FC<PromotionsTabProps> = ({ promotions, onAddPromotion, onTogglePromotion, onDeletePromotion, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des promotions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentContainer}>
      <View style={styles.productsHeader}>
        <Text style={styles.sectionTitle}>Vos Promotions ({promotions.length})</Text>
        <TouchableOpacity style={styles.addProductButton} onPress={onAddPromotion}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addProductButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
      {promotions.length > 0 ? (
        <FlatList
          data={promotions}
          renderItem={({ item }) => (
            <View style={styles.promotionCard}>
              <View style={styles.promotionHeader}>
                <Text style={styles.promotionCode}>{item.code}</Text>
                <Text style={[styles.promotionStatus, { color: item.isActive ? '#28A745' : '#666' }]}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.promotionInfo}>
                <Text style={styles.promotionDiscount}>-{item.discountPercentage}% de réduction</Text>
                <Text style={styles.promotionExpiry}>Expire le: {moment(item.expiresAt.toDate()).format('DD/MM/YYYY')}</Text>
              </View>
              <View style={styles.promotionActions}>
                <TouchableOpacity style={styles.promotionActionButton} onPress={() => onTogglePromotion(item.id, item.isActive)}>
                  <Ionicons name={item.isActive ? "pause-circle-outline" : "play-circle-outline"} size={24} color="#007BFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.promotionActionButton} onPress={() => onDeletePromotion(item.id)}>
                  <Ionicons name="trash-outline" size={24} color="#FF6347" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune promotion active.</Text>
        </View>
      )}
    </View>
  );
};

// =================================================================================
// COMPOSANT PRINCIPAL
// =================================================================================

const Profile = () => {
  const { authUser, logout } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [paymentPhoneNumber, setPaymentPhoneNumber] = useState(userProfile?.paymentPhoneNumber || '');
const [selectedProvider, setSelectedProvider] = useState<string | null>(userProfile?.selectedProvider || null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  // en haut de ton composant Profile (ou dans le bon onglet)
const [transactionId, setTransactionId] = useState("");
const [smsMessage, setSmsMessage] = useState("");
const operatorId = authUser?.id || ""; // ID de l’utilisateur connecté

  const [loading, setLoading] = useState<LoadingStates>({
    profile: true,
    sellerForm: false,
    payment: false,
    products: false,
    orders: false,
    promotions: false,
    profileEdit: false,
    subscriptionPrice: true,
    reports: false,
    reviews: false,
    activity: false,
  });
  const [sellerForm, setSellerForm] = useState<SellerForm>({
    shopName: '',
    idNumber: '',
    idType: '',
    businessDescription: '',
    phoneNumber: '',
    location: '',
    address: '',
    isAdult: false,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [manualConfirmationModal, setManualConfirmationModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(DEFAULT_SUBSCRIPTION_PRICE);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [sellerFormModalVisible, setSellerFormModalVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [stats, setStats] = useState({
    productsCount: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    activePromotions: 0,
    averageRating: 0,
  });

  const isSeller = userProfile?.isSellerVerified;

  const fetchUserProfile = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(prev => ({ ...prev, profile: true }));
    const docRef = doc(db, 'users', authUser.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setUserProfile({ ...data, email: authUser.email! });
      } else {
        Alert.alert("Erreur", "Profil utilisateur introuvable.");
        setUserProfile({ id: authUser.id, email: authUser.email! });
      }
      setLoading(prev => ({ ...prev, profile: false }));
    });
    return unsubscribe;
  }, [authUser]);

  const fetchSellerData = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(prev => ({ ...prev, products: true, orders: true, promotions: true }));

    const productsQuery = query(collection(db, 'products'), where('sellerId', '==', authUser.id));
    const ordersQuery = query(collection(db, 'orders'), where('sellerId', '==', authUser.id), orderBy('createdAt', 'desc'));
    const promotionsQuery = query(collection(db, 'promotions'), where('sellerId', '==', authUser.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const fetchedProducts: Product[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(fetchedProducts);
      setLoading(prev => ({ ...prev, products: false }));
    });

const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
  const fetchedOrders: Order[] = snapshot.docs.map(doc => {
    const orderData = doc.data();
    const status = orderData.status || 'Inconnu'; // Default value if status is missing
    return {
      id: doc.id,
      ...orderData,
      status: typeof status === 'string' ? status : 'Inconnu'
    };
  }) as Order[];
  setOrders(fetchedOrders);
  setLoading(prev => ({ ...prev, orders: false }));
});
    const unsubscribePromotions = onSnapshot(promotionsQuery, (snapshot) => {
      const fetchedPromotions: Promotion[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Promotion[];
      setPromotions(fetchedPromotions);
      setLoading(prev => ({ ...prev, promotions: false }));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribePromotions();
    };
  }, [authUser]);

  const fetchActivities = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(prev => ({ ...prev, activity: true }));
    const q = query(collection(db, 'activities'), where('userId', '==', authUser.id), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedActivities: UserActivity[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserActivity[];
      setActivities(fetchedActivities);
      setLoading(prev => ({ ...prev, activity: false }));
    });
    return unsubscribe;
  }, [authUser]);

  const fetchReviews = useCallback(async () => {
    if (!isSeller) return;
    setLoading(prev => ({ ...prev, reviews: true }));
    const reviewsRef = collection(db, 'reviews');
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(query(productsRef, where('sellerId', '==', authUser?.id)));
    const productIds = productsSnapshot.docs.map(doc => doc.id);
    if (productIds.length > 0) {
      const q = query(reviewsRef, where('productId', 'in', productIds), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedReviews: Review[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Review[];
        setReviews(fetchedReviews);
      });
      setLoading(prev => ({ ...prev, reviews: false }));
      return unsubscribe;
    } else {
      setReviews([]);
      setLoading(prev => ({ ...prev, reviews: false }));
    }
    return () => {};
  }, [authUser, isSeller]);

  const calculateStats = useCallback(() => {
    const productsCount = products.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const activePromotions = promotions.filter(p => p.isActive && p.expiresAt.toDate() > new Date()).length;
    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    setStats({
      productsCount,
      pendingOrders,
      completedOrders,
      totalRevenue,
      activePromotions,
      averageRating,
    });
  }, [products, orders, promotions, reviews]);

  const fetchSubscriptionPrice = useCallback(async () => {
    setLoading(prev => ({ ...prev, subscriptionPrice: true }));
    const docRef = doc(db, SUBSCRIPTION_COLLECTION, 'sellerSubscription');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubscriptionPrice(data.price || DEFAULT_SUBSCRIPTION_PRICE);
      } else {
        setSubscriptionPrice(DEFAULT_SUBSCRIPTION_PRICE);
      }
    } catch (e) {
      console.error("Error fetching subscription price: ", e);
      setSubscriptionPrice(DEFAULT_SUBSCRIPTION_PRICE);
    } finally {
      setLoading(prev => ({ ...prev, subscriptionPrice: false }));
    }
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    const setup = async () => {
      unsubscribeProfile = await fetchUserProfile();
    };
    setup();
    fetchSubscriptionPrice();
    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [fetchUserProfile, fetchSubscriptionPrice]);

  useEffect(() => {
    let unsubscribeSellerData: (() => void) | undefined;
    let unsubscribeReviews: (() => void) | undefined;

    if (isSeller) {
      const setupSeller = async () => {
        unsubscribeSellerData = await fetchSellerData();
      };
      const setupReviews = async () => {
        unsubscribeReviews = await fetchReviews();
      };
      setupSeller();
      setupReviews();
    }
    return () => {
      if (unsubscribeSellerData) unsubscribeSellerData();
      if (unsubscribeReviews) unsubscribeReviews();
    };
  }, [isSeller, fetchSellerData, fetchReviews]);

  useEffect(() => {
    let unsubscribeActivities: (() => void) | undefined;
    const setupActivities = async () => {
      unsubscribeActivities = await fetchActivities();
    };
    setupActivities();
    return () => {
      if (unsubscribeActivities) unsubscribeActivities();
    };
  }, [fetchActivities]);

  useEffect(() => {
    if (activeTab === 'stats') {
      calculateStats();
    }
  }, [activeTab, products, orders, promotions, reviews, calculateStats]);

  const handleEditProfile = () => {
    setEditProfileModalVisible(true);
  };

  const handleSaveProfile = async (newProfile: { photoUrl?: string | null; phoneNumber?: string | null }) => {
  if (!authUser?.id) return;
  setLoading(prev => ({ ...prev, profileEdit: true }));
  try {
    await updateDoc(doc(db, 'users', authUser.id), newProfile);
    Alert.alert('Succès', 'Profil mis à jour avec succès !');
    setEditProfileModalVisible(false);
  } catch (e) {
    console.error("Error updating profile: ", e);
    Alert.alert('Erreur', 'Impossible de mettre à jour le profil.');
  } finally {
    setLoading(prev => ({ ...prev, profileEdit: false }));
  }
};
  const handleDeleteAccount = () => {
    setConfirmationModal({
      visible: true,
      title: 'Supprimer le compte',
      message: 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, visible: false });
        // Logique de suppression du compte ici
        Alert.alert('Info', 'Fonctionnalité de suppression de compte non implémentée.');
      },
    });
  };

  const handleLogout = () => {
    setConfirmationModal({
      visible: true,
      title: 'Déconnexion',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, visible: false });
        await logout();
        router.push('/');
      },
    });
  };





/* Annuler : on supprime la demande et on remet tout à zéro */
const handleCancelRequest = () => {
  Alert.alert(
    'Annuler la demande',
    'Êtes-vous sûr de vouloir annuler votre demande de vendeur ?',
    [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          if (!authUser?.id) return;
          try {
            // 1. Supprimer la demande Firestore (si elle existe)
            if (userProfile?.sellerRequestId) {
              await deleteDoc(doc(db, 'sellerRequests', userProfile.sellerRequestId));
            }
            // 2. Remettre le profil à l’état initial
            await updateDoc(doc(db, 'users', authUser.id), {
              isSellerRequested: false,
              sellerRequestId: null,
              sellerForm: null,
              paymentStatus: 'idle',
              depositStatus: 'NOT_REQUIRED',
            });
            Alert.alert('Succès', 'Votre demande a été annulée.');
          } catch (e) {
            console.error('Erreur annulation : ', e);
            Alert.alert('Erreur', 'Impossible d’annuler la demande.');
          }
        },
      },
    ]
  );
};






  const handleManualConfirmation = async (confirmationCode: string, smsMessage: string) => {
  if (!authUser?.id) {
    Alert.alert("Erreur", "Utilisateur non authentifié");
    return;
  }

  setLoading(prev => ({ ...prev, sellerForm: true }));
  try {
    await addDoc(collection(db, 'manual-confirm'), {
      transactionId: confirmationCode?.trim() || "",     // si vide → ""
      confirmationMessage: smsMessage?.trim() || "",     // si vide → ""
      operatorId: authUser.id,
      userEmail: authUser.email || "",
      userName: authUser.email || "",
      userPhone: authUser.phoneNumber || "",
      status: "pending",                                // par défaut
      createdAt: serverTimestamp(),
    });

    Alert.alert('Succès', 'Le message de confirmation a été envoyé.');
    setManualConfirmationModal(false);
  } catch (error) {
    console.error("Erreur lors de l'envoi de la confirmation manuelle: ", error);
    Alert.alert("Erreur", "Impossible d'envoyer le message de confirmation.");
  } finally {
    setLoading(prev => ({ ...prev, sellerForm: false }));
  }
};









const handleSellerFormSubmit = async () => {
  if (!authUser?.id) return;
  setLoading(prev => ({ ...prev, sellerForm: true }));
  
  try {
    const requestRef = await addDoc(collection(db, 'sellerRequests'), {
      ...sellerForm,
      userId: authUser.id,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    
    await updateDoc(doc(db, 'users', authUser.id), {
      isSellerRequested: true,
      sellerForm,
      sellerRequestId: requestRef.id,
    });

    router.push(`/subs?phone=${sellerForm.phoneNumber}&provider=${sellerForm.idType}&amount=${subscriptionPrice}&userId=${authUser.id}`);
    
  } catch (e) {
    console.error("Error submitting seller form: ", e);
    Alert.alert('Erreur', 'Impossible de soumettre le formulaire.');
  } finally {
    setLoading(prev => ({ ...prev, sellerForm: false }));
    setSellerFormModalVisible(false);
  }
};

  const handleRestartPayment = () => {
    if (authUser?.id) {
      updateDoc(doc(db, 'users', authUser.id), { paymentStatus: 'idle' });
      setUserProfile(prev => prev ? { ...prev, paymentStatus: 'idle' } : prev);
    }
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setProductModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductModalVisible(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setConfirmationModal({
      visible: true,
      title: 'Supprimer le produit',
      message: 'Êtes-vous sûr de vouloir supprimer ce produit ?',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, visible: false });
        try {
          await deleteDoc(doc(db, 'products', productId));
          Alert.alert('Succès', 'Produit supprimé avec succès !');
        } catch (e) {
          console.error("Error deleting product: ", e);
          Alert.alert('Erreur', 'Impossible de supprimer le produit.');
        }
      },
    });
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setOrderModalVisible(true);
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: Order['status'], tracking?: string, note?: string) => {
    if (!authUser?.id) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as Order;
        const newStatusHistory = [...(orderData.statusHistory || []), {
          status: newStatus,
          timestamp: serverTimestamp(),
          note: note || '',
        }];

        const updateData: any = {
          status: newStatus,
          statusHistory: newStatusHistory,
        };

        if (newStatus === 'shipped' && tracking) {
          updateData.trackingNumber = tracking;
        }

        await updateDoc(orderRef, updateData);
        Alert.alert('Succès', `Statut de la commande mis à jour vers "${newStatus}".`);
      }
    } catch (e) {
      console.error("Error updating order status: ", e);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut de la commande.');
    }
  };

  const handleAddPromotion = () => {
    Alert.alert('Info', 'Fonctionnalité d\'ajout de promotion non implémentée.');
  };

  const handleTogglePromotion = async (promotionId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'promotions', promotionId), {
        isActive: !currentStatus,
      });
      Alert.alert('Succès', `Promotion ${!currentStatus ? 'activée' : 'désactivée'}.`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de changer le statut de la promotion.');
    }
  };

  const handleDeletePromotion = (promotionId: string) => {
    setConfirmationModal({
      visible: true,
      title: 'Supprimer la promotion',
      message: 'Êtes-vous sûr de vouloir supprimer cette promotion ?',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, visible: false });
        try {
          await deleteDoc(doc(db, 'promotions', promotionId));
          Alert.alert('Succès', 'Promotion supprimée avec succès !');
        } catch (e) {
          console.error("Error deleting promotion: ", e);
          Alert.alert('Erreur', 'Impossible de supprimer la promotion.');
        }
      },
    });
  };

  const handleOpenReportModal = () => {
    setReportModalVisible(true);
  };

  const handleReportSubmit = async (report: { type: Report['type']; description: string }) => {
    if (!authUser?.id) return;
    setLoading(prev => ({ ...prev, reports: true }));
    try {
      await addDoc(collection(db, 'reports'), {
        ...report,
        userId: authUser.id,
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Succès', 'Votre rapport a été soumis. Nous vous répondrons dès que possible.');
      setReportModalVisible(false);
    } catch (e) {
      console.error("Error submitting report: ", e);
      Alert.alert('Erreur', 'Impossible de soumettre le rapport.');
    } finally {
      setLoading(prev => ({ ...prev, reports: false }));
    }
  };

  const renderTabContent = () => {
  switch (activeTab) {
    case 'profile':
      return (
        <ScrollView style={styles.tabContentContainer}>
          <View style={styles.sellerProfileContainer}>
            {userProfile?.isSellerRequested && !userProfile.isSellerVerified ? (
              <>
                <Ionicons name="hourglass-outline" size={80} color="#FFC107" style={styles.sellerStatusIcon} />
                <Text style={styles.sellerStatusTitle}>Demande en cours</Text>
                <TouchableOpacity 
                  style={[styles.requestSellerButton, { marginTop: 10, backgroundColor: '#FFA500' }]} 
                  onPress={() => setManualConfirmationModal(true)}
                >
                  <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                  <Text style={styles.requestSellerButtonText}>Confirmer manuellement</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.requestSellerButton, { backgroundColor: '#007AFF', marginTop: 10 }]}
                  onPress={() => router.push('/subs')}
                >
                  <Ionicons name="refresh" size={24} color="#fff" />
                  <Text style={styles.requestSellerButtonText}>Recommencer le paiement</Text>
                </TouchableOpacity>
                
                {/* ✅ AJOUTE CES DEUX BOUTONS */}
    <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
     

      <TouchableOpacity
        style={[styles.requestSellerButton, { backgroundColor: '#FF6347', flex: 1 }]}
        onPress={handleCancelRequest}
      >
        <Ionicons name="close" size={24} color="#fff" />
        <Text style={styles.requestSellerButtonText}>Annuler</Text>
      </TouchableOpacity>
    </View>
                <Text style={styles.sellerStatusText}>
                  Votre demande pour devenir vendeur est en cours de traitement.
                  {userProfile.paymentStatus === 'pending' && (
                    "\nPaiement en cours de validation..."
                  )}
                </Text>
              </>
            ) : userProfile?.isSellerVerified ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="checkmark-circle" size={80} color="#28A745" style={styles.sellerStatusIcon} />
                <Text style={styles.sellerStatusTitle}>Vous êtes vendeur vérifié !</Text>
                <Text style={styles.sellerStatusText}>
                  Accédez à vos outils de gestion via les onglets ci-dessus.
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="business-outline" size={80} color="#6C63FF" style={styles.sellerStatusIcon} />
                <Text style={styles.sellerStatusTitle}>Devenir Vendeur</Text>
                <Text style={styles.sellerStatusText}>
                  Montez en grade et vendez vos produits sur notre plateforme. Remplissez le formulaire et payez l'abonnement pour commencer.
                </Text>
                <TouchableOpacity style={styles.requestSellerButton} onPress={() => setSellerFormModalVisible(true)}>
                  <Ionicons name="arrow-forward" size={24} color="#fff" />
                  <Text style={styles.requestSellerButtonText}>Devenir Vendeur</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      );
      
      
      case 'orders':
        return <OrdersTab orders={orders} onSelectOrder={handleOrderSelect} loading={loading.orders} />;
      case 'products':
        return <ProductsTab products={products} onAddProduct={handleAddProduct} onEditProduct={handleEditProduct} onDeleteProduct={handleDeleteProduct} loading={loading.products} />;
      case 'stats':
        return <StatsTab stats={stats} loading={loading.orders || loading.products || loading.promotions || loading.reviews} />;
      case 'activity':
        return <ActivityTab activities={activities} loading={loading.activity} />;
      case 'settings':
        return <SettingsTab
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          userProfile={userProfile}
          updateProfileSettings={async (settings) => {
            if (authUser?.id) {
              await updateDoc(doc(db, 'users', authUser.id), settings);
              setUserProfile(prev => prev ? { ...prev, ...settings } : null);
            }
          }}
          onChangePassword={() => Alert.alert('Fonction non disponible', 'La modification du mot de passe n\'est pas encore implémentée.')}
          onManageAddresses={() => Alert.alert('Fonction non disponible', 'La gestion des adresses n\'est pas encore implémentée.')}
          onEditProfile={handleEditProfile}
          onOpenReportModal={handleOpenReportModal}
        />;
      case 'promotions':
        return <PromotionsTab promotions={promotions} onAddPromotion={handleAddPromotion} onTogglePromotion={handleTogglePromotion} onDeletePromotion={handleDeletePromotion} loading={loading.promotions} />;
      case 'reviews':
        return <ReviewsTab reviews={reviews} loading={loading.reviews} />;
      default:
        return null;
    }
  };

  if (loading.profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {userProfile?.photoUrl ? (
  <Image source={{ uri: userProfile.photoUrl }} style={styles.avatar} />
) : (
  <View style={styles.avatarPlaceholder}>
    <Ionicons name="person" size={60} color="#ccc" />
  </View>
)}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userProfile?.name || 'Utilisateur'}</Text>
            
            <Text style={styles.userEmail}>{userProfile?.email}</Text>
          </View>
          <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
            <Ionicons name="create-outline" size={20} color="#6C63FF" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'profile' && styles.activeTab]} onPress={() => setActiveTab('profile')}>
            <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Vendeur</Text>
          </TouchableOpacity>
          {isSeller && (
            <>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'orders' && styles.activeTab]} onPress={() => setActiveTab('orders')}>
                <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>Commandes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'products' && styles.activeTab]} onPress={() => setActiveTab('products')}>
                <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Produits</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'stats' && styles.activeTab]} onPress={() => setActiveTab('stats')}>
                <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>Statistiques</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'promotions' && styles.activeTab]} onPress={() => setActiveTab('promotions')}>
                <Text style={[styles.tabText, activeTab === 'promotions' && styles.activeTabText]}>Promos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'reviews' && styles.activeTab]} onPress={() => setActiveTab('reviews')}>
                <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Avis</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={[styles.tabButton, activeTab === 'activity' && styles.activeTab]} onPress={() => setActiveTab('activity')}>
            <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>Activité</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'settings' && styles.activeTab]} onPress={() => setActiveTab('settings')}>
            <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Paramètres</Text>
          </TouchableOpacity>
        </ScrollView>

        {renderTabContent()}

        <SellerFormModal
  visible={sellerFormModalVisible}
  onClose={() => setSellerFormModalVisible(false)}
  sellerForm={sellerForm}
  setSellerForm={setSellerForm}
  onSubmitForm={handleSellerFormSubmit}
  loading={loading.sellerForm}
  subscriptionPrice={subscriptionPrice}
/>
        <ProductModal
          visible={productModalVisible}
          onClose={() => setProductModalVisible(false)}
          product={selectedProduct}
          sellerId={authUser?.id || ''}
          onProductSaved={() => {
            setProductModalVisible(false);
            setProducts([]); // Trigger reload
          }}
        />
        <OrderModal
          visible={orderModalVisible}
          onClose={() => setOrderModalVisible(false)}
          order={selectedOrder}
          onStatusChange={handleOrderStatusChange}
          isSeller={isSeller || false}
        />
        <EditProfileModal
          visible={editProfileModalVisible}
          onClose={() => setEditProfileModalVisible(false)}
          userProfile={userProfile}
          onSave={handleSaveProfile}
          loading={loading.profileEdit}
        />
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
          loading={loading.reports}
        />
       
<ManualConfirmationModal
  visible={manualConfirmationModal}
  onClose={() => setManualConfirmationModal(false)}
  onConfirm={handleManualConfirmation}
  loading={loading.sellerForm}
  authUser={authUser} // Ajoutez cette ligne
/> 

        <ConfirmationModal
          visible={confirmationModal.visible}
          title={confirmationModal.title}
          message={confirmationModal.message}
          onConfirm={confirmationModal.onConfirm}
          onCancel={() => setConfirmationModal({ ...confirmationModal, visible: false })}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
