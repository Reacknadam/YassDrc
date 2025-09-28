import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fsbehwyhsfojqxrfczdu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmVod3loc2ZvanF4cmZjemR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzIwNDcsImV4cCI6MjA2NTY0ODA0N30.UxS0A-NkWE61m-8fWYxtRtBtu3t5bvTITmXmfgUvt0Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
