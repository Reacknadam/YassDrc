// app/subs.tsx
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const WORKER_ROOT = 'https://yass-webhook.israelntalu328.workers.dev';

/* ------------------------------------------------------------------ */
/*  Helper : génère un ID compatible PawaPay (32 car, hex, sans -)   */
/* ------------------------------------------------------------------ */
const generateDepositId = () => Crypto.randomUUID();
export default function SubscribeScreen() {
  const { authUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState<number>(4500);
  const [currency, setCurrency] = useState<string>('CDF');
  const [depositId, setDepositId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 1.  Chargement prix public */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'public', 'subscription_config'));
        if (snap.exists()) {
          setAmount(snap.data().amount);
          setCurrency(snap.data().currency);
        }
      } catch (e) {
        console.error('Erreur lecture prix', e);
      }
    })();
  }, []);

  /* 2.  Ouvre la WebView avec le depositId généré */
  const startPayment = () => {
    if (!authUser?.uid) return Alert.alert('Erreur', 'Non connecté');
    const id = generateDepositId();
console.log('[PawaPay] UUID v4 généré :', id, '(longueur =', id.length, ')');
    setDepositId(id);
    setVisible(true);
  };

  /* 3.  Interception du retour – récupère l’ID dans l’URL */
  const handleNavChange = (nav: WebViewNavigation) => {
    const { url } = nav;
    console.log('[PawaPay] URL interceptée :', url);   // ← LOG
    if (url.includes(`${WORKER_ROOT}/payment-return`)) {
      const params = new URL(url).searchParams;
      const returnedId = params.get('depositId');
      console.log('[PawaPay] depositId reçu dans return :', returnedId); // ← LOG
      if (returnedId) {
        setVisible(false);
        pollStatus(returnedId);
      } else {
        Alert.alert('Erreur', 'depositId manquant dans le retour');
      }
    }
  };

  /* 4.  Polling avec l’ID retourné */
  const pollStatus = (id: string) => {
    console.log('[PawaPay] polling démarré pour', id); // ← LOG
    let tries = 0;
    const max = 20;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const r = await fetch(`${WORKER_ROOT}/deposit-status?depositId=${id}`);
        if (!r.ok) throw new Error('Network');
        const { status } = await r.json();
        const st = String(status).toUpperCase();
        console.log(`[PawaPay] tentative ${tries} -> status : ${st}`); // ← LOG

        if (['SUCCESS', 'SUCCESSFUL'].includes(st)) {
          clearInterval(pollRef.current!); pollRef.current = null;
          await saveToFirestore('success');
          Alert.alert('✅ Paiement confirmé', 'Vous êtes maintenant vendeur vérifié !');
          router.push('/profile');
          return;
        }
        if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'ERROR'].includes(st)) {
          clearInterval(pollRef.current!); pollRef.current = null;
          await saveToFirestore('failed');
          Alert.alert('Paiement échoué', 'Le paiement a été refusé/annulé.');
          return;
        }
      } catch (e) { console.warn('[PawaPay] erreur polling', e); }

      if (tries >= max) {
        clearInterval(pollRef.current!); pollRef.current = null;
        await saveToFirestore('timeout');
        Alert.alert('⏱ Délai dépassé', 'Paiement non confirmé.');
      }
    }, 3000);
  };

  /* 5.  Firestore */
  const saveToFirestore = async (status: 'success' | 'failed' | 'timeout') => {
    const payload: any = { paymentStatus: status, paymentUpdatedAt: serverTimestamp() };
    if (status === 'success') {
      payload.isSellerVerified = true;
      payload.sellerUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    if (!authUser?.uid) throw new Error('User ID undefined');
    await updateDoc(doc(db, 'users', authUser.uid), payload);
    await addDoc(collection(db, 'payments'), {
      userId: authUser.uid,
      depositId,
      amount,
      currency,
      status,
      createdAt: serverTimestamp(),
    });
  };

  /* 6.  Rendu */
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Abonnement Vendeur</Text>
      <Text style={styles.subtitle}>Finalisez pour devenir vendeur vérifié.</Text>
      <Text style={styles.price}>{amount.toLocaleString()} {currency}</Text>

      <TouchableOpacity style={styles.btn} onPress={startPayment}>
        <Text style={styles.btnTxt}>Payer maintenant</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: '#ccc', marginTop: 16 }]}
        onPress={() => router.push('/profile')}
      >
        <Text style={[styles.btnTxt, { color: '#333' }]}>Retour</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ padding: 16 }} onPress={() => setVisible(false)}>
            <Text style={{ fontSize: 18 }}>✕ Fermer</Text>
          </TouchableOpacity>
          <WebView
            source={{
              uri: `${WORKER_ROOT}/payment-page?amount=${amount}&currency=${currency}&depositId=${depositId}`,
            }}
            onNavigationStateChange={handleNavChange}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 8 }}>Chargement…</Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  price: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  btn: { backgroundColor: '#6C63FF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});