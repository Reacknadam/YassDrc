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
} from 'react-native';
import { Product } from '../../types';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../hooks/useCart'; // ton hook panier
import * as Haptics from 'expo-haptics';

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
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.price}>{item.price.toLocaleString()} CDF</Text>
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
          contentContainerStyle={styles.list}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  price: { fontSize: 14, color: '#6C63FF', fontWeight: 'bold' },
  city: { fontSize: 13, color: '#666' },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTxt: { marginTop: 12, fontSize: 16, color: '#333' },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 4 },
});