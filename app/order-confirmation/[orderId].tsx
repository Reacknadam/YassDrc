import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Interface pour le format des données de commande
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface OrderData {
  orderId: string;
  finalAmount: number;
  items: OrderItem[];
  status: string;
  paymentStatus: string;
  depositStatus: string;
  deliveryType: 'delivery' | 'pickup';
  deliveryLocation: string;
  deliveryAddress?: string;
}

const OrderConfirmationScreen = () => {
  // Récupération des paramètres de l'URL pour obtenir l'ID de la commande
  const { orderId } = useLocalSearchParams();
  const router = useRouter();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour écouter les changements de la commande en temps réel
  useEffect(() => {
    if (!orderId) {
      setError("ID de commande manquant. Impossible d'afficher la confirmation.");
      setLoading(false);
      return;
    }

    const orderDocRef = doc(db, 'orders', orderId as string);

    // Utilisation de onSnapshot pour des mises à jour en temps réel
    const unsubscribe = onSnapshot(
      orderDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as OrderData;
          setOrder(data);
          setLoading(false);
        } else {
          // Gérer le cas où la commande n'existe pas
          setError("La commande n'a pas été trouvée.");
          setLoading(false);
        }
      },
      (e) => {
        // Gérer les erreurs de connexion ou de permissions
        console.error("Erreur lors de la récupération de la commande:", e);
        setError("Erreur de connexion. Veuillez vérifier votre réseau.");
        setLoading(false);
      }
    );

    // Nettoyage de l'écouteur lors du démontage du composant
    return () => unsubscribe();
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement de la commande...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="red" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => router.replace('/')}>
            <Text style={styles.goBackButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
     return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="red" />
          <Text style={styles.errorText}>Désolé, la commande n'a pas pu être chargée.</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => router.replace('/')}>
            <Text style={styles.goBackButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = order.depositStatus === 'PAID' || order.depositStatus === 'NOT_REQUIRED';
  const iconName = isPaid ? 'checkmark-circle-outline' : 'time-outline';
  const iconColor = isPaid ? '#28a745' : '#ffc107';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={100} color={iconColor} />
            <Text style={styles.confirmationTitle}>
              {isPaid ? 'Commande Confirmée !' : 'Paiement en attente...'}
            </Text>
            <Text style={styles.confirmationText}>
              Votre commande {order.orderId} est maintenant en cours de traitement.
              Nous vous notifierons de l'évolution de son statut.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Résumé de la Commande</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Statut:</Text>
              <Text style={[styles.summaryValue, { color: isPaid ? '#28a745' : '#ffc107' }]}>{order.status}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Montant Total:</Text>
              <Text style={styles.summaryValue}>{order.finalAmount.toLocaleString()} CDF</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Type de livraison:</Text>
              <Text style={styles.summaryValue}>
                {order.deliveryType === 'delivery' ? 'Livraison à domicile' : 'Retrait en boutique'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{order.deliveryType === 'delivery' ? 'Adresse:' : 'Point de retrait:'}</Text>
              <Text style={styles.summaryValue}>
                {order.deliveryLocation}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Articles Commandés</Text>
            {order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.orderItemImage} />
                ) : (
                  <View style={styles.orderItemPlaceholder}>
                    <Feather name="image" size={24} color="#666" />
                  </View>
                )}
                <View style={styles.orderItemTextContainer}>
                  <Text style={styles.orderItemName}>{item.name}</Text>
                  <Text style={styles.orderItemQuantity}>Quantité: {item.quantity}</Text>
                </View>
                <Text style={styles.orderItemPrice}>{item.price.toLocaleString()} CDF</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.goBackButton} onPress={() => router.replace('/')}>
          <Text style={styles.goBackButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 30,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
    textAlign: 'right',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 10,
  },
  orderItemPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  orderItemTextContainer: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderItemQuantity: {
    fontSize: 14,
    color: '#888',
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  goBackButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  goBackButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default OrderConfirmationScreen;
