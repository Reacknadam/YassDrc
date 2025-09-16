// hooks/useCart.ts

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Product } from '../types'; // Assurez-vous d'avoir ce chemin correct vers votre fichier types/index.ts

const CART_STORAGE_KEY = 'userCart';

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Charger le panier depuis AsyncStorage au démarrage de l'application
  useEffect(() => {
    const loadCart = async () => {
      try {
        const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        }
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
      }
    };
    loadCart();
  }, []);

  // Sauvegarder le panier dans AsyncStorage à chaque modification
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.error('Erreur lors de la sauvegarde du panier:', error);
      }
    };
    saveCart();
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart((prevCart) => {
      if (newQuantity <= 0) {
        // Supprimer l'article si la quantité est de 0 ou moins
        return prevCart.filter((item) => item.id !== productId);
      }
      return prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Grouper les articles du panier par vendeur
  const groupCartBySeller = () => {
    return cart.reduce((acc, item) => {
      const sellerId = item.sellerId;
      if (!acc[sellerId]) {
        acc[sellerId] = [];
      }
      acc[sellerId].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>); // Assurez-vous de bien typer l'accumulateur
  };

  // Calculer le total général du panier
  const cartTotal = cart.reduce<number>((sum, item) => sum + (item.price * item.quantity), 0);

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    groupCartBySeller,
    cartTotal,
    setCart, // Exposez setCart si le composant parent a besoin de le manipuler directement (ex: après une commande)
  };
};