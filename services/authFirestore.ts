// src/services/authFirestore.ts
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserData } from '../src/types';

export const register = async (username: string, password: string) => {
  const userRef = doc(db, 'users', username);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    throw new Error('Nom d’utilisateur déjà utilisé');
  }

  const newUser: UserData = {
    uid: username,
    username,
    password, // Pour production: hacher le mot de passe !
    createdAt: Date.now(),
  };

  await setDoc(userRef, newUser);
  return newUser;
};

export const login = async (username: string, password: string) => {
  const userRef = doc(db, 'users', username);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error("Utilisateur introuvable");
  }

  const user = snapshot.data() as UserData;
  if (user.password !== password) {
    throw new Error("Mot de passe incorrect");
  }

  return user;
};
