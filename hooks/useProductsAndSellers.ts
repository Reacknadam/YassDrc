import { db } from '../firebase/config'; // CORRIGÉ: Utiliser l'instance 'db' exportée
import { Product } from '../types';
import {
  collection,
  DocumentSnapshot,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

// Interface pour les filtres reste la même
interface ProductFilters {
  search: string;
  activeCategory: string;
  minPrice: string;
  maxPrice: string;
  minRating: number;
  sortBy: string;
  city: string;
}

/**
 * [OPTIMISATION] Fonction pure et testable pour construire les contraintes de la requête Firestore.
 * Cela découple la logique de construction de requête du cycle de vie du composant React.
 * @param filters - Les filtres de produits actuels.
 * @returns Un tableau de QueryConstraint à utiliser avec la fonction query().
 */
const buildQueryConstraints = (filters: ProductFilters): QueryConstraint[] => {
  const { search, activeCategory, minPrice, maxPrice, minRating, sortBy, city } = filters;
  const constraints: QueryConstraint[] = [];

  // [SÉCURITÉ/UX] Implémentation de la recherche insensible à la casse.
  // NOTE: Cela nécessite que vos documents dans Firestore aient un champ 'name_lowercase'.
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch) {
    constraints.push(where('name_lowercase', '>=', normalizedSearch));
    constraints.push(where('name_lowercase', '<=', normalizedSearch + '\uf8ff'));
    // Firestore exige que le premier orderBy corresponde au champ de l'inégalité de recherche
    constraints.push(orderBy('name_lowercase', 'asc'));
    return constraints; // La recherche est exclusive, on ne combine pas avec d'autres tris/filtres
  }

  // [BUG FIX] Gestion dynamique du tri pour respecter les contraintes de Firestore
  let hasInequalityFilter = false;

  // Filtres d'inégalité
  if (minPrice) {
    constraints.push(where('price', '>=', parseFloat(minPrice)));
    constraints.push(orderBy('price', 'asc')); // Le premier orderBy DOIT être sur 'price'
    hasInequalityFilter = true;
  }
  if (maxPrice && !hasInequalityFilter) { // On ajoute le orderBy que si non déjà fait
    constraints.push(where('price', '<=', parseFloat(maxPrice)));
    constraints.push(orderBy('price', 'desc')); // Un choix par défaut
    hasInequalityFilter = true;
  } else if (maxPrice) {
    constraints.push(where('price', '<=', parseFloat(maxPrice)));
  }

  if (minRating > 0 && !hasInequalityFilter) {
    constraints.push(where('star', '>=', minRating));
    constraints.push(orderBy('star', 'desc'));
    hasInequalityFilter = true;
  } else if (minRating > 0) {
    constraints.push(where('star', '>=', minRating));
  }
  
  // Filtres d'égalité (peuvent être ajoutés sans contrainte)
  if (city && city !== 'Toutes les villes') {
    constraints.push(where('city', '==', city));
  }
  if (activeCategory !== 'Tous') {
    constraints.push(where('category', '==', activeCategory));
  }

  // Si aucun filtre d'inégalité n'a été appliqué, on peut utiliser le tri choisi par l'utilisateur.
  if (!hasInequalityFilter) {
    switch (sortBy) {
      case 'price_asc': constraints.push(orderBy('price', 'asc')); break;
      case 'price_desc': constraints.push(orderBy('price', 'desc')); break;
      case 'star_desc': constraints.push(orderBy('star', 'desc')); break;
      default: constraints.push(orderBy('createdAt', 'desc')); break;
    }
  }

  return constraints;
};


export const useProductsAndSellers = (filters: ProductFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // [BUG FIX & ARCHITECTURE] On déstructure les filtres pour utiliser des valeurs primitives
  // dans les tableaux de dépendances des hooks. Cela empêche la boucle de rendu infinie.
  const { search, activeCategory, minPrice, maxPrice, minRating, sortBy, city } = filters;

  const stateRef = useRef({ loadingMore, hasMore, lastVisible });
  stateRef.current = { loadingMore, hasMore, lastVisible };

  const fetchProducts = useCallback(async (isInitialFetch = false) => {
    const { loadingMore, hasMore } = stateRef.current;
    
    if (!isInitialFetch && (loadingMore || !hasMore)) return;

    if (isInitialFetch) {
      setInitialLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const productsRef = collection(db, 'products');
      // On passe l'objet de filtres directement, la fonction est mémoizée correctement maintenant.
      const finalConstraints = buildQueryConstraints(filters);

      if (!isInitialFetch && stateRef.current.lastVisible) {
        finalConstraints.push(startAfter(stateRef.current.lastVisible));
      }

      finalConstraints.push(limit(10));

      const q = query(productsRef, ...finalConstraints);
      const querySnapshot = await getDocs(q);

      const fetchedProducts: Product[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Product));
      
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      
      setProducts(prev => isInitialFetch ? fetchedProducts : [...prev, ...fetchedProducts]);
      setLastVisible(lastDoc);
      setHasMore(fetchedProducts.length === 10);

    } catch (error) {
      console.error('Erreur critique lors de la récupération des produits:', error);
      setHasMore(false);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
    // La dépendance est maintenant un tableau de primitives stables.
  }, [search, activeCategory, minPrice, maxPrice, minRating, sortBy, city]);

  useEffect(() => {
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);

    const debounceTimer = setTimeout(() => {
      fetchProducts(true);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts(true);
  }, [fetchProducts]);

  const handleLoadMore = useCallback(() => {
    fetchProducts(false);
  }, [fetchProducts]);


  return {
    products,
    initialLoading,
    loadingMore,
    refreshing,
    hasMore,
    onRefresh,
    handleLoadMore,
  };
};

