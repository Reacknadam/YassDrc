// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

type UserType = {
  id: string;
  email: string;
  name: string;
  token?: string;
  isSellerVerified?: boolean;
  photoBase64?: string;
  phoneNumber?: string; 
  sellerForm?: {
    phoneNumber?: string;
    shopName?: string;
  };
};

type AuthContextType = {
  user: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  error: string | null;
  setError: (error: string | null) => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fonction pour hasher le mot de passe
  const hashPassword = async (password: string) => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  };

  // Charger l'utilisateur au démarrage
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userJson = await AsyncStorage.getItem('@user');
        
        if (userJson) {
          const userData = JSON.parse(userJson);
          
          // Vérifier si le token est toujours valide (optionnel)
          const userDoc = await getDoc(doc(db, 'users', userData.email));
          if (userDoc.exists()) {
            setUser(userData);
          } else {
            await AsyncStorage.removeItem('@user');
          }
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

  // Connexion de l'utilisateur
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const userDocRef = doc(db, 'users', email);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        setError('Utilisateur non trouvé');
        return false;
      }

      const userData = userSnap.data();
      const hashedPassword = await hashPassword(password);

      // Comparaison des mots de passe hashés
      if (userData.passwordHash !== hashedPassword) {
        setError('Mot de passe incorrect');
        return false;
      }

      // Créer l'objet utilisateur à stocker
      const userToStore = {
        id: email,
        email,
        name: userData.name,
        token: `fake-jwt-token-${Date.now()}`, // Dans un vrai cas, utiliser un vrai JWT
        isSellerVerified: userData.isSellerVerified || false
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userToStore));
      setUser(userToStore);
      return true;

    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Erreur lors de la connexion');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Inscription de l'utilisateur
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Vérifier si l'utilisateur existe déjà
      const userDocRef = doc(db, 'users', email);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        setError('Cet email est déjà utilisé');
        return false;
      }

      // Hasher le mot de passe
      const passwordHash = await hashPassword(password);

      // Créer le nouvel utilisateur dans Firestore
      await setDoc(userDocRef, {
        name,
        email,
        passwordHash,
        isSellerVerified: false,
        createdAt: new Date().toISOString()
      });

      // Connecter l'utilisateur directement après l'inscription
      const userToStore = {
        id: email,
        email,
        name,
        token: `fake-jwt-token-${Date.now()}`,
        isSellerVerified: false
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userToStore));
      setUser(userToStore);
      return true;

    } catch (err) {
      console.error('Erreur d\'inscription:', err);
      setError('Erreur lors de l\'inscription');
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
      setUser(null);
      router.replace('/login');
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
      setError('Erreur lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated,
        error,
        setError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};