import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fsbehwyhsfojqxrfczdu.supabase.co'; // ✅ Mets ton URL ici
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmVod3loc2ZvanF4cmZjemR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzIwNDcsImV4cCI6MjA2NTY0ODA0N30.UxS0A-NkWE61m-8fWYxtRtBtu3t5bvTITmXmfgUvt0Q'; // ✅ Mets ta clé API ici
const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
