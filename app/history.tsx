import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useRouter } from 'expo-router';
// import { useAuth } from '@/context/AuthContext'; // Décommente si tu utilises un contexte d'auth

type Product = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
};

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

export default function HistoryScreen() {
  // Remplace cette valeur par l'ID de l'utilisateur connecté (ex: depuis le contexte Auth)
  // const { user } = useAuth();
  // const userId = user?.id;
  const userId = "USER_ID"; // <-- À remplacer dynamiquement

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('buyerId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data: Order[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(data);
    } catch (e) {
      // Gère l'erreur si besoin
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Commande #{item.id.slice(-6)}</Text>
        <Text style={[
          styles.status,
          { color: item.status === 'paid' ? 'green' : '#ff9800' }
        ]}>
          {item.status === 'paid' ? 'Payée' : 'En attente'}
        </Text>
      </View>
      <Text style={styles.orderDate}>
        {item.createdAt?.toDate
          ? item.createdAt.toDate().toLocaleString()
          : item.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : ''}
      </Text>
      <FlatList
        data={item.products}
        keyExtractor={(prod) => prod.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: prod }) => (
          <View style={styles.productItem}>
            {prod.images?.[0] && (
              <Image
                source={{ uri: prod.images[0] }}
                style={styles.productImage}
                resizeMode="cover"
              />
            )}
            <Text style={styles.productName}>{prod.name}</Text>
            <Text style={styles.productQty}>x{prod.quantity}</Text>
          </View>
        )}
        style={{ marginVertical: 8 }}
      />
      <Text style={styles.orderTotal}>Total : {item.total?.toLocaleString()} CDF</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Bouton retour */}
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Feather name="arrow-left" size={22} color="#6C63FF" />
        <Text style={{ color: '#6C63FF', marginLeft: 6 }}>Retour</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Historique des achats</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="shopping-bag" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Aucun achat trouvé.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C63FF']} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 16,
    alignSelf: 'center',
  },
  orderCard: {
    backgroundColor: '#f8f8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  status: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  orderDate: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  productItem: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#eee',
    marginBottom: 4,
  },
  productName: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  productQty: {
    fontSize: 12,
    color: '#666',
  },
  orderTotal: {
    marginTop: 8,
    fontWeight: 'bold',
    color: '#6C63FF',
    fontSize: 16,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
});