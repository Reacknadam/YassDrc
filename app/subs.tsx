import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { router } from 'expo-router';
import {
  doc,
  serverTimestamp,
  updateDoc,
  onSnapshot,          // ← ajout
  DocumentSnapshot,
} from 'firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
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
import { WebView } from 'react-native-webview';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const WORKER = 'https://yass-webhook.israelntalu328.workers.dev';

type Config = { amount: number; currency: string };

export default function SubscriptionConfirmation() {
  const { authUser } = useAuth();

  /* ----------  état local  ---------- */
  const [visible, setVisible] = useState(false);
  const [depositId, setDepositId] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  /* ----------  1. Lit la config en temps réel  ---------- */
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'public', 'subscription_config'),
      {
        next: (snap: DocumentSnapshot) => {
          if (snap.exists()) setConfig(snap.data() as Config);
          else Alert.alert('Erreur', 'Configuration prix introuvable.');
        },
        error: () => Alert.alert('Erreur', 'Impossible de charger le prix.'),
      }
    );
    return () => unsub();
  }, []);

  /* ----------  2. Démarre le paiement  ---------- */
  const startPayment = async () => {
    if (!authUser?.id || !config) return;
    setLoading(true);
    const id = `${authUser.id}_${Date.now()}`;
    setDepositId(id);

    try {
      const { amount, currency } = config;
      const res = await fetch(
        `${WORKER}/payment-page?depositId=${id}&amount=${amount}&currency=${currency}`
      );
      if (!res.ok) throw new Error(`Worker ${res.status}`);
      const html = await res.text();
      setHtmlContent(html);
      setVisible(true);
    } catch (e: any) {
      Alert.alert('Paiement indisponible', e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ----------  3. Polling jusqu’à SUCCESS  ---------- */
  const confirmPayment = () => {
    let attempts = 0;
    const maxAttempts = 20;
    const pollRef = useRef<number | null>(null);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const raw = await fetch(`${WORKER}/check-payment/${depositId}`).then((r) => {
          if (!r.ok) throw new Error('check err');
          return r.json();
        });
        if (raw.status === 'SUCCESS') {
          clearInterval(pollRef.current!);
          await updateDoc(doc(db, 'users', authUser!.id), {
            isSellerVerified: true,
            sellerUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentStatus: 'success',
            paymentUpdatedAt: serverTimestamp(),
          });
          Alert.alert('✅ Paiement confirmé', 'Vous êtes maintenant vendeur vérifié !');
          setVisible(false);
          router.push('/profile');
        }
      } catch {
        /* ignore network errs */
      }
      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current!);
        Alert.alert('⏱ Délai dépassé', 'Paiement non confirmé.');
        setVisible(false);
      }
    }, 3000);
  };

  /* ----------  4. Nettoyage polling  ---------- */
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /* ----------  5. UI  ---------- */
  if (!config) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Abonnement Vendeur</Text>
      <Text style={styles.subtitle}>
        Finalisez votre inscription pour devenir vendeur vérifié.
      </Text>

      <TouchableOpacity style={styles.payButton} onPress={startPayment} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payButtonText}>
            Payer {config.amount} {config.currency}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paiement sécurisé</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {htmlContent ? (
              <WebView
                source={{ html: htmlContent }}
                style={styles.webview}
                originWhitelist={['https://yass-webhook.israelntalu328.workers.dev']}
                onNavigationStateChange={(nav) => {
                  if (
                    nav.url.includes('depositId=') &&
                    nav.url.includes('yass-webhook.israelntalu328.workers.dev/payment-return')
                  ) {
                    confirmPayment();
                  }
                }}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#6C63FF" />
                    <Text style={styles.loaderText}>Redirection vers PawaPay…</Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#6C63FF" />
                <Text style={styles.loaderText}>Chargement…</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ----------  Styles (inchangés)  ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
  payButton: { backgroundColor: '#6C63FF', padding: 15, borderRadius: 12, alignItems: 'center', width: '80%' },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: SCREEN_HEIGHT * 0.8, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  closeButton: { fontSize: 20, color: '#6C63FF', fontWeight: 'bold' },
  webview: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, fontSize: 14, color: '#666' },
});