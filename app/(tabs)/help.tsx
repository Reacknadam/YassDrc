// app/(tabs)/help.tsx
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

type FAQItem = { id: string; question: string; answer: string; category?: string; updatedAt?: any };

const HelpScreen = () => {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Toutes');
  

  const toggleItem = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const loadFaqs = async () => {
      setLoading(true);
      setError(null);
      try {
        const constraints: any[] = [];
        // Optionnel: filtrer côté serveur par catégorie si nécessaire
        // if (activeCategory !== 'Toutes') constraints.push(where('category', '==', activeCategory));
        constraints.push(orderBy('updatedAt', 'desc'));
        const q = query(collection(db, 'faqs'), ...constraints);
        const snap = await getDocs(q);
        const items: FAQItem[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setFaqs(items);
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    loadFaqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    faqs.forEach(f => f.category && set.add(f.category));
    return ['Toutes', ...Array.from(set)];
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    const base = activeCategory === 'Toutes' ? faqs : faqs.filter(f => f.category === activeCategory);
    if (!search.trim()) return base;
    const s = search.trim().toLowerCase();
    return base.filter(f => f.question.toLowerCase().includes(s) || f.answer.toLowerCase().includes(s));
  }, [faqs, search, activeCategory]);

  const contactMethods = [
    {
      icon: 'call-outline',
      title: 'Appeler le support',
      description: 'Du lundi au samedi, 8h-18h',
      action: () => Linking.openURL('tel:+243983627022')
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Chat en direct avec le bot',
      description: 'Réponse immédiate',
      action: () => router.push('/assistant-chat')
    },
    {
      icon: 'mail-outline',
      title: 'Envoyer un email',
      description: 'Réponse entre 0-24h',
      action: () => Linking.openURL('mailto:contact.yassdrc@gmail.com')
    },
    {
      icon: 'logo-whatsapp',
      title: 'Contacter par WhatsApp',
      description: 'Service client direct',
      action: () => Linking.openURL('https://wa.me/243983627022')
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête */}
        <LinearGradient
          colors={['#6E45E2', '#88D3CE']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.headerTitle}>Centre d'aide</Text>
          <Text style={styles.headerSubtitle}>Nous sommes là pour vous aider</Text>
        </LinearGradient>

        {/* Recherche et catégories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechercher</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              placeholder="Mot-clé (paiement, livraison...)"
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>
          {categories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {categories.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.chip, activeCategory === cat && styles.chipActive]}>
                  <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Méthodes de contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contactez-nous</Text>
          <View style={styles.contactGrid}>
            {contactMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactCard}
                onPress={method.action}
              >
                <View style={styles.contactIcon}>
                  <Ionicons name={method.icon as any} size={24} color="#6E45E2" />
                </View>
                <Text style={styles.contactTitle}>{method.title}</Text>
                <Text style={styles.contactDescription}>{method.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 10 }} color="#6C63FF" />
          ) : error ? (
            <Text style={{ color: '#e74c3c' }}>{error}</Text>
          ) : (
            <View style={styles.faqContainer}>
              {filteredFaqs.length === 0 ? (
                <Text style={{ color: '#666' }}>Aucun résultat.</Text>
              ) : (
                filteredFaqs.map((item) => (
                  <View key={item.id} style={styles.faqItem}>
                    <TouchableOpacity
                      style={styles.faqQuestion}
                      onPress={() => toggleItem(item.id)}
                    >
                      <Text style={styles.faqQuestionText}>{item.question}</Text>
                      <Ionicons
                        name={expandedItems[item.id] ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#666"
                      />
                    </TouchableOpacity>
                    {expandedItems[item.id] && (
                      <View style={styles.faqAnswer}>
                        <Text style={styles.faqAnswerText}>{item.answer}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations importantes</Text>
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={24} color="#6E45E2" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Heures de service</Text>
              <Text style={styles.infoText}>Lundi - Samedi: 8h00 - 18h00</Text>
              <Text style={styles.infoText}>Dimanche: 10h00 - 14h00</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#6E45E2" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Sécurité des paiements</Text>
              <Text style={styles.infoText}>Tous vos paiements sont cryptés et sécurisés. Nous ne stockons jamais vos informations bancaires.</Text>
            </View>
          </View>
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0</Text>
          <Text style={styles.footerText}>© 2025 YASS DRC App. Tous droits réservés.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#333',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  chip: {
    backgroundColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#6C63FF',
  },
  chipText: {
    color: '#333',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contactCard: {
    width: (width - 70) / 2,
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 15,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(110, 69, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  contactDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  faqContainer: {
    marginTop: 10,
  },
  faqItem: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
});

export default HelpScreen;