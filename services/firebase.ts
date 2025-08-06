

// src/services/firebase.ts

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 🔐 Remplace ces valeurs par celles de TON projet Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q',
  authDomain: 'yass-drc.firebaseapp.com',
  projectId: 'yass-drc',
  storageBucket: 'yass-drc.appspot.com',
  messagingSenderId: '946442540515',
  appId: '1:946442540515:web:d1b30386ab315e185bcd6',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
