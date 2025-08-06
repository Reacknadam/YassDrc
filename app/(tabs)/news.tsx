import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList, // Utilisé pour le pull-to-refresh principal
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Dimensions,
  RefreshControl, // Pour le pull-to-refresh
  Modal, // Pour les modales
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';

const { width } = Dimensions.get('window');

// Placeholder pour les images (à remplacer par une vraie image locale si possible)
const PLACEHOLDER_IMAGE = require('@/assets/images/icon.png'); // Assurez-vous d'avoir une image à cet emplacement

interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  author: string;
  publishedAt: string;
  imageUrl?: string;
}

interface Ad {
  id: string;
  imageUrl: string;
  linkUrl: string;
  timestamp?: any;
}

export default function NewsScreen() {
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Pour le pull-to-refresh
  const [isModalVisible, setIsModalVisible] = useState(false); // État de la visibilité de la modale
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null); // Article sélectionné pour la modale

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Actualités
      const newsSnapshot = await getDocs(query(collection(db, 'news'), orderBy('publishedAt', 'desc')));
      const fetchedArticles: NewsArticle[] = newsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        publishedAt: doc.data().publishedAt?.toDate ? doc.data().publishedAt.toDate().toLocaleDateString('fr-FR') : doc.data().publishedAt, // Formater la date
      })) as NewsArticle[];

      setFeaturedArticle(fetchedArticles[0] || null);
      setArticles(fetchedArticles.slice(1));

      // Publicités
      const adsSnapshot = await getDocs(query(collection(db, 'ads'), orderBy('timestamp', 'desc'), limit(1)));
      const fetchedAds: Ad[] = adsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ad[];
      setAds(fetchedAds);

    } catch (error) {
      console.error('Erreur lors du chargement des données :', error);
      Alert.alert('Erreur de Chargement', 'Impossible de charger les données. Veuillez vérifier votre connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false); // Arrête l'indicateur de rafraîchissement
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-rafraîchissement toutes les 5 minutes
    const intervalId = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes en millisecondes

    // Nettoyage de l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleAdClick = (url: string) => {
    Linking.openURL(url).catch(err => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le lien de la publicité. Assurez-vous que le lien est valide.');
    });
  };

  const openArticleModal = (article: NewsArticle) => {
    setSelectedArticle(article);
    setIsModalVisible(true);
  };

  const renderArticleItem = ({ item }: { item: NewsArticle }) => (
    <TouchableOpacity style={styles.articleCard} onPress={() => openArticleModal(item)}>
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.articleImage}
          resizeMode="cover"
          defaultSource={PLACEHOLDER_IMAGE}
        />
      ) : (
        <Image
          source={PLACEHOLDER_IMAGE}
          style={styles.articleImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{item.headline}</Text>
        <Text style={styles.articleTimestamp}>{item.publishedAt}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) { // Affiche l'indicateur de chargement initial
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des actualités...</Text>
      </View>
    );
  }

  // Contenu principal de l'écran, maintenant dans une FlatList pour le pull-to-refresh
  const mainContent = () => (
    <>
      {featuredArticle && (
        <TouchableOpacity style={styles.featuredSection} onPress={() => openArticleModal(featuredArticle)}>
          {featuredArticle.imageUrl ? (
            <Image
              source={{ uri: featuredArticle.imageUrl }}
              style={styles.featuredImage}
              resizeMode="cover"
              defaultSource={PLACEHOLDER_IMAGE}
            />
          ) : (
            <Image
              source={PLACEHOLDER_IMAGE}
              style={styles.featuredImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredTitle}>{featuredArticle.headline}</Text>
            <Text style={styles.featuredTimestamp}>{featuredArticle.publishedAt}</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Dernières Nouvelles</Text>
      {articles.length > 0 ? (
        <FlatList
          data={articles}
          renderItem={renderArticleItem}
          keyExtractor={item => item.id}
          scrollEnabled={false} // Désactiver le scroll pour cette FlatList imbriquée
          initialNumToRender={5} // Optimisation
          windowSize={10} // Optimisation
        />
      ) : (
        <View style={styles.noContent}>
          <Ionicons name="folder-open-outline" size={50} color="#999" />
          <Text style={styles.noContentText}>Aucun article disponible pour le moment.</Text>
        </View>
      )}

      {ads.length > 0 && (
        <TouchableOpacity style={styles.adBanner} onPress={() => handleAdClick(ads[0].linkUrl)}>
          {ads[0].imageUrl ? (
            <Image
              source={{ uri: ads[0].imageUrl }}
              style={styles.adBannerImage}
              resizeMode="cover"
              defaultSource={PLACEHOLDER_IMAGE}
            />
          ) : (
            <Image
              source={PLACEHOLDER_IMAGE}
              style={styles.adBannerImage}
              resizeMode="cover"
            />
          )}
          <Text style={styles.adBannerText}>Sponsorisé</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actualités</Text>
      </View>
      <FlatList
        data={[]} // Aucune donnée ici, le contenu est rendu par ListHeaderComponent et ListFooterComponent
        ListHeaderComponent={mainContent}
        keyExtractor={(item, index) => index.toString()}
        renderItem={null} // Pas d'éléments à rendre directement
        contentContainerStyle={styles.scrollContent}
        refreshControl={ // Implémentation du pull-to-refresh
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6C63FF']} // Couleur de l'indicateur de rafraîchissement
            tintColor={'#6C63FF'} // Couleur de l'indicateur sur iOS
          />
        }
      />

      {/* Modale d'affichage de l'article */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isModalVisible}
        onRequestClose={() => {
          setIsModalVisible(!isModalVisible);
        }}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={30} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderText}>Détail de l'Article</Text>
          </View>
          {selectedArticle && (
            <FlatList
              data={[{ key: 'content' }]} // Une seule "item" pour le contenu de l'article
              renderItem={() => (
                <View style={styles.modalContent}>
                  {selectedArticle.imageUrl && (
                    <Image
                      source={{ uri: selectedArticle.imageUrl }}
                      style={styles.modalImage}
                      resizeMode="cover"
                      defaultSource={PLACEHOLDER_IMAGE}
                    />
                  )}
                  <Text style={styles.modalTitle}>{selectedArticle.headline}</Text>
                  <View style={styles.modalMeta}>
                    <Text style={styles.modalAuthor}>Par : {selectedArticle.author || 'Inconnu'}</Text>
                    <Text style={styles.modalTimestamp}>{selectedArticle.publishedAt}</Text>
                  </View>
                  <Text style={styles.modalBody}>{selectedArticle.body}</Text>
                </View>
              )}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  scrollContent: { paddingBottom: 20 }, // Appliqué à la FlatList principale
  featuredSection: { height: 250, marginBottom: 20, borderRadius: 12, overflow: 'hidden', marginHorizontal: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5 },
  featuredImage: { width: '100%', height: '100%' },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12, // Pour correspondre au bord de la section
  },
  featuredTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  featuredTimestamp: { fontSize: 14, color: '#fff', marginTop: 5 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 20
  },
  articleCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    marginHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  articleImage: { width: 100, height: '100%', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  articleContent: { flex: 1, padding: 15, justifyContent: 'center' },
  articleTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  articleTimestamp: { fontSize: 12, color: '#999' },
  adBanner: {
    marginHorizontal: 20,
    marginTop: 20, // Ajout d'une marge supérieure pour séparer des articles
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    backgroundColor: '#fff', // Ajout d'un fond blanc pour l'ombre
  },
  adBannerImage: { width: '100%', height: 120, borderRadius: 12 },
  adBannerText: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    fontSize: 12
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },
  loadingText: { fontSize: 16, color: '#6C63FF', marginTop: 10 },
  noContent: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
  noContentText: { fontSize: 16, color: '#999', marginTop: 10, textAlign: 'center' },

  // Styles pour la modale
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 30, // Pour compenser le bouton de fermeture
  },
  modalCloseButton: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
  },
  modalContent: {
    padding: 20,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalAuthor: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalTimestamp: {
    fontSize: 14,
    color: '#666',
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
});