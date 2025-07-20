import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert, 
  Platform,
  Linking
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

interface PaymentSettings {
  qrCodeBase64: string;
  phoneNumber: string;
  accountName: string;
  paymentAmount: number;
  paymentInstructions?: string;
}

export default function PayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const requestId = params.requestId as string;
  const amount = params.amount as string;
  const currency = params.currency as string;
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [transactionCode, setTransactionCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userPhone, setUserPhone] = useState('');

  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'paymentSettings', 'config'));
        if (settingsDoc.exists()) {
          setPaymentSettings(settingsDoc.data() as PaymentSettings);
        } else {
          Alert.alert("Erreur", "Configuration de paiement non trouvée");
        }
      } catch (error) {
        console.error("Erreur chargement paramètres paiement:", error);
        Alert.alert("Erreur", "Impossible de charger les infos de paiement");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentSettings();
  }, []);

  const downloadQRCode = async (base64Data: string): Promise<void> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise', 
          'Autorisez l\'accès à votre galerie pour enregistrer le QR Code'
        );
        return;
      }

      const fileName = `YassDrc_QRCode_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('YassDrc', asset, false);

      Alert.alert(
        'QR Code enregistré', 
        'Le QR Code a été sauvegardé dans votre galerie photos'
      );
    } catch (error) {
      console.error('Erreur sauvegarde QR Code:', error);
      Alert.alert('Erreur', 'Échec de l\'enregistrement du QR Code');
    }
  };

  const handlePickPaymentProof = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès à la galerie.");
      return;
    }
    
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    
    if (pickerResult.canceled) return;

    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      setPaymentProof(pickerResult.assets[0].uri);
    }
  };

  const submitPayment = async () => {
    if (!userPhone || !paymentProof) {
      Alert.alert("Erreur", "Veuillez entrer votre numéro et fournir une preuve de paiement");
      return;
    }

    if (!user?.id || !paymentSettings) return;

    setIsSubmitting(true);
    try {
      // Enregistrer le paiement dans Firestore
      await addDoc(collection(db, 'payments'), {
        userId: user.id,
        requestId: requestId,
        amount: amount,
        currency: currency,
        status: 'pending_verification',
        userPhone: userPhone,
        transactionCode: transactionCode,
        paymentProof: paymentProof,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Soumis avec succès',
        'Votre paiement a été soumis pour vérification. Vous serez notifié une fois approuvé.',
        [
          { text: 'OK', onPress: () => router.replace('/profile') }
        ]
      );
    } catch (error) {
      console.error("Erreur soumission paiement:", error);
      Alert.alert("Erreur", "Échec de la soumission du paiement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAirtelMoney = () => {
    if (!paymentSettings) return;
    
    // Ouvrir l'application Airtel Money si installée
    const airtelMoneyUrl = `airtel://app`;
    
    Linking.canOpenURL(airtelMoneyUrl).then(supported => {
      if (supported) {
        Linking.openURL(airtelMoneyUrl);
      } else {
        Alert.alert(
          'Airtel Money non installé',
          'Veuillez installer l\'application Airtel Money pour effectuer le paiement',
          [{ text: 'OK' }]
        );
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement des informations de paiement...</Text>
      </View>
    );
  }

  if (!paymentSettings) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={50} color="#FF6347" />
        <Text style={styles.errorText}>Configuration de paiement non disponible</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#6C63FF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Paiement de vérification</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Pour devenir un vendeur vérifié, effectuez un paiement de {amount} {currency} via Airtel Money.
        </Text>
        
        <View style={styles.paymentMethods}>
          <View style={styles.methodContainer}>
            <Text style={styles.methodTitle}>1. Paiement par QR Code</Text>
            <Image 
              source={{ uri: `data:image/jpeg;base64,${paymentSettings.qrCodeBase64}` }}
              style={styles.qrCode}
            />
            
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={() => downloadQRCode(paymentSettings.qrCodeBase64)}
            >
              <Text style={styles.downloadButtonText}>Télécharger le QR Code</Text>
            </TouchableOpacity>
            
            <Text style={styles.methodDescription}>
              Ouvrez l'application Airtel Money et scannez ce code
            </Text>
          </View>

          <View style={styles.methodContainer}>
            <Text style={styles.methodTitle}>2. Paiement manuel</Text>
            <View style={styles.phonePaymentContainer}>
              <Ionicons name="call-outline" size={24} color="#6C63FF" />
              <Text style={styles.phoneNumber}>{paymentSettings.phoneNumber}</Text>
            </View>
            <Text style={styles.methodDescription}>
              Envoyez {amount} {currency} à ce numéro via Airtel Money
            </Text>
            
            <TouchableOpacity 
              style={styles.openAppButton}
              onPress={openAirtelMoney}
            >
              <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
              <Text style={styles.openAppButtonText}>Ouvrir Airtel Money</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>Vos informations</Text>
        <TextInput
          style={styles.input}
          placeholder="Votre numéro Airtel Money"
          value={userPhone}
          onChangeText={setUserPhone}
          keyboardType="phone-pad"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Code de transaction (optionnel)"
          value={transactionCode}
          onChangeText={setTransactionCode}
        />
        
        <Text style={styles.sectionTitle}>Preuve de paiement</Text>
        <Text style={styles.note}>
          Après paiement, prenez une capture d'écran du SMS ou de l'historique de transaction dans Airtel Money
        </Text>

        {paymentProof ? (
          <View style={styles.proofContainer}>
            <Image source={{ uri: paymentProof }} style={styles.proofImage} />
            <TouchableOpacity 
              style={styles.changeProofButton}
              onPress={handlePickPaymentProof}
            >
              <Text style={styles.changeProofButtonText}>Changer la preuve</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.proofButton}
            onPress={handlePickPaymentProof}
          >
            <Ionicons name="camera-outline" size={24} color="#6C63FF" />
            <Text style={styles.proofButtonText}>Ajouter une preuve de paiement</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={submitPayment}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Soumettre pour vérification</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8F9FA',
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    color: '#6C63FF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6347',
    marginVertical: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  backButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    marginLeft: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  instructions: {
    fontSize: 16,
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 24,
  },
  paymentMethods: {
    marginVertical: 15,
  },
  methodContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  qrCode: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  phonePaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  phoneNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginLeft: 10,
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  note: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  downloadButton: {
    backgroundColor: '#6C63FF',
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  proofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderRadius: 8,
    padding: 15,
    marginVertical: 20,
  },
  proofButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    marginLeft: 10,
  },
  proofContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  proofImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  changeProofButton: {
    marginTop: 10,
  },
  changeProofButtonText: {
    color: '#6C63FF',
    textDecorationLine: 'underline',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  openAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
  },
  openAppButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
});