import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

/* ---------- Hook de cache ---------- */
const useImageCache = () => {
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('imageCache');
        if (raw) setImageCache(JSON.parse(raw));
      } catch (e) {
        console.warn('Erreur chargement cache image :', e);
      }
    })();
  }, []);

  const updateCache = async (url: string, base64: string) => {
    // ⚠️ simple garde-fou taille (≈ 100 ko)
    if (base64.length > 140_000) return;

    const next = { ...imageCache, [url]: base64 };
    setImageCache(next);
    try {
      await AsyncStorage.setItem('imageCache', JSON.stringify(next));
    } catch (e) {
      console.warn('Erreur écriture cache image :', e);
    }
  };

  return { imageCache, updateCache };
};

/* ---------- Composant ---------- */
interface OptimizedImageProps {
  source: { uri?: string };
  style?: any;
  [key: string]: any;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  ...imgProps
}) => {
  const [loading, setLoading] = useState(true);
  const [uri, setUri] = useState<string | null>(null);
  const { imageCache, updateCache } = useImageCache();

  useEffect(() => {
    const cleanUri = (source.uri ?? '').trim();
    if (!cleanUri) {
      setLoading(false);
      return;
    }

    // 1) déjà en mémoire ?
    if (imageCache[cleanUri]) {
      setUri(imageCache[cleanUri]);
      setLoading(false);
      return;
    }

    // 2) télécharger
    (async () => {
      try {
        const res = await fetch(cleanUri);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          setUri(b64);
          updateCache(cleanUri, b64);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.warn('OptimizedImage :', e);
        setUri(cleanUri); // fallback URI originale
      } finally {
        setLoading(false);
      }
    })();
  }, [source.uri]); // ← pas d’imageCache ici

  return (
    <View style={style}>
      {loading && (
        <ActivityIndicator
          style={StyleSheet.absoluteFillObject}
          size="small"
          color="#6C63FF"
        />
      )}
      <Image
        source={{ uri: uri || undefined }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        {...imgProps}
      />
    </View>
  );
};

export default OptimizedImage;