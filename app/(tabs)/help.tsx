// app/(tabs)/help.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface FAQItem {
  question: string;
  answer: string;
}

const HelpScreen = () => {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  

  const toggleItem = (index: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const faqData: FAQItem[] = [
    {
      question: "Comment créer un compte vendeur?",
      answer: "Pour devenir vendeur, rendez-vous dans votre profil et cliquez sur 'Devenir vendeur'. Remplissez le formulaire avec vos informations professionnelles et pièces d'identité. Notre équipe vérifiera votre demande sous 24-48h."
    },
    {
      question: "Comment passer une commande?",
      answer: "Parcourez les produits, ajoutez ceux qui vous intéressent au panier, puis procédez au paiement. Choisissez entre livraison ou retrait en point de collecte."
    },
    {
      question: "Quels sont les modes de paiement acceptés?",
      answer: "Nous acceptons les paiements mobile money (M-Pesa, Airtel Money, Orange Money) ainsi que le paiement en espèces lors du retrait en point de collecte."
    },
    {
      question: "Comment suivre ma commande?",
      answer: "Une fois votre commande confirmée, vous recevrez des notifications sur son statut. Vous pouvez également consulter l'historique de vos commandes dans votre profil."
    },
    {
      question: "Que faire en cas de problème avec une commande?",
      answer: "Contactez-nous immédiatement via le chat ou par téléphone. Notre service client est disponible du lundi au samedi de 8h à 18h."
    },
    {
      question: "Quelle est la politique de retour?",
      answer: "Les retours sont acceptés sous 7 jours pour les articles non ouverts et en parfait état. Les produits alimentaires et périssables ne peuvent être retournés."
    }
  ];

  const contactMethods = [
    {
      icon: 'call-outline',
      title: 'Appeler le support',
      description: 'Du lundi au samedi, 8h-18h',
      action: () => Linking.openURL('tel:+243983627022')
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Chat en direct',
      description: 'Réponse immédiate',
      action: () => router.push('/conv')
    },
    {
      icon: 'mail-outline',
      title: 'Envoyer un email',
      description: 'Réponse sous 24h',
      action: () => Linking.openURL('mailto:contact.yassd@gmail.com')
    },
    {
      icon: 'location-outline',
      title: 'Points de service',
      description: 'Trouver une agence',
      action: () => router.push('/')
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête */}
        <LinearGradient
          colors={['#6E45E2', '#88D3CE']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.headerTitle}>Centre d'aide</Text>
          <Text style={styles.headerSubtitle}>Nous sommes là pour vous aider</Text>
        </LinearGradient>

        {/* Méthodes de contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contactez-nous</Text>
          <View style={styles.contactGrid}>
            {contactMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactCard}
                onPress={method.action}
              >
                <View style={styles.contactIcon}>
                  <Ionicons name={method.icon as any} size={24} color="#6E45E2" />
                </View>
                <Text style={styles.contactTitle}>{method.title}</Text>
                <Text style={styles.contactDescription}>{method.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>
          <View style={styles.faqContainer}>
            {faqData.map((item, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleItem(index)}
                >
                  <Text style={styles.faqQuestionText}>{item.question}</Text>
                  <Ionicons
                    name={expandedItems[index] ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
                {expandedItems[index] && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{item.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations importantes</Text>
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={24} color="#6E45E2" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Heures de service</Text>
              <Text style={styles.infoText}>Lundi - Samedi: 8h00 - 18h00</Text>
              <Text style={styles.infoText}>Dimanche: 10h00 - 14h00</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#6E45E2" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Sécurité des paiements</Text>
              <Text style={styles.infoText}>Tous vos paiements sont cryptés et sécurisés. Nous ne stockons jamais vos informations bancaires.</Text>
            </View>
          </View>
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0</Text>
          <Text style={styles.footerText}>© 2025 YASS DRC App. Tous droits réservés.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contactCard: {
    width: (width - 70) / 2,
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 15,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(110, 69, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  contactDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  faqContainer: {
    marginTop: 10,
  },
  faqItem: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
});

export default HelpScreen;