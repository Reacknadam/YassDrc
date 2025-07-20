import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from 'js-sha256';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

// --- Initialisation Firebase (remplace ta config) ---
const firebaseConfig = {
  apiKey: 'AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q',
  authDomain: 'yass-drc.firebaseapp.com',
  projectId: 'yass-drc',
  storageBucket: 'yass-drc.appspot.com',
  messagingSenderId: '946442540515',
  appId: '1:946442540515:web:d1b30386ab315e185bcd6',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
  
// --- Types ---
interface User {
  uid: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Provider ---
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaurer session stockée
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUid = await AsyncStorage.getItem('user_uid');
        const storedEmail = await AsyncStorage.getItem('user_email');
        if (storedUid && storedEmail) {
          setUser({ uid: storedUid, email: storedEmail });
        }
      } catch (error) {
        console.error('Erreur restauration session:', error);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // Inscription
  const register = async (email: string, password: string) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const existing = await getDocs(q);
    if (!existing.empty) throw new Error('Email déjà utilisé.');

    const uid = crypto.randomUUID();
    const hashedPassword = sha256(password);

    await setDoc(doc(usersRef, uid), {
      uid,
      email,
      password: hashedPassword,
    });

    await AsyncStorage.setItem('user_uid', uid);
    await AsyncStorage.setItem('user_email', email);
    setUser({ uid, email });
  };

  // Connexion
  const login = async (email: string, password: string) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error("Email introuvable.");

    const docData = snapshot.docs[0].data();
    const hashedInput = sha256(password);
    if (docData.password !== hashedInput) throw new Error("Mot de passe incorrect.");

    await AsyncStorage.setItem('user_uid', docData.uid);
    await AsyncStorage.setItem('user_email', docData.email);
    setUser({ uid: docData.uid, email: docData.email });
  };

  // Déconnexion
  const logout = async () => {
    await AsyncStorage.removeItem('user_uid');
    await AsyncStorage.removeItem('user_email');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook pour utiliser le contexte
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
};
