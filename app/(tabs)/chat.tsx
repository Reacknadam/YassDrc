import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
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
  where,
  updateDoc,
  limit,
  startAfter, // Ajout de l'import startAfter pour la pagination
  getDocs,    // Ajout de l'import getDocs pour la pagination
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Interface pour les messages
interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
  senderName?: string;
}

// Interface pour la prévisualisation d'un chat (pour la liste)
interface ChatPreview {
  id: string;
  participants: string[];
  lastMessageText?: string;
  lastMessageTimestamp?: any;
  lastMessageSenderId?: string;
}

export default function ChatMasterDetailScreen() {
  const { id: currentChatId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const [chatParticipants, setChatParticipants] = useState<string[]>([]);
  const flatListRef = useRef<FlatList<Message>>(null);
  const textInputRef = useRef<TextInput>(null);

  const [allUserChats, setAllUserChats] = useState<ChatPreview[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Ajout de l'état pour la pagination des messages
  const [isFetchingMoreMessages, setIsFetchingMoreMessages] = useState(false);
  const [lastVisibleMessage, setLastVisibleMessage] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const fetchAndCacheParticipantNames = async (participantIds: string[]) => {
    const newNames: Record<string, string> = { ...participantNames };
    if (user?.id) {
        newNames[user.id] = user.name || "Moi";
    }

    const userIdsToFetch = new Set<string>();
    participantIds.forEach(pId => {
      if (!newNames[pId] && pId !== user?.id) {
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
        console.error("Erreur lors de la récupération du nom du participant :", pId, error);
        newNames[pId] = "Erreur nom";
      }
    }
    setParticipantNames(newNames);
  };

  useEffect(() => {
    if (!user?.id) {
      router.replace('/login');
      return;
    }

    if (currentChatId) {
      setLoadingChat(true);
      const fetchCurrentChatInfo = async () => {
        try {
          const chatRef = doc(db, 'chats', currentChatId);
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const data = chatSnap.data();
            setChatParticipants(data.participants || []);
            await fetchAndCacheParticipantNames(data.participants || []);

          } else {
            console.error("Chat non trouvé :", currentChatId);
            router.back();
            return;
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des infos du chat :", error);
          router.back();
          return;
        }

        const messagesRef = collection(db, 'chats', currentChatId, 'messages');
        // Optimisation de la consommation de données :
        // On ne charge que les 30 derniers messages initialement.
        // On trie par ordre décroissant et on utilise la prop 'inverted' de la FlatList
        // pour que les messages s'affichent du bas vers le haut.
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(30));

        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
          const fetchedMessages: Message[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[];

          setMessages(fetchedMessages);
          setLoadingChat(false);

          // Le dernier message visible est le plus ancien dans notre liste inversée
          if (snapshot.docs.length > 0) {
            setLastVisibleMessage(snapshot.docs[snapshot.docs.length - 1]);
            setHasMoreMessages(snapshot.docs.length === 30);
          } else {
            setHasMoreMessages(false);
          }
        }, (error) => {
          console.error("Erreur lors de l'écoute des messages :", error);
          setLoadingChat(false);
        });

        return () => unsubscribeMessages();
      };
      fetchCurrentChatInfo();
    }
  }, [currentChatId, user?.id]);

  // Nouveau useEffect pour gérer le focus automatique du champ de texte.
  useEffect(() => {
    if (currentChatId && !loadingChat && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 500); // Délai un peu plus long pour plus de fiabilité
    }
  }, [currentChatId, loadingChat]);

  useEffect(() => {
    if (!user?.id) return;

    if (!currentChatId) {
      setLoadingConversations(true);
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.id),
        orderBy('lastMessageTimestamp', 'desc')
      );

      const unsubscribeAllChats = onSnapshot(q, async (snapshot) => {
        const fetched: ChatPreview[] = [];
        const allParticipantIdsInChats = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            participants: data.participants,
            lastMessageText: data.lastMessage,
            lastMessageTimestamp: data.lastMessageTimestamp,
            lastMessageSenderId: data.lastMessageSenderId,
          });
          data.participants.forEach((pId: string) => allParticipantIdsInChats.add(pId));
        });
        setAllUserChats(fetched);
        await fetchAndCacheParticipantNames(Array.from(allParticipantIdsInChats));
        setLoadingConversations(false);
      }, (error) => {
        console.error("Erreur lors de la récupération des conversations :", error);
        setLoadingConversations(false);
      });

      return () => unsubscribeAllChats();
    }
  }, [currentChatId, user?.id]);

  const fetchMoreMessages = async () => {
    if (isFetchingMoreMessages || !lastVisibleMessage || !hasMoreMessages) return;

    setIsFetchingMoreMessages(true);
    try {
      const messagesRef = collection(db, 'chats', currentChatId!, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisibleMessage),
        limit(30)
      );

      // getDocs est utilisé ici pour une requête ponctuelle et non un listener en temps réel
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setHasMoreMessages(false);
        setIsFetchingMoreMessages(false);
        return;
      }

      const newMessages = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(prevMessages => [...prevMessages, ...newMessages]);
      setLastVisibleMessage(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMoreMessages(querySnapshot.docs.length === 30);

    } catch (error) {
      console.error("Erreur lors du chargement de plus de messages :", error);
    } finally {
      setIsFetchingMoreMessages(false);
    }
  };


  const sendMessage = async () => {
    if (newMessage.trim() === '' || !user?.id || !currentChatId) {
      return;
    }

    try {
      const messagesRef = collection(db, 'chats', currentChatId, 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: user.id,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');

      const chatRef = doc(db, 'chats', currentChatId);
      await updateDoc(chatRef, {
        lastMessage: newMessage,
        lastMessageSenderId: user.id,
        lastMessageTimestamp: serverTimestamp(),
      });

    } catch (error) {
      console.error("Erreur lors de l'envoi du message :", error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;

    return (
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
        <Text style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>{item.text}</Text>
        {item.timestamp && (
          <Text style={isMyMessage ? styles.myMessageTime : styles.otherMessageTime}>
            {new Date(item.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  };

  const renderChatPreview = ({ item }: { item: ChatPreview }) => {
    const otherParticipants = item.participants.filter(pId => pId !== user?.id);
    const chatName = otherParticipants
      .map(pId => participantNames[pId] || "Chargement...")
      .join(', ');

    const lastMessageSender = item.lastMessageSenderId === user?.id ? 'Moi' : (participantNames[item.lastMessageSenderId || ''] || '...');
    const lastMessageDisplay = item.lastMessageText ? `${lastMessageSender}: ${item.lastMessageText}` : 'Aucun message';

    const timeAgo = item.lastMessageTimestamp ?
      new Date(item.lastMessageTimestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        // Utilisation de router.push pour créer un historique de navigation
        onPress={() => router.push({ pathname: '/chat', params: { id: item.id } })}
      >
        <Ionicons name="person-circle-outline" size={40} color="#6C63FF" style={styles.chatIcon} />
        <View style={styles.chatContent}>
          <Text style={styles.chatName}>{chatName || "Discussion"}</Text>
          <Text style={styles.lastMessage}>{lastMessageDisplay}</Text>
        </View>
        <Text style={styles.chatTime}>{timeAgo}</Text>
      </TouchableOpacity>
    );
  };


  if (currentChatId) {
    // Écran du chat
    if (loadingChat) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Chargement du chat...</Text>
        </SafeAreaView>
      );
    }

    const otherParticipantId = chatParticipants.find(pId => pId !== user?.id);
    const chatTitle = otherParticipantId ? participantNames[otherParticipantId] : "Chat";

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#6C63FF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{chatTitle}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.chatSelectorButton}>
              <Ionicons name="list" size={24} color="#6C63FF" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted
          ListHeaderComponent={isFetchingMoreMessages ? <ActivityIndicator size="small" color="#6C63FF" style={{marginVertical: 10}} /> : null}
          onEndReached={fetchMoreMessages}
          onEndReachedThreshold={0.5}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
          style={styles.inputContainer}
        >
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );

  } else {
    // Écran de la liste des conversations
    if (loadingConversations) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Chargement des conversations...</Text>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vos Conversations</Text>
        </View>
        <FlatList
          data={allUserChats}
          renderItem={renderChatPreview}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatsList}
          ListEmptyComponent={<Text style={styles.emptyListText}>Aucune conversation pour le moment.</Text>}
        />
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f4',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  chatSelectorButton: {
    padding: 5,
    marginLeft: 10,
  },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 2,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C63FF',
    borderTopRightRadius: 5,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderTopLeftRadius: 5,
  },
  myMessageText: {
    fontSize: 16,
    color: '#fff',
  },
  otherMessageText: {
    fontSize: 16,
    color: '#333',
  },
  myMessageTime: {
    fontSize: 10,
    color: '#eee',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  otherMessageTime: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef1f4',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#eef1f4',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatsList: {
    paddingVertical: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  chatIcon: {
    marginRight: 15,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 10,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#777',
  },
});
