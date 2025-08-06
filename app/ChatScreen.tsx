// /app/(tabs)/chat.tsx (ou votre chemin d'accès à l'écran de chat)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/firebase/config';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Types pour les messages et les commandes (ajustez si vous avez des types globaux)
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any; // Firebase Timestamp
}

interface Order {
  id: string;
  status: string; // 'pending', 'seller_confirmed', 'in_delivery', 'delivered', 'paid', 'cancelled'
  totalAmount: number;
  // ... autres champs de commande pertinents
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth(); // L'utilisateur actuel
  const params = useLocalSearchParams(); // Récupérer les paramètres de navigation

  // orderId est maintenant le paramètre clé pour le chat lié à une commande
  const { sellerId, orderId, sellerName } = params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);

  useEffect(() => {
    if (!user?.id || (!sellerId && !orderId)) {
      Alert.alert("Erreur", "Impossible d'ouvrir le chat. Informations manquantes.");
      router.back();
      return;
    }

    // Si un orderId est fourni, le chatId est basé sur l'orderId.
    // Sinon (pour un chat général entre 2 utilisateurs), il est basé sur les UIDs des 2 utilisateurs.
    const currentChatId = orderId ? `order_${orderId}` : `chat_${[user.id, sellerId].sort().join('_')}`;
    setChatId(currentChatId);

    const unsubscribeMessages = onSnapshot(
      query(
        collection(db, 'chats', currentChatId, 'messages'),
        orderBy('createdAt', 'asc')
      ),
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs);
        setLoadingChat(false);
      },
      (error) => {
        console.error("Erreur lors du chargement des messages:", error);
        Alert.alert("Erreur", "Impossible de charger les messages.");
        setLoadingChat(false);
      }
    );

    let unsubscribeOrder: () => void;
    if (orderId) {
      // Écouter le statut de la commande si c'est un chat lié à une commande
      unsubscribeOrder = onSnapshot(
        doc(db, 'orders', orderId as string),
        (docSnap) => {
          if (docSnap.exists()) {
            const orderData = docSnap.data() as Order;
            setOrderStatus(orderData.status);
            setOrderTotal(orderData.totalAmount);
          } else {
            console.warn("Order document not found for chat:", orderId);
            setOrderStatus("Commande introuvable");
          }
        },
        (error) => {
          console.error("Erreur lors du chargement du statut de la commande:", error);
          setOrderStatus("Erreur de statut");
        }
      );
    }

    return () => {
      unsubscribeMessages();
      if (unsubscribeOrder) unsubscribeOrder();
    };
  }, [user, sellerId, orderId, router]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user?.id || !chatId) return;

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: inputText,
        senderId: user.id,
        senderName: user.name || user.email, // Nom de l'expéditeur
        createdAt: serverTimestamp(),
      });
      setInputText('');
    } catch (error) {
      console.error("Erreur envoi message:", error);
      Alert.alert("Erreur", "Impossible d'envoyer le message.");
    }
  };

  const handleUpdateOrderStatus = async (newStatus: string) => {
    if (!orderId || !user || user.id !== sellerId) { // Seul le vendeur peut changer le statut
      Alert.alert("Erreur", "Vous n'êtes pas autorisé à modifier le statut de cette commande.");
      return;
    }

    Alert.alert(
      "Confirmer l'action",
      `Voulez-vous vraiment changer le statut de la commande à "${newStatus}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'orders', orderId as string), { status: newStatus });
              Alert.alert("Succès", `Statut de la commande mis à jour à "${newStatus}".`);
            } catch (error) {
              console.error("Erreur mise à jour statut commande:", error);
              Alert.alert("Erreur", "Impossible de mettre à jour le statut.");
            }
          }
        }
      ]
    );
  };

  const handleInitiatePayment = () => {
    if (!orderId || !orderTotal) {
      Alert.alert("Erreur", "Impossible d'initier le paiement. Informations manquantes.");
      return;
    }
    // Rediriger vers l'écran de paiement
    router.push({
      pathname: '/PaymentScreen', // Le chemin vers votre écran de paiement
      params: {
        orderId: orderId as string,
        totalAmount: orderTotal.toString(),
        sellerName: sellerName,
      },
    });
  };

  const renderItem = useCallback(({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;
    return (
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
        {!isMyMessage && <Text style={styles.senderName}>{item.senderName}</Text>}
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
        </Text>
      </View>
    );
  }, [user]);

  if (loadingChat) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text>Chargement du chat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{sellerName || "Chat avec le Vendeur"}</Text>
        <View style={{ width: 24 }} /> {/* Espace pour l'alignement */}
      </View>

      {orderId && ( // Afficher le statut de la commande si c'est un chat lié à une commande
        <View style={styles.orderStatusContainer}>
          <Text style={styles.orderStatusText}>Statut de la commande: <Text style={styles.orderStatusValue}>{orderStatus || 'Chargement...'}</Text></Text>
          {user?.id === sellerId && orderStatus === 'pending' && (
            <TouchableOpacity
              style={styles.statusActionButton}
              onPress={() => handleUpdateOrderStatus('seller_confirmed')}
            >
              <Text style={styles.statusActionButtonText}>Confirmer la commande</Text>
            </TouchableOpacity>
          )}
          {user?.id === sellerId && orderStatus === 'seller_confirmed' && (
            <TouchableOpacity
              style={styles.statusActionButton}
              onPress={() => handleUpdateOrderStatus('in_delivery')}
            >
              <Text style={styles.statusActionButtonText}>Marquer comme 'En Livraison'</Text>
            </TouchableOpacity>
          )}
          {user?.id === sellerId && orderStatus === 'in_delivery' && (
            <TouchableOpacity
              style={styles.statusActionButton}
              onPress={() => handleUpdateOrderStatus('delivered')}
            >
              <Text style={styles.statusActionButtonText}>Marquer comme 'Livrée'</Text>
            </TouchableOpacity>
          )}
          {orderStatus === 'delivered' && orderTotal && user?.id !== sellerId && ( // Bouton de paiement pour l'acheteur
            <TouchableOpacity
              style={styles.payButton}
              onPress={handleInitiatePayment}
            >
              <Ionicons name="wallet-outline" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Payer {orderTotal.toLocaleString()} CDF</Text>
            </TouchableOpacity>
          )}
          {orderStatus === 'paid' && (
            <Text style={styles.paidStatusText}>Commande payée !</Text>
          )}
        </View>
      )}

      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        inverted={false} // Afficher les derniers messages en bas (ou true pour inverser)
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Ajustez si besoin
        style={styles.inputContainerWrapper}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Écrivez votre message..."
            multiline
          />
          <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  orderStatusContainer: {
    backgroundColor: '#e6e6fa',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0f0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 8,
  },
  orderStatusText: {
    fontSize: 15,
    color: '#444',
    fontWeight: '500',
  },
  orderStatusValue: {
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  statusActionButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  statusActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  payButton: {
    backgroundColor: '#007bff', // Couleur pour le bouton de paiement
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  paidStatusText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'green',
  },
  messagesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C63FF', // Couleur pour mes messages
    borderBottomRightRadius: 2, // Pour un look de bulle de chat
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff', // Couleur pour les messages des autres
    borderBottomLeftRadius: 2,
  },
  senderName: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainerWrapper: {
    // Cela permet au KeyboardAvoidingView de ne pas déformer le contenu au-dessus
    // et de pousser l'input correctement.
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120, // Limite la hauteur du champ de texte
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});