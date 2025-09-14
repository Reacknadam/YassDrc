import { firestore } from '@/firebase/config';
import { Product } from '@/types';
import {
  collection,
  DocumentSnapshot,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

interface ProductFilters {
  search: string;
  activeCategory: string;
  minPrice: string;
  maxPrice: string;
  minRating: number;
  sortBy: string;
  city: string;
}

export const useProductsAndSellers = (filters: ProductFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { search, activeCategory, minPrice, maxPrice, minRating, sortBy, city } = filters;

  const fetchProducts = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing && (loadingMore || !hasMore)) return;

    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const productsQuery = collection(firestore, 'products');
      let q;

      if (search.trim()) {
        q = query(
          productsQuery,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          orderBy('name', 'asc'),
          limit(10)
        );
      } else {
        const constraints: QueryConstraint[] = [];
        switch (sortBy) {
          case 'price_asc': constraints.push(orderBy('price', 'asc')); break;
          case 'price_desc': constraints.push(orderBy('price', 'desc')); break;
          case 'star_desc': constraints.push(orderBy('star', 'desc')); break;
          default: constraints.push(orderBy('createdAt', 'desc')); break;
        }

        if (city && city !== 'Toutes les villes') { constraints.push(where('city', '==', city)); }
        if (activeCategory !== 'Tous') { constraints.push(where('category', '==', activeCategory)); }
        if (minPrice) { constraints.push(where('price', '>=', parseFloat(minPrice))); }
        if (maxPrice) { constraints.push(where('price', '<=', parseFloat(maxPrice))); }
        if (minRating > 0) { constraints.push(where('star', '>=', minRating)); }
        
        constraints.push(limit(10));
        
        if (!isRefreshing && lastVisible) {
          constraints.push(startAfter(lastVisible));
        }

        q = query(productsQuery, ...constraints);
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty && !isRefreshing) {
        setHasMore(false);
      } else {
        const fetched: Product[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(prev => isRefreshing ? fetched : [...prev, ...fetched]);
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(fetched.length === 10);
      }
    } catch (error) {
      console.error('Erreur récupération produits:', error);
      // In a real app, you might want to set an error state here
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, activeCategory, minPrice, maxPrice, minRating, sortBy, city, loadingMore, hasMore, lastVisible]);

  const onRefresh = useCallback(() => {
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    fetchProducts(true);
  }, [fetchProducts]);

  const handleLoadMore = () => {
    fetchProducts();
  };

  useEffect(() => {
    setInitialLoading(true);
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    const debounce = setTimeout(() => {
      fetchProducts(true);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, activeCategory, minPrice, maxPrice, minRating, sortBy, city]);

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
