import { db } from '@/firebase/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// Type SMS reçu
type SmsMessage = {
  originatingAddress: string;
  body: string;
};

// Typage produit
type Product = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
};

// Typage commande
type Order = {
  id: string;
  status: string;
  total: number;
  products: Product[];
  sellerId: string;
  buyerId: string;
  createdAt?: any;
  sellerInfo?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    shopName?: string;
  };
};

export default function ConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Timer state
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  // SMS Listener subscription ref
  const [smsSubscription, setSmsSubscription] = useState<any>(null);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      if (!id) throw new Error('ID manquant');
      const docRef = doc(db, 'orders', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        setError('');
      } else {
        setError('Commande introuvable.');
        setOrder(null);
      }
    } catch (e) {
      setError("Erreur lors du chargement de la commande.");
      setOrder(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Validation paiement
  const handleValidatePayment = async () => {
    if (!order) return;
    setPaying(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { status: 'paid' });
      setOrder({ ...order, status: 'paid' });
      Alert.alert('Paiement validé', 'Votre paiement a été confirmé !');
      setTimeout(() => router.replace('/'), 1500);
    } catch (e) {
      Alert.alert('Erreur', "Impossible de valider le paiement.");
    } finally {
      setPaying(false);
    }
  };

  // Contact vendeur
  const handleContactSeller = () => {
    if (order?.sellerInfo?.phoneNumber) {
      Alert.alert('Contacter le vendeur', `Téléphone : ${order.sellerInfo.phoneNumber}`);
      // Pour appel direct : Linking.openURL(`tel:${order.sellerInfo.phoneNumber}`);
    } else {
      Alert.alert('Info', 'Aucun numéro de téléphone du vendeur disponible.');
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchOrder();

    // Gestion SMS listener uniquement sur Android (prod uniquement)
    if (Platform.OS === 'android' && !__DEV__) {
      let SmsListenerModule: any;
      try {
        SmsListenerModule = require('react-native-android-sms-listener').default;
      } catch (e) {
        console.warn('Module SMS listener non disponible:', e);
        return;
      }

      const subscription = SmsListenerModule.addListener((message: SmsMessage) => {
        if (
          message.body.includes('Airtel Money') ||
          message.body.includes('M-Pesa') ||
          message.body.includes('paiement réussi') ||
          message.body.includes('transaction confirmée')
        ) {
          Alert.alert('Paiement détecté', 'Un paiement Mobile Money a été détecté automatiquement.');
          handleValidatePayment();
        }
      });
      setSmsSubscription(subscription);

    const idTimeout = setTimeout(() => {
  Alert.alert('Temps écoulé', 'Validation de paiement automatique abandonnée.');
  setTimeoutId(null);
}, 20000);
setTimeoutId(idTimeout);

      return () => {
        subscription.remove();
        clearTimeout(idTimeout);
        setTimeoutId(null);
        setSmsSubscription(null);
      };
    }
  }, [id]);

  // En dev (Expo Go), mock SMS listener pour éviter crash
  useEffect(() => {
    if (Platform.OS === 'android' && __DEV__) {
      console.log('En dev, SMS listener mock activé (expo go).');
      // Aucun SMS listener ici, ça évite le crash
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ marginTop: 16 }}>Chargement de la commande...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
        <TouchableOpacity onPress={fetchOrder} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color="#6C63FF" />
          <Text style={{ color: '#6C63FF', marginLeft: 8 }}>Rafraîchir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Commande non trouvée.</Text>
        <TouchableOpacity onPress={fetchOrder} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color="#6C63FF" />
          <Text style={{ color: '#6C63FF', marginLeft: 8 }}>Rafraîchir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dateStr = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleString()
    : order.createdAt
    ? new Date(order.createdAt).toLocaleString()
    : '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color="#6C63FF" />
        <Text style={{ color: '#6C63FF', marginLeft: 6 }}>Retour</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Confirmation de commande</Text>

      <Text style={styles.label}>Numéro de commande :</Text>
      <Text style={styles.value}>{order.id}</Text>

      <Text style={styles.label}>Date :</Text>
      <Text style={styles.value}>{dateStr}</Text>

      <Text style={styles.label}>Statut :</Text>
      <Text
        style={[
          styles.value,
          { color: order.status === 'paid' ? 'green' : '#ff9800', fontWeight: 'bold' },
        ]}
      >
        {order.status === 'paid' ? 'Payée' : 'En attente'}
      </Text>

      <Text style={styles.label}>Total :</Text>
      <Text style={styles.value}>{order.total?.toLocaleString()} CDF</Text>

      <Text style={styles.label}>Produits :</Text>
      {order.products?.map((prod, idx) => (
        <View key={prod.id || idx} style={styles.productItem}>
          {prod.images?.[0] && (
            <Image source={{ uri: prod.images[0] }} style={styles.productImage} resizeMode="cover" />
          )}
          <Text style={styles.productName}>{prod.name}</Text>
          <Text style={styles.productQty}>x{prod.quantity}</Text>
          <Text style={styles.productPrice}>{prod.price?.toLocaleString()} CDF</Text>
        </View>
      ))}

      <Text style={styles.label}>Vendeur :</Text>
      <Text style={styles.value}>
        {order.sellerInfo?.shopName || order.sellerInfo?.name || order.sellerId}
      </Text>

      {order.sellerInfo?.phoneNumber && (
        <TouchableOpacity style={styles.contactBtn} onPress={handleContactSeller}>
          <Feather name="phone" size={18} color="#fff" />
          <Text style={styles.contactBtnText}>Contacter le vendeur</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={fetchOrder} style={styles.refreshBtn}>
        <Feather name="refresh-cw" size={20} color="#6C63FF" />
        <Text style={{ color: '#6C63FF', marginLeft: 8 }}>Rafraîchir</Text>
      </TouchableOpacity>

      {order.status !== 'paid' && (
        <TouchableOpacity style={styles.payBtn} onPress={handleValidatePayment} disabled={paying}>
          {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Valider le paiement</Text>}
        </TouchableOpacity>
      )}

      {order.status === 'paid' && <Text style={styles.successMsg}>Merci ! Votre commande est payée.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  value: {
    fontSize: 18,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  payBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  successMsg: {
    marginTop: 24,
    fontSize: 18,
    color: 'green',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  productName: {
    fontSize: 16,
    flex: 1,
  },
  productQty: {
    fontSize: 16,
    width: 40,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 16,
    width: 80,
    textAlign: 'right',
  },
});
