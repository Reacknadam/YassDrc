// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore'; // Importez 'Firestore' pour le typage
// Si vous utilisez Supabase, décommentez et configurez l'importation de 'createClient'
// import { createClient } from '@supabase/supabase-js';

const firebaseConfig = {
  apiKey: 'AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q',
  authDomain: 'yass-drc.firebaseapp.com',
  projectId: 'yass-drc',
  storageBucket: 'yass-drc.appspot.com',
  messagingSenderId: '946442540515',
  appId: '1:946442540515:web:d1b30386ab315e185bcd6',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // Exportez 'db'

// Ajoutez cette ligne pour exporter 'firestore' comme alias de 'db'
export const firestore: Firestore = db; // <-- AJOUTÉ : Exporte firestore

// Si vous utilisez Supabase, décommentez et configurez son initialisation et son exportation
/*
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!, // Assurez-vous que ces variables d'environnement sont définies
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
*/