import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import  { useEffect, useRef, useState } from 'react';
import * as React from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const WORKER_URL = 'https://agent.israelntalu328.workers.dev/chat';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
};

export default function AssistantChatScreen() {
  const { authUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 🧠 Charge les produits au montage
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      addBotMessage(
        `J’ai chargé ${products.length} produits. Que puis-je faire pour vous ?`
      );
      showQuickActions();
    } catch (e: any) {
      addBotMessage(`Erreur chargement produits : ${e.message}`);
    }
  };

  const addMessage = (msg: Message) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const addUserMessage = (text: string) =>
    addMessage({ id: Date.now().toString(), sender: 'user', text });

  const addBotMessage = (text: string) =>
    addMessage({ id: (Date.now() + 1).toString(), sender: 'bot', text });

  const showQuickActions = () => {
    const actions = [
      'Rechercher un produit',
      'Vérifier la fiabilité d’un vendeur',
      'Aide sur la plateforme',
      'Faire une réclamation',
    ];
    actions.forEach((a) => addBotMessage(`📌 ${a}`));
  };

  const sendToWorker = async (userText: string) => {
    setLoading(true);
    addUserMessage(userText);
    const body = {
      user_id: authUser?.id || 'anonymous',
      message: userText,
    };
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.reply) handleWorkerReply(data.reply);
    } catch (e: any) {
      addBotMessage(`Erreur serveur : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerReply = (reply: string) => {
    try {
      const json = JSON.parse(reply);
      if (json.name && json.price) {
        addBotMessage(
          `📦 ${json.name}\n💰 ${json.price} FC\n🧑‍🌾 ${json.sellerName}\n${json.description}`
        );
        return;
      }
      if (json.seller_name && json.rating_score !== undefined) {
        const fiabilite = json.is_reliable ? '✅ fiable' : '⚠️ peu fiable';
        addBotMessage(
          `Vendeur : ${json.seller_name}\nNote : ${json.rating_score}/10\n→ ${fiabilite}`
        );
        return;
      }
    } catch {
      // Pas du JSON → texte brut
      addBotMessage(reply);
    }
  };

  const handleFiabilite = async (text: string) => {
    const m = text.toLowerCase().match(/vendeur\s(.+)/i);
    if (!m || !m[1]) {
      addBotMessage('Veuillez préciser le nom du vendeur.');
      return;
    }
    const name = m[1].trim();
    try {
      const q = query(collection(db, 'users'), where('name', '==', name));
      const snap = await getDocs(q);
      if (snap.empty) {
        addBotMessage(`Aucun vendeur "${name}" trouvé.`);
        return;
      }
      const data = snap.docs[0].data();
      const score = data.rating_score ?? null;
      const reliable = score !== null && score >= 7.5;
      addBotMessage(
        `Vendeur : ${name}\nNote : ${score ?? 'N/A'}/10\n→ ${
          reliable ? '✅ fiable' : '⚠️ peu fiable'
        }`
      );
    } catch (e: any) {
      addBotMessage(`Erreur : ${e.message}`);
    }
  };

  const onSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');

    if (trimmed.toLowerCase().includes('fiabilité')) {
      handleFiabilite(trimmed);
      return;
    }
    sendToWorker(trimmed);
  };

  const renderItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.bubble,
        item.sender === 'user' ? styles.userBubble : styles.botBubble,
      ]}>
      <Text style={item.sender === 'user' ? styles.userText : styles.botText}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre message..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={loading}>
            <Ionicons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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