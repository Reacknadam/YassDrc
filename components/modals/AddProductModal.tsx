import { useAuth } from '../../context/AuthContext';
import { storage } from '../../firebase/config';
import { createProduct } from '../../services/productService';
import { Picker } from '@react-native-picker/picker';
import { AntDesign, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { serverTimestamp } from 'firebase/firestore';

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onProductAdded: () => void;
}

const AddProductModal: React.FC<AddProductModalProps> = ({ visible, onClose, onProductAdded }) => {
  const { authUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('Kinshasa');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const categories = ['Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation'];
  const cities = ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Bukavu', 'Matadi', 'Kolwezi'];

  const resetForm = () => {
    setImages([]);
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setCity('Kinshasa');
    setUploadProgress(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const uploadImageAsync = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `${authUser?.id}_${Date.now()}`;
      const storageRef = ref(storage, `products/${authUser?.id}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload error:", error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              console.error("Error getting download URL:", error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error creating blob:", error);
      throw new Error("Failed to upload image");
    }
  };

  const handleAddProduct = async () => {
    if (loading) return;
    if (!authUser?.id || !name.trim() || !description.trim() || !price.trim() || images.length === 0 || !city) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs, y compris la ville, et ajouter au moins une image.');
      return;
    }
    setLoading(true);
    setUploadProgress(0);
    try {
      const imageUrls = await Promise.all(images.map(uri => uploadImageAsync(uri)));
      setUploadProgress(null);
      await createProduct({
        name,
        description,
        price: parseFloat(price),
        images: imageUrls,
        category: category || 'Général',
        city,
        sellerId: authUser.id,
        sellerName: authUser.shopName || authUser.name || 'Vendeur Anonyme',
        sellerPhotoUrl: authUser.photoUrl || '',
        createdAt: serverTimestamp()
      });
      Alert.alert('Succès', 'Produit publié avec succès !');
      onProductAdded(); // Callback to refresh product list
      handleClose();
    } catch (error) {
      console.error('Erreur publication produit:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de la publication.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const confirmAndPublish = () => {
    Alert.alert(
      "Confirmer la publication",
      "Voulez-vous vraiment publier ce produit ?",
      [{ text: "Annuler", style: "cancel" }, { text: "Publier", onPress: handleAddProduct }]
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.slice(0, 3).map(asset => asset.uri);
      setImages(prev => [...prev, ...uris].slice(0, 3));
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, 3));
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.bottomSheetContainer}>
          <View style={styles.handleBar} />
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un produit</Text>
              <TouchableOpacity onPress={handleClose}>
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Nom du produit</Text>
            <TextInput placeholder="iPhone 13 Pro Max" value={name} onChangeText={setName} style={styles.input} />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput placeholder="Description détaillée..." value={description} onChangeText={setDescription} style={[styles.input, styles.multilineInput]} multiline />
            <Text style={styles.inputLabel}>Prix (CDF)</Text>
            <TextInput placeholder="500000" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
            <Text style={styles.inputLabel}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.categoryBtn, category === cat && styles.activeCategoryBtn, { marginBottom: 10 }]} onPress={() => setCategory(cat)}>
                  <Text style={[styles.categoryText, category === cat && styles.activeCategoryText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Ville</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={city}
                onValueChange={(itemValue) => setCity(itemValue)}
                style={styles.picker}
              >
                {cities.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
            <Text style={styles.inputLabel}>Images (max 3)</Text>
            <View style={styles.imageButtonsContainer}>
              <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                <Feather name="camera" size={20} color="#6C63FF" />
                <Text style={styles.imageButtonText}>Appareil photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                <Feather name="image" size={20} color="#6C63FF" />
                <Text style={styles.imageButtonText}>Galerie</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.imagePreviewContainer}>
              {images.map((img, i) => (
                <View key={i} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: img }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImages(images.filter((_, index) => index !== i))}>
                    <AntDesign name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 3 && (
                <TouchableOpacity style={styles.addImagePlaceholder} onPress={() => Alert.alert("Ajouter une image", "Choisissez la source", [{ text: "Appareil photo", onPress: takePhoto }, { text: "Galerie", onPress: pickImage }, { text: "Annuler", style: "cancel" }])}>
                  <Feather name="plus" size={24} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
            {loading && uploadProgress !== null && (
              <View>
                <Text style={styles.progressText}>Téléversement... {Math.round(uploadProgress)}%</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            )}
            <TouchableOpacity style={[styles.publishBtn, (loading) && { backgroundColor: '#ccc' }]} onPress={confirmAndPublish} disabled={loading}>
              {loading && uploadProgress === null ? (<Text style={styles.publishBtnText}>Finalisation...</Text>) : loading ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.publishBtnText}>Publier le produit</Text>)}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
    maxHeight: '90%',
    elevation: 10,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginVertical: 10,
  },
  modalContent: {
    paddingTop: 10,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  categoryBtn: {
    backgroundColor: '#eee',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  activeCategoryBtn: {
    backgroundColor: '#6C63FF',
  },
  categoryText: {
    color: '#333',
    fontWeight: '500',
  },
  activeCategoryText: {
    color: '#fff',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 10,
  },
  imageButtonText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 2,
  },
  addImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  progressText: {
    textAlign: 'center',
    color: '#555',
    fontWeight: '500',
    marginBottom: 5,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6C63FF',
  },
  publishBtn: {
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    width: '100%',
  },
});

export default AddProductModal;
