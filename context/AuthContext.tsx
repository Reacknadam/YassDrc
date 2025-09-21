// context/AuthContext.tsx
import { useRouter } from 'expo-router';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../supabase/client';
import { Session } from '@supabase/supabase-js';
import { db, functions } from '../firebase/config';
import { doc, onSnapshot, setDoc, updateDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  isSellerVerified?: boolean;
  photoUrl?: string;
  phoneNumber?: string;
  shopName?: string;
  city?: string;
  sellerUntil?: Timestamp;
  createdAt?: Timestamp;
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
  session: Session | null;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const router = useRouter();

  // ------------------------------------------------------------------
  // Auth state listener
  // ------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (!session?.user) {
        setAuthUser(null);
        setIsSeller(false);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', session.user.id);
      const firestoreUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as AppUser;

          // Check for subscription expiry
          const now = Timestamp.now();
          if (userData.isSellerVerified && userData.sellerUntil && userData.sellerUntil < now) {
            console.log(`User ${userData.uid} subscription expired. Updating status.`);
            await updateDoc(userDocRef, { isSellerVerified: false });
            userData.isSellerVerified = false; // Update locally to reflect change immediately
          }

          const appUser: AppUser = {
            uid: session.user.id,
            email: session.user.email,
            name: userData.name || session.user.email?.split('@')[0] || 'Utilisateur',
            isSellerVerified: userData.isSellerVerified || false,
            photoUrl: userData.photoUrl,
            city: userData.city,
            sellerUntil: userData.sellerUntil,
            phoneNumber: userData.phoneNumber,
            shopName: userData.shopName,
          };

          setAuthUser(appUser);
          setIsSeller(appUser.isSellerVerified || false);
        } else {
          // User exists in Supabase Auth but not in Firestore, let's create their profile
          console.log(`User profile for ${session.user.id} not found in Firestore. Creating...`);
          const newUser: AppUser = {
            uid: session.user.id,
            email: session.user.email,
            name: session.user.email?.split('@')[0] || 'Utilisateur',
            createdAt: Timestamp.now(),
            isSellerVerified: false,
            city: 'Kinshasa',
          };
          await setDoc(userDocRef, newUser);
          setAuthUser(newUser);
          setIsSeller(false);
        }
        setLoading(false);
      }, (err) => {
        console.error("Error listening to user profile:", err);
        setError("Impossible de charger votre profil. Vérifiez votre connexion internet.");
        setLoading(false);
        setAuthUser(null);
      });

      // Return cleanup function for the Firestore listener
      return () => {
        console.log("Unsubscribing from Firestore user listener.");
        firestoreUnsubscribe();
      };
    });

    // Return cleanup function for the Supabase auth listener
    return () => {
      console.log("Unsubscribing from Supabase auth state change.");
      authSubscription.unsubscribe();
    };
  }, []);

  // ------------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------------
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // REGISTER
  // ------------------------------------------------------------------
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) throw error;
      if (!data.user) throw new Error("L'utilisateur n'a pas été créé.");

      // Create user profile in Firestore
      const userRef = doc(db, 'users', data.user.id);
      const newUser: AppUser = {
        uid: data.user.id,
        email: data.user.email,
        name,
        createdAt: Timestamp.now(),
        isSellerVerified: false,
        city: 'Kinshasa',
      };
      await setDoc(userRef, newUser);

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // LOGOUT
  // ------------------------------------------------------------------
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ------------------------------------------------------------------
  // DELETE USER ACCOUNT
  // ------------------------------------------------------------------
  const deleteUserAccount = async () => {
    Alert.alert(
      'Supprimer le compte',
      'Es-tu sûr ? Cette action est irréversible et supprimera toutes vos données.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!authUser?.uid) {
              Alert.alert('Erreur', 'Vous devez être connecté pour supprimer un compte.');
              return;
            }
            try {
              // Appelle la fonction cloud sécurisée
              const deleteFunction = httpsCallable(functions, 'deleteUserAccount');
              await deleteFunction();

              // La fonction onAuthStateChange s'occupera de la redirection
              // après la suppression de l'utilisateur dans Supabase.
              // On peut forcer une déconnexion locale au cas où.
              await logout();
              Alert.alert('Compte supprimé', 'Votre compte a été définitivement supprimé.');

            } catch (err: any) {
              console.error("Erreur lors de la suppression du compte:", err);
              Alert.alert('Erreur', err.message || 'Une erreur est survenue lors de la suppression du compte.');
            }
          },
        },
      ]
    );
  };

  // ------------------------------------------------------------------
  // GOOGLE OAUTH
  // ------------------------------------------------------------------
  const signInWithGoogle = async () => {
    try {
      const redirectTo = makeRedirectUri({
        native: 'com.israelltd.yass://oauthredirect',
        useProxy: __DEV__,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'email profile',
        },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const params = new URL(result.url).searchParams;
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      Alert.alert('Erreur', 'Échec de la connexion Google');
    }
  };

  // ------------------------------------------------------------------
  // DERIVED STATE
  // ------------------------------------------------------------------
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
        session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};