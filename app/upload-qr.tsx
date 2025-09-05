import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function UploadQR() {
  const { authUser } = useAuth();
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
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Ajoute tes QR codes Mobile Money</Text>

      {(['airtel', 'orange', 'mpesa'] as const).map(operator => (
        <View key={operator} style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: '600', marginBottom: 5 }}>{operator.toUpperCase()}</Text>
          <TouchableOpacity
            onPress={() => pickImage(operator)}
            style={{
              backgroundColor: '#eee',
              padding: 15,
              borderRadius: 10,
              alignItems: 'center',
            }}>
            {images[operator] ? (
              <Image source={{ uri: images[operator] }} style={{ width: 150, height: 150 }} />
            ) : (
              <Text>Appuie pour ajouter</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}