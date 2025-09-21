import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  query,
  limit,
  startAfter,
  orderBy,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/* ----------  CONFIG  ---------- */
const WORKER_URL = 'https://agent.israelntalu328.workers.dev/chat';

/* ----------  TYPES  ---------- */
type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  sellerName: string;
  city: string;
  category: string;
  description?: string;
};

/* ----------  SCREEN  ---------- */
export default function AssistantChatScreen() {
  const { authUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  /* 1️⃣  ONE-TIME LOAD of every product ------------------------------------ */
  useEffect(() => {
    loadAllProducts();
  }, []);

  const loadAllProducts = async () => {
    setLoading(true);
    try {
      const products: Product[] = [];
      let lastDoc: any = null;
      const pageSize = 500; // max allowed by Firestore in a single round-trip

      while (true) {
        const q = lastDoc
          ? query(
              collection(db, 'products'),
              orderBy('createdAt', 'desc'),
              startAfter(lastDoc),
              limit(pageSize)
            )
          : query(
              collection(db, 'products'),
              orderBy('createdAt', 'desc'),
              limit(pageSize)
            );

        const snap = await getDocs(q);
        if (snap.empty) break;

        snap.forEach((d) => {
          const data = d.data();
          products.push({
            id: d.id,
            name: data.name || '',
            price: data.price || 0,
            sellerName: data.sellerName || '',
            city: data.city || '',
            category: data.category || '',
            description: data.description || '',
          });
        });

        lastDoc = snap.docs[snap.docs.length - 1];
      }

      /* 2️⃣  Build plain-text context */
      const context =
        products.length === 0
          ? 'Aucun produit dans la base.'
          : products
              .map(
                (p) =>
                  `${p.name} | ${p.price} CDF | Vendeur: ${p.sellerName} | Ville: ${p.city} | Catégorie: ${p.category} | Desc: ${p.description}`
              )
              .join('\n');

      addBotMessage(
        `J’ai chargé ${products.length} produits. Voici quelques-uns :\n${context
          .split('\n')
          .slice(0, 5)
          .join('\n')}\n\nDemandez-moi n’importe quoi (recherche, fiabilité, prix, etc.)`
      );
    } catch (e: any) {
      addBotMessage(`Erreur chargement produits : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ----------  CHAT UTILS  ---------- */
  const addMessage = (msg: Message) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const addUserMessage = (text: string) =>
    addMessage({ id: Date.now().toString(), sender: 'user', text });

  const addBotMessage = (text: string) =>
    addMessage({ id: (Date.now() + 1).toString(), sender: 'bot', text });

  /* ----------  SEND TO WORKER  ---------- */
  const sendToWorker = async (userText: string) => {
    setLoading(true);
    addUserMessage(userText);

    /* Build full context again (we keep it in state to avoid re-reading) */
    const fullContext = messages
      .find((m) => m.sender === 'bot' && m.text.includes('J’ai chargé'))
      ?.text.split('\n')
      .slice(1, -3) // remove header & footer
      .join('\n');

      const body = {
        user_id: authUser?.id || 'anonymous',
        message: userText,
        context: products.map(p =>
          `${p.name} | ${p.price} CDF | Vendeur: ${p.sellerName} | Ville: ${p.city} | Catégorie: ${p.category} | Desc: ${p.description}`
        ).join('\n'),
      };

      
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      addBotMessage(data.reply || 'Pas de réponse du serveur.');
    } catch (e: any) {
      addBotMessage(`Erreur serveur : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ----------  INPUT HANDLING  ---------- */
  const onSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    sendToWorker(trimmed);
  };

  /* ----------  RENDER  ---------- */
  const renderItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.bubble,
        item.sender === 'user' ? styles.userBubble : styles.botBubble,
      ]}
    >
      <Text style={item.sender === 'user' ? styles.userText : styles.botText}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            loading ? (
              <ActivityIndicator size="small" color="#6a82fb" style={{ marginVertical: 10 }} />
            ) : null
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Posez votre question..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={loading}
          >
            <Ionicons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ----------  STYLES  ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: '#E2F5FF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userText: { color: '#005a9c' },
  botText: { color: '#333' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6a82fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#a0a0a0' },
});