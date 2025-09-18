import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppUser } from '../context/AuthContext';

interface HeaderProps {
  authUser: AppUser | null;
  theme: any;
  toggleTheme: () => void;
  cartItemCount: number;
  onCartPress: () => void;
  search: string;
  setSearch: (text: string) => void;
  onFilterPress: () => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  categories: string[];
}

const HomeScreenHeader: React.FC<HeaderProps> = ({
  authUser, theme, toggleTheme, cartItemCount, onCartPress,
  search, setSearch, onFilterPress,
  activeCategory, setActiveCategory, categories
}) => (
  <>
    <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
      <View>
        <Text style={[styles.greeting, { color: theme.colors.text }]}>Bonjour, {authUser?.name || 'Visiteur'}!</Text>
        <Text style={[styles.subGreeting, { color: theme.colors.textSecondary }]}>Découvrez nos produits</Text>
      </View>
      <View style={styles.headerIcons}>
        <Switch value={theme.mode === 'dark'} onValueChange={toggleTheme} />
        <TouchableOpacity onPress={onCartPress} style={styles.cartIcon}>
          <Feather name="shopping-bag" size={24} color={theme.colors.text} />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartItemCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>
    </View>

    <View style={[styles.searchRow, { backgroundColor: theme.colors.card }]}>
      <Feather name="search" size={20} color={theme.colors.textSecondary} />
      <TextInput
        style={[styles.searchInput, { color: theme.colors.text }]}
        placeholder="Rechercher un produit..."
        placeholderTextColor={theme.colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />
      <TouchableOpacity onPress={onFilterPress} style={styles.filterButton}>
        <Feather name="sliders" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>

    <View>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Catégories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryButton, { backgroundColor: activeCategory === cat ? theme.colors.primary : theme.colors.card }]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryText, { color: activeCategory === cat ? '#FFF' : theme.colors.text }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 10 }]}>Produits Récents</Text>
  </>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subGreeting: { fontSize: 16 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartIcon: { position: 'relative' },
  cartBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 16, marginVertical: 8, height: 50, },
  searchInput: { flex: 1, height: '100%', fontSize: 16, marginLeft: 8, },
  filterButton: { padding: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12 },
  categoryContainer: { paddingHorizontal: 16, paddingBottom: 10 },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginRight: 12 },
  categoryText: { fontSize: 14, fontWeight: '500' },
});
