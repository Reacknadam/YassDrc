// app/order-confirmation/[orderId].tsx
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function OrderConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
      if (snap.exists()) setOrder(snap.data());
      setLoading(false);
    });
    return unsub;
  }, [orderId]);

  const openWhatsApp = (phone: string, message: string) => {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '✅ Commande confirmée';
      case 'preparing':
        return '🧑‍🍳 En préparation';
      case 'picked_up':
        return '🚗 Livreur en route';
      case 'payment_ok':
        return '💰 Paiement confirmé';
      case 'delivered':
        return '📦 Livrée';
      default:
        return '⏳ En attente';
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );

  if (!order)
    return (
      <SafeAreaView style={styles.center}>
        <Text>Commande introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnTxt}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  const isDelivery = order.deliveryType === 'delivery';
  const isDriver = order.driverId && order.driverName;
  const lat = order.deliveryInfo?.coordinates?.latitude;
  const lng = order.deliveryInfo?.coordinates?.longitude;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          <Text style={styles.title}>{getStatusLabel(order.status)}</Text>
          <Text style={styles.sub}>N° {orderId}</Text>
        </View>

        {/* Résumé */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Résumé</Text>
          <Text style={styles.row}>Montant : {order.finalAmount?.toFixed(0) || '0'} CDF</Text>
          <Text style={styles.row}>Livraison : {isDelivery ? 'À domicile' : 'Retrait'}</Text>
          {isDelivery && (
            <>
              <Text style={styles.row}>Adresse : {order.deliveryInfo?.address}</Text>
              <Text style={styles.row}>Lieu : {order.deliveryInfo?.location}</Text>
            </>
          )}
        </View>

        {/* Livreur ou vendeur */}
        {isDelivery && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isDriver ? '🚗 Livreur FastGo' : '🏪 Le vendeur livre'}
            </Text>
            {isDriver ? (
              <>
                <Text style={styles.row}>Nom : {order.driverName}</Text>
                <Text style={styles.row}>Téléphone : {order.driverPhone}</Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => openWhatsApp(order.driverPhone, `Bonjour, je suis à propos de la commande ${orderId}`)}>
                  <Text style={styles.btnTxt}>Contacter le livreur</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.row}>Nom : {order.sellerName}</Text>
                <Text style={styles.row}>Téléphone : {order.sellerPhone}</Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => openWhatsApp(order.sellerPhone, `Bonjour, je suis à propos de la commande ${orderId}`)}>
                  <Text style={styles.btnTxt}>Contacter le vendeur</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Carte si livraison avec coordonnées */}
        {isDelivery && lat && lng && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Localisation de livraison</Text>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}>
              <Marker coordinate={{ latitude: lat, longitude: lng }} />
            </MapView>
          </View>
        )}

        {/* Service client */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Besoin d’aide ?</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => openWhatsApp('243983627022', `Bonjour, j’ai une question concernant la commande ${orderId}`)}>
            <Text style={styles.btnTxt}>Contacter le service client</Text>
          </TouchableOpacity>
        </View>

        {/* Boutons finaux */}
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/profile')}>
          <Text style={styles.btnTxt}>Voir mes commandes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.outline]} onPress={() => router.replace('/')}>
          <Text style={[styles.btnTxt, styles.outlineTxt]}>Continuer mes achats</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  sub: { fontSize: 14, color: '#666' },
  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { fontSize: 15, marginVertical: 4 },
  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6C63FF' },
  outlineTxt: { color: '#6C63FF' },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 10,
  },
});