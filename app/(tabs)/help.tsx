import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Platform, 
  ScrollView, 
  TextInput, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function HelpScreen() {
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Nouvel état pour le signalement d'utilisateur
  const [reportedUserId, setReportedUserId] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Fonction pour envoyer un message d'aide via Firestore
  const handleSendMessage = async () => {
    if (!user?.id) {
      Alert.alert("Erreur", "Vous devez être connecté pour envoyer un message.");
      return;
    }
    if (subject.trim() === '' || message.trim() === '') {
      Alert.alert("Erreur", "Le sujet et le message ne peuvent pas être vides.");
      return;
    }

    setLoading(true);

    try {
      // Ajoute le message à une nouvelle collection 'support_messages' dans Firestore
      const supportRef = collection(db, 'support_messages');
      await addDoc(supportRef, {
        subject: subject,
        message: message,
        senderId: user.id,
        senderEmail: user.email,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Succès", "Votre message a bien été envoyé ! Nous vous répondrons dès que possible.");
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error("Erreur lors de l'envoi du message de support :", error);
      Alert.alert("Erreur", "Impossible d'envoyer le message. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour envoyer un signalement d'utilisateur
  const handleReportUser = async () => {
    if (!user?.id) {
      Alert.alert("Erreur", "Vous devez être connecté pour signaler un utilisateur.");
      return;
    }
    if (reportedUserId.trim() === '' || reportReason.trim() === '') {
      Alert.alert("Erreur", "L'identifiant de l'utilisateur et la raison ne peuvent pas être vides.");
      return;
    }

    setReporting(true);

    try {
      // Ajoute le signalement à une nouvelle collection 'user_reports'
      const reportsRef = collection(db, 'user_reports');
      await addDoc(reportsRef, {
        reportedUserId: reportedUserId,
        reportReason: reportReason,
        reporterId: user.id,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Signalement envoyé", "L'utilisateur a été signalé. Merci d'avoir contribué à la sécurité de notre communauté.");
      setReportedUserId('');
      setReportReason('');
    } catch (error) {
      console.error("Erreur lors du signalement de l'utilisateur :", error);
      Alert.alert("Erreur", "Impossible d'envoyer le signalement. Veuillez réessayer.");
    } finally {
      setReporting(false);
    }
  };


  // Fonction pour ouvrir l'application de messagerie de l'utilisateur
  const handleSendEmail = () => {
    const emailAddress = 'support@votresite.com';
    const subjectEmail = 'Problème ou question';
    const bodyEmail = 'Bonjour, \n\nVoici mon message : \n\n';
    const url = `mailto:${emailAddress}?subject=${subjectEmail}&body=${bodyEmail}`;

    Linking.openURL(url).catch(err => console.error("Impossible d'ouvrir l'application d'e-mail", err));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aide et Support</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>Tutoriels & Astuces</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>Créer une nouvelle conversation : Allez dans l'onglet 'Messages' et cliquez sur le bouton "+" pour sélectionner un utilisateur.</Text>
          <View style={styles.separator} />
          <Text style={styles.cardText}>Modifier votre profil : Vous pouvez changer votre nom et photo de profil via les paramètres (à implémenter).</Text>
          <View style={styles.separator} />
          <Text style={styles.cardText}>Gérer vos notifications : Les paramètres de l'application vous permettent d'activer ou de désactiver les notifications de nouveaux messages.</Text>
        </View>

        <Text style={styles.sectionTitle}>Questions Fréquentes</Text>
        <View style={styles.card}>
          <Text style={styles.faqQuestion}>Q: Comment puis-je créer un nouveau chat ?</Text>
          <Text style={styles.faqAnswer}>R: Rendez-vous sur l'onglet "Messages" et utilisez le bouton de création de nouveau chat (à implémenter) ou sélectionnez un contact pour démarrer une conversation.</Text>
          <View style={styles.separator} />
          <Text style={styles.faqQuestion}>Q: Que faire si j'ai un problème technique ?</Text>
          <Text style={styles.faqAnswer}>R: Assurez-vous d'avoir la dernière version de l'application. Si le problème persiste, veuillez nous contacter via le formulaire ci-dessous ou par e-mail.</Text>
        </View>

        <Text style={styles.sectionTitle}>Nous Contacter</Text>
        <View style={styles.contactSection}>
          <Text style={styles.contactIntro}>
            Vous n'avez pas trouvé de réponse ? Envoyez-nous un message directement.
          </Text>
          <TextInput
            style={styles.inputField}
            placeholder="Sujet de votre demande"
            placeholderTextColor="#999"
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.inputField, styles.messageInput]}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Envoyer le message</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Nouvelle section pour le signalement */}
        <Text style={styles.sectionTitle}>Sécurité et Signalement</Text>
        <View style={styles.contactSection}>
          <Text style={styles.contactIntro}>
            Signalez un utilisateur ou un comportement inapproprié.
          </Text>
          <TextInput
            style={styles.inputField}
            placeholder="Identifiant de l'utilisateur à signaler"
            placeholderTextColor="#999"
            value={reportedUserId}
            onChangeText={setReportedUserId}
          />
          <TextInput
            style={[styles.inputField, styles.messageInput]}
            placeholder="Raison du signalement..."
            placeholderTextColor="#999"
            value={reportReason}
            onChangeText={setReportReason}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={[styles.sendButton, styles.reportButton]}
            onPress={handleReportUser}
            disabled={reporting}
          >
            {reporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Signaler cet utilisateur</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.alternativeContact}>
          <Text style={styles.contactIntro}>Ou, contactez-nous par e-mail.</Text>
          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleSendEmail}
          >
            <Ionicons name="mail-outline" size={20} color="#6C63FF" style={{ marginRight: 10 }} />
            <Text style={styles.emailButtonText}>Contacter par E-mail</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8', // Fond plus clair
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb', // Ligne plus fine
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  contactSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  contactIntro: {
    fontSize: 15,
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputField: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  reportButton: {
    backgroundColor: '#ff6b6b', // Couleur rouge pour le bouton de signalement
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alternativeContact: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emailButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 15,
  }
});
