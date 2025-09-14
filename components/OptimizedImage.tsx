import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

// Hook personnalisé pour le cache d'images
const useImageCache = () => {
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  // Charger le cache au démarrage
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cachedImages = await AsyncStorage.getItem('imageCache');
        if (cachedImages) {
          setImageCache(JSON.parse(cachedImages));
        }
      } catch (error) {
        console.error('Erreur lors du chargement du cache:', error);
      }
    };
    loadCache();
  }, []);

  // Mettre à jour le cache
  const updateCache = async (url: string, localUri: string) => {
    const newCache = { ...imageCache, [url]: localUri };
    setImageCache(newCache);
    try {
      await AsyncStorage.setItem('imageCache', JSON.stringify(newCache));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du cache:', error);
    }
  };

  return { imageCache, updateCache };
};

// Composant OptimizedImage avec cache
interface OptimizedImageProps {
  source: { uri: string };
  style: any;
  [key: string]: any;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ source, style, ...props }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const { imageCache, updateCache } = useImageCache();

  useEffect(() => {
    const loadImage = async () => {
      if (!source.uri) {
        setIsLoading(false);
        return;
      }

      // Vérifier si l'image est en cache
      if (imageCache[source.uri]) {
        setLocalUri(imageCache[source.uri]);
        setIsLoading(false);
        return;
      }

      // Télécharger et mettre en cache l'image
      try {
        const response = await fetch(source.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64data = reader.result as string;
          setLocalUri(base64data);
          updateCache(source.uri, base64data);
          setIsLoading(false);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Erreur de chargement image:', error);
        setLocalUri(source.uri); // Fallback to original uri on error
        setIsLoading(false);
      }
    };

    loadImage();
  }, [source.uri, imageCache]);

  return (
    <View style={style}>
      {isLoading && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          size="small"
          color="#6C63FF"
        />
      )}
      <Image
        source={localUri ? { uri: localUri } : source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        {...props}
      />
    </View>
  );
};

export default OptimizedImage;
