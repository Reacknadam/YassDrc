// components/modals/SearchResultsModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Product } from '../../types';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 16px padding each side + 16px gap

interface Props {
  visible: boolean;
  onClose: () => void;
  results: Product[];
  onAddToCart: (p: Product) => void;
}

export default function SearchResultsModal({ visible, onClose, results, onAddToCart }: Props) {
  const { authUser } = useAuth();

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} style={styles.imageContainer}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>
          {typeof item.price === 'number' ? item.price.toLocaleString() : (item.price ?? '0')} CDF
        </Text>
        <Text style={styles.city}>{item.city}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddToCart(item);
          }}
        >
          <Feather name="shopping-cart" size={16} color="#fff" />
          <Text style={styles.addBtnTxt}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Résultats de recherche</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Liste */}
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.list,
            results.length === 0 && { flex: 1, justifyContent: 'center' },
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="search" size={64} color="#ccc" />
              <Text style={styles.emptyTxt}>Aucun produit trouvé</Text>
              <Text style={styles.emptySub}>Essayez un autre mot ou parcourez les catégories</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    width: CARD_WIDTH,
    marginHorizontal: 8,
    marginBottom: 0,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
    }),
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#eee',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  infoContainer: {
    padding: 10,
    gap: 4,
  },
  name: { fontSize: 15, fontWeight: '600', color: '#333', minHeight: 36 },
  price: { fontSize: 14, color: '#6C63FF', fontWeight: 'bold', marginTop: 2 },
  city: { fontSize: 13, color: '#666', marginBottom: 6 },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTxt: { marginTop: 12, fontSize: 16, color: '#333' },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 4 },
});