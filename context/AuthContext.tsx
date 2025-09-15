import { auth, db } from '../firebase/config';
import { Alert } from 'react-native';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// =================================================================================
// INTERFACES & TYPES
// =================================================================================

export interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  id?: string;
  isSellerVerified?: boolean;
  photoUrl?: string;
  phoneNumber?: string;
  shopName?: string;
  city?: string;
}

type AuthContextType = {
  authUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isAuthenticated: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  isSeller: boolean;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const router = useRouter();

  // Configuration Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '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.googleusercontent.com',
      offlineAccess: false,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setLoading(true);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const firestoreData = docSnap.data();
          const appUser: AppUser = {
            uid: user.uid,
            email: user.email,
            name: firestoreData.name || 'Utilisateur',
            isSellerVerified: firestoreData.isSellerVerified || false,
            photoUrl: firestoreData.photoUrl,
            city: firestoreData.city,
          };
          setAuthUser(appUser);
          setIsSeller(appUser.isSellerVerified || false);
        } else {
          const minimalUser: AppUser = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || 'Nouvel Utilisateur',
          };
          setAuthUser(minimalUser);
          setIsSeller(false);
        }
      } else {
        setAuthUser(null);
        setIsSeller(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for real-time updates on the seller status
  useEffect(() => {
    if (!authUser?.uid) return;

    const userRef = doc(db, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const verified = data.isSellerVerified || false;
        setIsSeller(verified);
        setAuthUser((prev) => (prev ? { ...prev, isSellerVerified: verified } : null));
      }
    });

    return () => unsubscribe();
  }, [authUser?.uid]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err: any) {
      console.error('Login Error:', err.code, err.message);
      setError('Email ou mot de passe incorrect.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const newUser: Omit<AppUser, 'uid'> = {
        name,
        email,
        isSellerVerified: false,
        photoUrl: '',
        city: 'Kinshasa',
      };
      await setDoc(doc(db, 'users', user.uid), newUser);

      return true;
    } catch (err: any) {
      console.error('Registration Error:', err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé.');
      } else {
        setError("Erreur lors de l'inscription. Veuillez réessayer.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.error('Logout Error:', err);
      setError('Erreur lors de la déconnexion');
    }
  };

  const deleteUserAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Aucun utilisateur connecté pour supprimer.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid));
      await deleteUser(currentUser);
      Alert.alert("Succès", "Votre compte a été supprimé.");
    } catch (err: any) {
      console.error('Delete Account Error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError("Cette opération est sensible. Veuillez vous reconnecter avant de supprimer votre compte.");
        logout();
      } else {
        setError('Erreur lors de la suppression du compte.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 GOOGLE SIGN-IN SIMPLIFIÉ
  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.idToken) {
        const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);
        const userCredential = await signInWithCredential(auth, googleCredential);

        const user = userCredential.user;
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
  
        if (!docSnap.exists()) {
          const newUser: Omit<AppUser, 'uid'> = {
            name: user.displayName || 'Utilisateur Google',
            email: user.email,
            isSellerVerified: false,
            photoUrl: user.photoURL || '',
            city: 'Kinshasa',
          };
          await setDoc(doc(db, 'users', user.uid), newUser);
        }
      } else {
        Alert.alert('Erreur', 'Aucun idToken trouvé après la connexion Google.');
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === 'CANCELED') {
        Alert.alert('Annulé', 'Connexion Google annulée');
      } else {
        Alert.alert('Erreur', 'Échec de la connexion Google');
      }
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
        signInWithGoogle,
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