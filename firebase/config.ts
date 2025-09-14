// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q',
  authDomain: 'yass-drc.firebaseapp.com',
  projectId: 'yass-drc',
  storageBucket: 'yass-drc.appspot.com', // Assurez-vous que c'est correct
  messagingSenderId: '946442540515',
  appId: '1:946442540515:web:d1b30386ab315e185bcd6',
};

const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);
export const firestore: Firestore = db;


export const auth: Auth = getAuth(app);

// Storage - Correction importante
export const storage: FirebaseStorage = getStorage(app, "gs://yass-drc.firebasestorage.app");