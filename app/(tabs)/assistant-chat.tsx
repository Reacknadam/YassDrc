import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';


const WORKER_URL = 'https://agent.israelntalu328.workers.dev/chat';


const QUICK_CHIPS = [
  'Smartphones pas chers',
  'Promos du jour',
  'Besoin d\'un laptop',
  'Électronique',
  'Mode femme',
];

/* ----------  TYPES  ---------- */
type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
};

/* ----------  SCREEN  ---------- */
export default function AssistantChatScreen() {
  const { authUser } = useAuth();
  // Message de bienvenue par défaut, comme demandé
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: '👋 Bienvenue chez Yass-DRC ! Je suis là pour vous aider à trouver le produit parfait. Que cherchez-vous aujourd\'hui ?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  /* ----------  CHAT UTILS  ---------- */
  const addMessage = (msg: Message) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const addUserMessage = (text: string) =>
    addMessage({ id: Date.now().toString(), sender: 'user', text });

  const addBotMessage = (text: string) =>
    addMessage({ id: (Date.now() + 1).toString(), sender: 'bot', text });

  /* ----------  QUERY LIMIT (inchangé) ---------- */
  const checkQueryLimit = async (): Promise<boolean> => {
    if (authUser?.isSellerVerified) return true;
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageStr = await AsyncStorage.getItem('@ai_query_usage');
      const usage = usageStr ? JSON.parse(usageStr) : { count: 0, date: today };
      if (usage.date !== today) {
        await AsyncStorage.setItem('@ai_query_usage', JSON.stringify({ count: 1, date: today }));
        return true;
      }
      if (usage.count >= 10) {
        Alert.alert('Limite atteinte', 'Vous avez atteint votre limite de 10 requêtes gratuites. Les vendeurs vérifiés bénéficient de requêtes illimitées.');
        return false;
      }
      await AsyncStorage.setItem('@ai_query_usage', JSON.stringify({ ...usage, count: usage.count + 1 }));
      return true;
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de vérifier votre limite de requêtes.');
      return false;
    }
  };

  /* ----------  SEND TO WORKER (simplifié) ---------- */
  const sendToWorker = async (userText: string) => {
    if (userText.trim().length === 0) return;

    setLoading(true);
    addUserMessage(userText);

    const canQuery = await checkQueryLimit();
    if (!canQuery) {
      setLoading(false);
      return;
    }

    // Le 'context' est maintenant géré par le worker, on envoie un body simple.
    const body = {
      user_id: authUser?.uid || 'anonymous',
      message: userText,
    };

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Le serveur a répondu: ${res.status}`);
      
      const data = await res.json();
      addBotMessage(data.reply || 'Désolé, je n\'ai pas de réponse pour le moment.');
    } catch (e: any) {
      addBotMessage(`Oups, une erreur de communication est survenue. Veuillez réessayer.`);
      Alert.alert('Erreur de communication', e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ----------  INPUT HANDLING  ---------- */
  const onSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    sendToWorker(trimmed);
  };

  const onChipPress = (chipText: string) => {
    if (loading) return;
    sendToWorker(chipText);
  }

  /* ----------  RENDER  ---------- */
  const renderItem = ({ item }: { item: Message }) => (
    <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
      <Text style={item.sender === 'user' ? styles.userText : styles.botText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            loading && messages.length > 0 ? (
              <ActivityIndicator size="small" color="#6a82fb" style={{ marginVertical: 10 }} />
            ) : null
          }
        />

        {/* ✅ Étape 5 (suite): Affichage des quick chips */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity key={chip} style={styles.chip} onPress={() => onChipPress(chip)} disabled={loading}>
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

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
          <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={onSend} disabled={loading}>
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
  list: { paddingHorizontal: 16, paddingTop: 16 },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginVertical: 4,
  },
  userBubble: { backgroundColor: '#E2F5FF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#F0F0F0', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userText: { color: '#005a9c', fontSize: 16 },
  botText: { color: '#333', fontSize: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#6a82fb',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#a0a0a0' },
  // Styles pour les quick chips
  chipsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipText: {
    color: '#333',
    fontSize: 14,
  },
});