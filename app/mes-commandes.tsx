// app/mes-commandes.tsx
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MesCommandesScreen() {
  const { authUser } = useAuth();
  const router = useRouter();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.uid) return;

    const q = query(
      collection(db, 'orders'),
      where('buyerId', '==', authUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCommandes(data);
      setLoading(false);
    });

    return unsub;
  }, [authUser]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '✅ Confirmée';
      case 'preparing':
        return '🧑‍🍳 En préparation';
      case 'picked_up':
        return '🚗 En route';
      case 'delivered':
        return '📦 Livrée';
      default:
        return '⏳ En attente';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/order-confirmation/${item.id}`)}>
      <Text style={styles.orderId}>Commande #{item.id}</Text>
      <Text style={styles.row}>Montant : {item.finalAmount?.toFixed(0) || '0'} CDF</Text>
      <Text style={styles.row}>Type : {item.deliveryType === 'delivery' ? 'Livraison' : 'Retrait'}</Text>
      <Text style={styles.row}>Statut : {getStatusLabel(item.status)}</Text>
    </TouchableOpacity>
  );

  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );

  if (commandes.length === 0)
    return (
      <SafeAreaView style={styles.center}>
        <Text>Aucune commande trouvée.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
          <Text style={styles.btnTxt}>Retour à l’accueil</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={commandes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  orderId: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  row: { fontSize: 14, marginVertical: 2 },
  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  btnTxt: { color: '#fff', fontWeight: '600' },
});