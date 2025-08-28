// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

// =================================================================================
// INTERFACES & TYPES
// =================================================================================

type UserType = {
  id: string; // Utiliser 'id' au lieu de 'uid' pour la cohérence
  email: string;
  name: string;
  token?: string;
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

// Mise à jour de l'interface AuthContextType pour inclure
// authUser et deleteUserAccount. Cela résout l'erreur de
// compilation dans le fichier profile.tsx.
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
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

// URL de base de votre Worker Cloudflare
const CLOUDFLARE_WORKER_URL = 'https://authentification.israelntalu328.workers.dev';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Renommage de 'user' en 'authUser' pour correspondre à profile.tsx
  const [authUser, setAuthUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Charger l'utilisateur au démarrage
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson) {
          const userData = JSON.parse(userJson);
          // On ne vérifie plus directement dans Firestore, on se base sur le token stocké
          setAuthUser(userData);
        }
      } catch (err) {
        console.error('Erreur de chargement:', err);
        setError("Erreur de chargement de la session");
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Connexion de l'utilisateur via le Worker
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Erreur de connexion');
        return false;
      }

      // Stocker l'utilisateur avec le token
      const userToStore = {
        id: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        token: data.token,
        isSellerVerified: data.user.isSellerVerified,
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userToStore));
      setAuthUser(userToStore);
      return true;
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Erreur lors de la connexion. Veuillez réessayer.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Inscription de l'utilisateur via le Worker
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Erreur d\'inscription');
        return false;
      }

      const userToStore = {
        id: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        token: data.token,
        isSellerVerified: data.user.isSellerVerified,
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userToStore));
      setAuthUser(userToStore);
      return true;
    } catch (err) {
      console.error('Erreur d\'inscription:', err);
      setError('Erreur lors de l\'inscription. Veuillez réessayer.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion de l'utilisateur
  const logout = async () => {
    try {
      setLoading(true);
      await AsyncStorage.removeItem('@user');
      setAuthUser(null);
      router.replace('/login');
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
      setError('Erreur lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };
  
  // Suppression du compte via le Worker
  const deleteUserAccount = async () => {
    if (!authUser) {
      setError("Aucun utilisateur n'est connecté.");
      return;
    }
  
    setLoading(true);
    setError(null);
    try {
      // Dans une application réelle, il faudrait un token JWT pour sécuriser cette requête
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authUser.token}`, // Recommandé en prod
        },
        body: JSON.stringify({ uid: authUser.id }),
      });
  
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Erreur de suppression du compte.');
        setLoading(false);
        return;
      }
      
      await logout();
      setError("Votre compte a été supprimé avec succès.");
      console.log("Compte supprimé pour l'utilisateur:", authUser.email);
    } catch (err) {
      console.error('Erreur lors de la suppression du compte:', err);
      setError('Erreur lors de la suppression du compte.');
    } finally {
      setLoading(false);
    }
  };


  const isAuthenticated = !!authUser;

  return (
    <AuthContext.Provider
      value={{
        authUser, // Utilisateur renommé en authUser
        loading,
        login,
        register,
        logout,
        deleteUserAccount, // Nouvelle fonction ajoutée
        isAuthenticated,
        error,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
