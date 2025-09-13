// context/AuthContext.tsx
import { db } from '@/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// =================================================================================
// INTERFACES & TYPES
// =================================================================================

type UserType = {
  id: string;
  email: string;
  name: string;
  isSellerVerified?: boolean;
  photoBase64?: string;
  shopName?: string;
  photoUrl?: string;
  phoneNumber?: string;
  sellerForm?: {
    phoneNumber?: string;
    shopName?: string;
  };
};

type AuthContextType = {
  authUser: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  isAuthenticated: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  isSeller: boolean;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const router = useRouter();

  // Charger l'utilisateur depuis AsyncStorage
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson) {
          const parsed = JSON.parse(userJson) as UserType;
          setAuthUser(parsed);
          setIsSeller(!!parsed.isSellerVerified);
        }
      } catch (err) {
        console.error('Erreur de chargement:', err);
        setError('Erreur de chargement de la session');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // 🔥 Écoute en temps réel du statut vendeur
  useEffect(() => {
    if (!authUser?.id) return;

    const userRef = doc(db, 'users', authUser.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const verified = data.isSellerVerified || false;
        setIsSeller(verified);

        // Optionnel : mettre à jour aussi l’objet authUser local
        setAuthUser((prev) =>
          prev ? { ...prev, isSellerVerified: verified } : null
        );
      }
    });

    return () => unsubscribe();
  }, [authUser?.id]);

  // ========================================
  // LOGIN DIRECT FIRESTORE
  // ========================================
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const passwordHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const userDoc = doc(db, 'users', email);
      const userSnap = await getDoc(userDoc);

      if (!userSnap.exists()) {
        setError("Utilisateur non trouvé");
        return false;
      }

      const userData = userSnap.data() as UserType & { passwordHash: string };
      if (userData.passwordHash !== passwordHash) {
        setError("Mot de passe incorrect");
        return false;
      }

      const userToStore: UserType = {
        id: email,
        email: userData.email,
        name: userData.name,
        isSellerVerified: userData.isSellerVerified,
        photoBase64: userData.photoBase64,
        shopName: userData.shopName,
        photoUrl: userData.photoUrl,
        phoneNumber: userData.phoneNumber,
        sellerForm: userData.sellerForm,
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userToStore));
      setAuthUser(userToStore);
      setIsSeller(!!userData.isSellerVerified);
      return true;
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Erreur lors de la connexion. Veuillez réessayer.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // REGISTER DIRECT FIRESTORE
  // ========================================
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const userDoc = doc(db, 'users', email);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        setError("Cet email est déjà utilisé");
        return false;
      }

      const passwordHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const newUser: UserType & { passwordHash: string } = {
        id: email,
        email,
        name,
        passwordHash,
        isSellerVerified: false,
      };

      await setDoc(userDoc, newUser);
      await AsyncStorage.setItem('@user', JSON.stringify(newUser));
      setAuthUser(newUser);
      setIsSeller(false);
      return true;
    } catch (err) {
      console.error('Erreur d\'inscription:', err);
      setError('Erreur lors de l\'inscription. Veuillez réessayer.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // LOGOUT
  // ========================================
  const logout = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem('@user');
      setAuthUser(null);
      setIsSeller(false);
      router.replace('/login');
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
      setError('Erreur lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // DELETE ACCOUNT
  // ========================================
  const deleteUserAccount = async () => {
    if (!authUser) {
      setError("Aucun utilisateur connecté");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userDoc = doc(db, 'users', authUser.email);
      await deleteDoc(userDoc);
      await logout();
      setError("Compte supprimé avec succès");
    } catch (err) {
      console.error('Erreur lors de la suppression du compte:', err);
      setError('Erreur lors de la suppression du compte');
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!authUser;

  return (
    <AuthContext.Provider
      value={{
        authUser,
        loading,
        login,
        register,
        logout,
        deleteUserAccount,
        isAuthenticated,
        error,
        setError,
        isSeller,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};