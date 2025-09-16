// src/firebase/config.ts
// @ts-ignore  -- getReactNativePersistence n'est pas typé dans l'export public
import { getReactNativePersistence, initializeAuth } from '@firebase/auth/dist/rn/index.js';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q',
  authDomain: 'yass-drc.firebaseapp.com',
  projectId: 'yass-drc',
  storageBucket: 'yass-drc.appspot.com',
  messagingSenderId: '946442540515',
  appId: '1:946442540515:web:d1b30386ab315e185bcd6',
};

const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);
export const firestore: Firestore = db;

// Auth avec persistance React-Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Storage
export const storage: FirebaseStorage = getStorage(app);