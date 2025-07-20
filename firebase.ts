// firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiROTzgd26gOEEoWra2ADKTviv753cx5Q",
  authDomain: "yass-drc.firebaseapp.com",
  projectId: "yass-drc",
  storageBucket: "yass-drc.appspot.com",
  messagingSenderId: "946442540515",
  appId: "1:946442540515:web:d1b30386ab315e185bcd6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
