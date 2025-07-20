import { supabase } from '@/services/supabase';

const isDev = process.env.NODE_ENV === 'development';

export const authService = {
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from('users').insert([{ id: data.user.id, email, name }]);
    }
    return data.user;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  signInWithGoogle: async () => {
    const redirectTo = isDev
      ? 'exp://127.0.0.1:19000' // Remplace par ton URL Expo Go locale
      : 'https://yassdrc-redirect.netlify.app';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  },

  signInWithProvider: async (
    provider: 'google' | 'facebook' | 'github',
    redirectTo?: string
  ) => {
    const url = redirectTo ?? (isDev ? 'exp://172.20.10.3:8081' : 'https://yassdrc-redirect.netlify.app');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: url },
    });
    if (error) throw error;
    return data;
  },
};
