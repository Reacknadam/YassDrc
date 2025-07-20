import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase';

interface NewsArticle {
  headline: string;
  body: string;
  author: string;
  publishedAt: string;
}

export default function NewsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      setLoading(true);
      try {
        const docRef = doc(firestore, 'news', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArticle(docSnap.data() as NewsArticle);
        } else {
          setArticle(null);
        }
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.center}>
        <Text>Article introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.headline}>{article.headline}</Text>
      <Text style={styles.author}>Auteur : {article.author}</Text>
      <Text style={styles.date}>Publié le : {article.publishedAt}</Text>
      <Text style={styles.body}>{article.body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headline: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  author: { fontSize: 14, color: '#666', marginBottom: 4 },
  date: { fontSize: 12, color: '#999', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 24 },
});
