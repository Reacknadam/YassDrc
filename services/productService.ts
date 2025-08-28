import { db } from '@/firebase/config';
import { addDoc, collection, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export interface SellerInfo {
  email: string;
  name?: string;
  photoBase64?: string | null;
  phoneNumber?: string;
  shopName?: string;
}

export interface ProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  sellerId: string;
  star?: number;
  sellerName: string;
  sellerPhotoUrl: string;
  createdAt?: any;
  updatedAt?: any;
  sellerInfo?: SellerInfo; // <-- Ajouté ici
}

export const createProduct = async (product: ProductData) => {
  const docRef = await addDoc(collection(db, 'products'), {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'published'
  });
  return docRef.id;
};

export const updateProduct = async (productId: string, updates: Partial<ProductData>) => {
  await updateDoc(doc(db, 'products', productId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};