import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, Timestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import React from 'react';

// URL de votre Cloudflare Worker
const WORKER_URL = 'https://yass-webhook.israelntalu328.workers.dev';

// Définition des types pour la configuration de l'abonnement
interface SubscriptionConfig {
  title: string;
  subtitle: string;
  amount: number;
  priceLabel: string;
  buttonText: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    successColor: string;
    errorColor: string;
    backgroundColor: string;
  };
}

const providerImages: { [key: string]: any } = {
  VODACOM_MPESA_COD: require('../assets/images/vodacom.png'),
  AIRTEL_COD: require('../assets/images/airtel.png'),
  ORANGE_COD: require('../assets/images/orange.png'),
};

const SubscriptionConfirmation = () => {
  const { authUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // 🚀 Nouveau state pour la configuration de l'abonnement
  const [subscriptionConfig, setSubscriptionConfig] = useState<SubscriptionConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const providers = [
    { name: 'M-Pesa', value: 'VODACOM_MPESA_COD' },
    { name: 'Airtel Money', value: 'AIRTEL_COD' },
    { name: 'Orange Money', value: 'ORANGE_COD' },
  ];

  // 🚀 Utilisation de useEffect pour charger la configuration depuis Firestore
  useEffect(() => {
    // 🎯 Le chemin vers le document de configuration. J'ai choisi un chemin 'public' pour que l'application cliente puisse le lire.
    const configDocRef = doc(db, 'public', 'subscription_config');

    // Utilisation de onSnapshot pour des mises à jour en temps réel
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const config = docSnap.data() as SubscriptionConfig;
        setSubscriptionConfig(config);
      } else {
        // En cas d'erreur, on peut définir des valeurs par défaut
        console.error("Le document de configuration d'abonnement n'existe pas.");
        setSubscriptionConfig({
          title: "Abonnement Vendeur",
          subtitle: "Finalisez votre inscription pour devenir vendeur vérifié.",
          amount: 500,
          priceLabel: "Abonnement mensuel",
          buttonText: "Payer",
          theme: {
            primaryColor: '#6C63FF',
            secondaryColor: '#E6E4FF',
            successColor: '#28A745',
            errorColor: '#FF6347',
            backgroundColor: '#f5f5f5',
          }
        });
      }
      setIsConfigLoading(false);
    }, (error) => {
      console.error("Erreur lors de la récupération de la configuration Firestore:", error);
      setSubscriptionConfig({
        title: "Abonnement Vendeur",
        subtitle: "Finalisez votre inscription pour devenir vendeur vérifié.",
        amount: 5000,
        priceLabel: "Abonnement mensuel",
        buttonText: "Payer",
        theme: {
          primaryColor: '#6C63FF',
          secondaryColor: '#E6E4FF',
          successColor: '#28A745',
          errorColor: '#FF6347',
          backgroundColor: '#f5f5f5',
        }
      });
      setIsConfigLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleInitiatePayment = async () => {
    if (!phoneNumber || !selectedProvider) {
      Alert.alert('Erreur', 'Veuillez saisir votre numéro de téléphone et sélectionner un opérateur.');
      return;
    }
    
    if (!authUser?.id) {
      setStatus('error');
      setErrorMessage('Utilisateur non authentifié.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`${WORKER_URL}/initiate-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          provider: selectedProvider,
          amount: subscriptionConfig?.amount || 5000, // 🚀 Utilisation du montant dynamique
          currency: 'CDF',
          userId: authUser.id
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Erreur d'analyse JSON de la réponse:", jsonError);
        data = { error: 'Réponse du serveur non valide ou non-JSON' };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'initialisation du paiement');
      }

      await updateDoc(doc(db, 'users', authUser.id), {
        paymentStatus: 'pending',
        paymentPhoneNumber: phoneNumber,
        selectedProvider: selectedProvider,
      });

      setStatus('pending');
    } catch (error: any) {
      console.error("Erreur d'initialisation du paiement:", error);
      setStatus('error');
      setErrorMessage(error.message || 'Erreur de connexion. Veuillez vérifier votre connexion Internet et réessayer.');
      
      if (authUser?.id) {
        await updateDoc(doc(db, 'users', authUser.id), { 
          paymentStatus: 'failed' 
        });
      }
    }
  };

  // 🚀 Ajout d'un état de chargement initial pour la configuration
  if (isConfigLoading) {
    return (
      <View style={[styles.centeredView, { backgroundColor: '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Chargement de la configuration...</Text>
      </View>
    );
  }

  // Si la configuration n'est pas chargée pour une raison ou une autre, on affiche une erreur
  if (!subscriptionConfig) {
    return (
      <View style={[styles.centeredView, { backgroundColor: '#f5f5f5' }]}>
        <Text style={styles.errorTitle}>Erreur de chargement</Text>
        <Text style={styles.errorText}>Impossible de charger les détails de l'abonnement. Veuillez réessayer.</Text>
      </View>
    );
  }

  // --- Affichages basés sur le statut ---
  if (status === 'pending') {
    return (
      <View style={[styles.centeredView, { backgroundColor: subscriptionConfig.theme.backgroundColor }]}>
        <Image source={require('../assets/images/icon.png')} style={styles.statusImage} />
        <Text style={[styles.title, { color: '#333' }]}>Paiement en attente de confirmation</Text>
        <Text style={styles.text}>Veuillez confirmer la transaction sur la pop-up USSD qui apparaît sur votre téléphone.</Text>
        <Text style={styles.text}>Votre statut de vendeur sera mis à jour une fois la confirmation reçue.</Text>
        <TouchableOpacity style={[styles.returnButton, { backgroundColor: subscriptionConfig.theme.primaryColor }]} onPress={() => router.push('/profile')}>
          <Text style={styles.returnButtonText}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={[styles.centeredView, { backgroundColor: subscriptionConfig.theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={subscriptionConfig.theme.primaryColor} />
        <Text style={styles.loadingText}>Traitement de votre paiement en cours...</Text>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={[styles.centeredView, { backgroundColor: subscriptionConfig.theme.backgroundColor }]}>
        <Image source={require('../assets/images/icon.png')} style={styles.statusImage} />
        <Text style={[styles.successTitle, { color: subscriptionConfig.theme.successColor }]}>Paiement réussi !</Text>
        <Text style={styles.successText}>Félicitations, vous êtes maintenant un vendeur vérifié.</Text>
        <TouchableOpacity style={[styles.returnButton, { backgroundColor: subscriptionConfig.theme.primaryColor }]} onPress={() => router.push('/profile')}>
          <Text style={styles.returnButtonText}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centeredView, { backgroundColor: subscriptionConfig.theme.backgroundColor }]}>
        <Image source={require('../assets/images/icon.png')} style={styles.statusImage} />
        <Text style={[styles.errorTitle, { color: subscriptionConfig.theme.errorColor }]}>Échec du paiement</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={[styles.returnButton, { backgroundColor: subscriptionConfig.theme.primaryColor }]} onPress={() => router.push('/profile')}>
          <Text style={styles.returnButtonText}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    // 🚀 Utilisation de la couleur de fond dynamique
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: subscriptionConfig.theme.backgroundColor }]}>
      <View style={styles.header}>
        {/* 🚀 Utilisation des textes et couleurs dynamiques */}
        <Text style={[styles.title, { color: '#333' }]}>{subscriptionConfig.title}</Text>
        <Text style={styles.subtitle}>{subscriptionConfig.subtitle}</Text>
      </View>

      <View style={styles.priceCard}>
        {/* 🚀 Utilisation du montant et de la couleur dynamique */}
        <Text style={[styles.priceValue, { color: subscriptionConfig.theme.primaryColor }]}>{subscriptionConfig.amount} CDF</Text>
        <Text style={styles.priceLabel}>{subscriptionConfig.priceLabel}</Text>
      </View>
      
      <View style={styles.formContainer}>
        <Text style={styles.formLabel}>Numéro de téléphone</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Ex: 0812345678"
          keyboardType="phone-pad"
        />

        <Text style={styles.formLabel}>Opérateur mobile</Text>
        <View style={styles.providersContainer}>
          {providers.map((p) => (
            <TouchableOpacity
              key={p.value}
              // 🚀 Utilisation des couleurs dynamiques
              style={[
                styles.providerButton, 
                selectedProvider === p.value && { 
                  borderColor: subscriptionConfig.theme.primaryColor,
                  backgroundColor: subscriptionConfig.theme.secondaryColor
                }
              ]}
              onPress={() => setSelectedProvider(p.value)}
            >
              <Image source={providerImages[p.value]} style={styles.providerImage} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.payButton, (!phoneNumber || !selectedProvider) && styles.disabledButton, { backgroundColor: subscriptionConfig.theme.primaryColor }]}
          onPress={handleInitiatePayment} 
          disabled={!phoneNumber || !selectedProvider}
        >
          {/* 🚀 Utilisation du texte du bouton dynamique */}
          <Text style={styles.payButtonText}>{subscriptionConfig.buttonText} {subscriptionConfig.amount} CDF</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  priceCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceValue: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  priceLabel: {
    fontSize: 16,
    color: '#999',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  providersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  providerButton: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#eee',
    marginHorizontal: 5,
    backgroundColor: '#f9f9f9',
  },
  selectedProviderButton: {
    // Les styles dynamiques sont appliqués en ligne
  },
  providerImage: {
    width: 60,
    height: 30,
    resizeMode: 'contain',
  },
  payButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginTop: 10,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginTop: 10,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginTop: 10,
  },
  returnButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 30,
  },
  returnButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  }
});

export default SubscriptionConfirmation;
