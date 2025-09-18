// context/AuthContext.tsx
import { useRouter } from 'expo-router';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../supabase/client';
import { Session, User } from '@supabase/supabase-js';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data: userProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error?.code === '42P01') {
          console.warn('Table profiles introuvable → création');
          await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            name: session.user.email?.split('@')[0] || 'Utilisateur',
            city: 'Kinshasa',
          });
          const { data: created } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (created) {
            const appUser: AppUser = {
              uid: created.id,
              email: created.email,
              name: created.name,
              isSellerVerified: created.is_seller_verified || false,
              photoUrl: created.photo_url,
              city: created.city,
            };
            setAuthUser(appUser);
            setIsSeller(appUser.isSellerVerified || false);
          }
        } else if (userProfile) {
          const appUser: AppUser = {
            uid: userProfile.id,
            email: userProfile.email,
            name: userProfile.name || 'Utilisateur',
            isSellerVerified: userProfile.is_seller_verified || false,
            photoUrl: userProfile.photo_url,
            city: userProfile.city,
          };
          setAuthUser(appUser);
            setIsSeller(appUser.isSellerVerified || false);
        }
      } else {
        setAuthUser(null);
        setIsSeller(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
      setError('Email ou mot de passe incorrect.');
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
        options: { data: { name, city: 'Kinshasa' } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("L'utilisateur n'a pas été créé.");
      return true;
    } catch (err: any) {
      setError(err.message.includes('already registered')
        ? 'Cet email est déjà utilisé.'
        : "Erreur lors de l'inscription.");
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
      setError('Erreur lors de la déconnexion');
    }
  };

  // ------------------------------------------------------------------
  // DELETE USER ACCOUNT
  // ------------------------------------------------------------------
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
            try {
              // 1. Supprime l’utilisateur chez Supabase
              const { error } = await supabase.auth.admin.deleteUser(authUser!.uid);
              if (error) throw error;

              // 2. Supprime la ligne profiles
              await supabase.from('profiles').delete().eq('id', authUser!.uid);

              // 3. Déconnecte
              await logout();
              Alert.alert('Compte supprimé', 'Ton compte a été définitivement supprimé.');
            } catch (err: any) {
              Alert.alert('Erreur', err.message);
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