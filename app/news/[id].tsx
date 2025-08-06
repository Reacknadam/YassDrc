import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useRouter } from 'expo-router';

interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  author: string;
  publishedAt: string;
  image?: string;
  category: 'news' | 'annonce' | 'produit';
}

export default function NewsScreen() {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const querySnapshot = await getDocs(collection(db, 'news'));
        const data: NewsArticle[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as NewsArticle[];
        setItems(data);
      } catch (error) {
        console.error('Erreur de chargement :', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const renderSection = (title: string, filter: 'news' | 'annonce' | 'produit') => {
    const sectionItems = items.filter(item => item.category === filter);
    if (sectionItems.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sectionItems.map(item => (
          <TouchableOpacity key={item.id} onPress={() => router.push(`/news/${item.id}`)} style={styles.card}>
            {item.image && <Image source={{ uri: item.image }} style={styles.image} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.headline}>{item.headline}</Text>
              <Text style={styles.meta}>{item.author} • {item.publishedAt}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {renderSection('📰 Actualités', 'news')}
      {renderSection('📢 Annonces', 'annonce')}
      {renderSection('🛍️ Produits en vedette', 'produit')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    elevation: 2,
  },
  image: { width: 80, height: 80, borderRadius: 10, marginRight: 10 },
  headline: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  meta: { fontSize: 12, color: '#555' },
});
