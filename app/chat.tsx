import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  limit,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
}

export default function ChatScreen() {
  const { id: currentChatId } = useLocalSearchParams<{ id: string }>();
  const { authUser } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList<Message>>(null);
  
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastVisibleMessage, setLastVisibleMessage] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const fetchAndCacheParticipantNames = async (participantIds: string[]) => {
    const newNames: Record<string, string> = { ...participantNames };
    if (authUser?.id) {
      newNames[authUser.id] = authUser.name || "Moi";
    }

    const userIdsToFetch = new Set<string>();
    participantIds.forEach(pId => {
      if (!newNames[pId] && pId !== authUser?.id) {
        userIdsToFetch.add(pId);
      }
    });

    for (const pId of Array.from(userIdsToFetch)) {
      try {
        const userDoc = await getDoc(doc(db, 'users', pId));
        if (userDoc.exists()) {
          newNames[pId] = userDoc.data().name || "Utilisateur";
        } else {
          newNames[pId] = "Utilisateur inconnu";
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du nom :", pId, error);
        newNames[pId] = "Erreur nom";
      }
    }
    setParticipantNames(newNames);
  };

  useEffect(() => {
    if (!authUser?.id || !currentChatId) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    const fetchChatInfo = async () => {
      try {
        const chatRef = doc(db, 'chats', currentChatId.toString());
        const chatSnap = await getDoc(chatRef);
        
        if (chatSnap.exists()) {
          const data = chatSnap.data();
          setParticipants(data.participants || []);
          await fetchAndCacheParticipantNames(data.participants || []);
        } else {
          console.error("Chat non trouvé :", currentChatId);
          router.back();
          return;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du chat :", error);
        router.back();
        return;
      }

      const messagesRef = collection(db, 'chats', currentChatId.toString(), 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages: Message[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];

        setMessages(fetchedMessages);
        setLoading(false);

        if (snapshot.docs.length > 0) {
          setLastVisibleMessage(snapshot.docs[snapshot.docs.length - 1]);
          setHasMoreMessages(snapshot.docs.length === 30);
        } else {
          setHasMoreMessages(false);
        }

        // Scroll to bottom when new messages arrive
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, (error) => {
        console.error("Erreur lors de l'écoute des messages :", error);
        setLoading(false);
      });

      return () => unsubscribe();
    };

    fetchChatInfo();
  }, [currentChatId, authUser?.id]);

  const fetchMoreMessages = async () => {
    if (isFetchingMore || !lastVisibleMessage || !hasMoreMessages) return;

    setIsFetchingMore(true);
    try {
      const messagesRef = collection(db, 'chats', currentChatId!.toString(), 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisibleMessage),
        limit(30)
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setHasMoreMessages(false);
        setIsFetchingMore(false);
        return;
      }

      const newMessages = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(prev => [...newMessages.reverse(), ...prev]);
      setLastVisibleMessage(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMoreMessages(querySnapshot.docs.length === 30);
    } catch (error) {
      console.error("Erreur lors du chargement des messages :", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() === '' || !authUser?.id || !currentChatId) return;

    try {
      const messagesRef = collection(db, 'chats', currentChatId.toString(), 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: authUser.id,
        timestamp: serverTimestamp(),
      });
      
      setNewMessage('');

      const chatRef = doc(db, 'chats', currentChatId.toString());
      await updateDoc(chatRef, {
        lastMessage: newMessage,
        lastMessageSenderId: authUser.id,
        lastMessageTimestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erreur lors de l'envoi du message :", error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === authUser?.id;
    const messageTime = item.timestamp ? 
      new Date(item.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
          <Text style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>{item.text}</Text>
          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement de la conversation...</Text>
      </SafeAreaView>
    );
  }

  const otherParticipantId = participants.find(pId => pId !== authUser?.id);
  const chatTitle = otherParticipantId ? participantNames[otherParticipantId] : "Chat";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{chatTitle}</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#333" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onEndReached={fetchMoreMessages}
        onEndReachedThreshold={0.2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={isFetchingMore ? 
          <ActivityIndicator size="small" color="#6C63FF" style={{ marginVertical: 10 }} /> : null}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 85 : 20}
        style={styles.inputWrapper}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Écrivez un message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            onPress={sendMessage} 
            style={[styles.sendButton, newMessage ? styles.activeSendButton : null]}
            disabled={!newMessage}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={newMessage ? "#fff" : "#999"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    color: '#666',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  moreButton: {
    padding: 4,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  myMessage: {
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  myMessageText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  otherMessageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  activeSendButton: {
    backgroundColor: '#6C63FF',
  },
});