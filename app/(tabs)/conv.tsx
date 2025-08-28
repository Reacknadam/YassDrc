import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

interface ChatPreview {
  id: string;
  participants: string[];
  lastMessageText?: string;
  lastMessageTimestamp?: any;
  lastMessageSenderId?: string;
}

export default function ConversationsScreen() {
  const router = useRouter();
  const { authUser } = useAuth();
  
  const [allUserChats, setAllUserChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const refreshConversations = async () => {
    setRefreshing(true);
    if (!authUser?.id) return;
    
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', authUser.id),
        orderBy('lastMessageTimestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const fetched: ChatPreview[] = [];
      const allParticipantIds = new Set<string>();

      snapshot.forEach((docSnap: QueryDocumentSnapshot) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          participants: data.participants,
          lastMessageText: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp,
          lastMessageSenderId: data.lastMessageSenderId,
        });
        data.participants.forEach((pId: string) => allParticipantIds.add(pId));
      });
      
      setAllUserChats(fetched);
      await fetchAndCacheParticipantNames(Array.from(allParticipantIds));
    } catch (error) {
      console.error("Erreur lors du rafraîchissement :", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authUser?.id) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', authUser.id),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetched: ChatPreview[] = [];
      const allParticipantIds = new Set<string>();

      snapshot.forEach((docSnap: QueryDocumentSnapshot) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          participants: data.participants,
          lastMessageText: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp,
          lastMessageSenderId: data.lastMessageSenderId,
        });
        data.participants.forEach((pId: string) => allParticipantIds.add(pId));
      });
      
      setAllUserChats(fetched);
      await fetchAndCacheParticipantNames(Array.from(allParticipantIds));
      setLoading(false);
    }, (error) => {
      console.error("Erreur lors de la récupération des conversations :", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authUser?.id]);

  const filteredChats = allUserChats.filter(chat => {
    if (!searchQuery) return true;
    
    const otherParticipants = chat.participants.filter(pId => pId !== authUser?.id);
    const chatName = otherParticipants
      .map(pId => participantNames[pId] || "")
      .join(', ');
    
    return chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (chat.lastMessageText || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderChatPreview = ({ item }: { item: ChatPreview }) => {
    const otherParticipants = item.participants.filter(pId => pId !== authUser?.id);
    const chatName = otherParticipants
      .map(pId => participantNames[pId] || "Chargement...")
      .join(', ');

    const lastMessageSender = item.lastMessageSenderId === authUser?.id 
      ? 'Vous' 
      : (participantNames[item.lastMessageSenderId || ''] || '...');
    
    const lastMessageDisplay = item.lastMessageText 
      ? `${lastMessageSender}: ${item.lastMessageText}` 
      : 'Aucun message';

    const timeAgo = item.lastMessageTimestamp ?
      new Date(item.lastMessageTimestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const hasUnread = Math.random() > 0.7;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => router.push({ 
          pathname: "/chat", 
          params: { id: item.id } 
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {chatName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatName || "Discussion"}
            </Text>
            <Text style={styles.chatTime}>{timeAgo}</Text>
          </View>
          <Text 
            style={[styles.lastMessage, hasUnread && styles.unreadMessage]} 
            numberOfLines={1}
          >
            {lastMessageDisplay}
          </Text>
        </View>
        
        {hasUnread && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des conversations...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity 
          style={styles.newChatButton} 
          onPress={() => router.push("/assistant-chat")} // Nouveau bouton pour le chat assistant
        >
          <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={filteredChats}
        renderItem={renderChatPreview}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshConversations}
            colors={['#6C63FF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ddd" />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubText}>
              Commencez une nouvelle conversation avec vos contacts
            </Text>
            <TouchableOpacity 
              style={styles.newChatButtonLarge}
              onPress={() => router.push("/assistant-chat")}
            >
              <Text style={styles.newChatButtonText}>Nouvelle conversation</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  list: {
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatContent: {
    flex: 1,
    paddingRight: 8,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#999',
  },
  unreadMessage: {
    color: '#333',
    fontWeight: '500',
  },
  unreadIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6C63FF',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  newChatButtonLarge: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
