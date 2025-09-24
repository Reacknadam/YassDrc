// context/AuthContext.tsx
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { deleteDoc, doc, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { db } from '../firebase/config';
import { supabase } from '../supabase/client';

/* ---------- Types ---------- */
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

/* ---------- Provider ---------- */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const router = useRouter();

  /* Helper : choisit la bonne URL de retour */
  const getRedirectUri = () =>
    __DEV__
      ? 'exp://172.20.10.3:8081'               // Metro LAN
      : 'https://yass-redirect.netlify.app/--auth'; // Prod

  /* ---------- Auth state listener ---------- */
  useEffect(() => {
    setLoading(true);
    let firestoreUnsub: (() => void) | null = null;

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (!session?.user) {
        setAuthUser(null);
        setIsSeller(false);
        setLoading(false);
        firestoreUnsub?.();
        firestoreUnsub = null;
        return;
      }

      const userDocRef = doc(db, 'users', session.user.id);
      firestoreUnsub = onSnapshot(
        userDocRef,
        async (snap) => {
          if (snap.exists()) {
            const u = snap.data() as AppUser;
            const now = Timestamp.now();
            if (u.isSellerVerified && u.sellerUntil && u.sellerUntil < now) {
              await updateDoc(userDocRef, { isSellerVerified: false });
              u.isSellerVerified = false;
            }
            setAuthUser({ ...u, uid: session.user.id, email: session.user.email });
            setIsSeller(u.isSellerVerified || false);
          } else {
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
        },
        (err) => {
          console.error(err);
          setError('Impossible de charger votre profil.');
          setLoading(false);
        }
      );
    });

    return () => {
      data.subscription.unsubscribe();
      firestoreUnsub?.();
    };
  }, [router]);

  /* ---------- LOGIN ---------- */
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return true;
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* ---------- REGISTER ---------- */
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
      setError(err.message || 'Erreur inconnue');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* ---------- LOGOUT ---------- */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  /* ---------- DELETE ACCOUNT ---------- */
  const deleteUserAccount = async () => {
    Alert.alert(
      'Supprimer le compte',
      'Es-tu sûr ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!authUser?.uid) return;
            try {
              await deleteDoc(doc(db, 'users', authUser.uid));
              const { error } = await supabase.auth.admin.deleteUser(authUser.uid);
              if (error) throw error;
              await logout();
              Alert.alert('Compte supprimé', 'Votre compte a été définitivement supprimé.');
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Erreur lors de la suppression.');
            }
          },
        },
      ]
    );
  };

  /* ---------- GOOGLE OAUTH ---------- */
  const signInWithGoogle = async () => {
    try {
      const redirectTo = getRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
          scopes: 'email profile',
        },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const url = new URL(result.url);
        let access = url.searchParams.get('access_token');
        let refresh = url.searchParams.get('refresh_token');

        if (!access || !refresh) {
          const hash = url.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          access = access || hashParams.get('access_token');
          refresh = refresh || hashParams.get('refresh_token');
        }

        if (access && refresh) {
          router.replace({
            pathname: '/auth',
            params: { access_token: access, refresh_token: refresh },
          });
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Erreur inconnue');
    }
  };

  /* ---------- DERIVED ---------- */
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