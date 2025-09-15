import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import * as React from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function UploadQR() {
  const { authUser } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<{ airtel?: string; orange?: string; mpesa?: string }>({});

  const pickImage = async (type: 'airtel' | 'orange' | 'mpesa') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const blob = await fetch(uri).then(r => r.blob());
      const fileRef = ref(storage, `qr-codes/${authUser?.id}_${type}.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);

      setImages(prev => ({ ...prev, [type]: url }));
      await updateDoc(doc(db, 'users', authUser!.id), {
        [`qrCodes.${type}`]: url,
      });

      Alert.alert('✅ Upload réussi', `QR code ${type.toUpperCase()} enregistré.`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR codes Mobile Money</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Ajoute ou mets à jour tes QR codes pour recevoir des paiements plus facilement.</Text>

        <View style={styles.cardsGrid}>
          {(['airtel', 'orange', 'mpesa'] as const).map(operator => (
            <View key={operator} style={styles.card}>
              <Text style={styles.cardTitle}>{operator.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => pickImage(operator)} style={styles.imageButton}>
                {images[operator] ? (
                  <Image source={{ uri: images[operator] }} style={styles.image} />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Ionicons name="image-outline" size={28} color="#999" />
                    <Text style={styles.placeholderText}>Ajouter une image</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => pickImage(operator)} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{images[operator] ? 'Modifier le QR code' : 'Ajouter le QR code'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: { padding: 10 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  container: { padding: 20, backgroundColor: '#f7f7f7' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  cardsGrid: { gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  imageButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    minHeight: 170,
  },
  image: { width: '100%', height: 170, borderRadius: 12, resizeMode: 'cover' },
  placeholderBox: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { marginTop: 6, color: '#999' },
  primaryButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});