import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config'; // <-- On importe votre config DB

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(userId: string) {
  if (!userId) {
    console.log("Tentative d'enregistrement du jeton sans userId.");
    return;
  }

  if (!Device.isDevice) {
    console.log('Les notifications Push ne sont supportées que sur des appareils physiques.');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission de notification non accordée.');
    return;
  }
  
  let token;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      throw new Error("Le projectId d'Expo n'est pas trouvé.");
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.error("Erreur lors de l'obtention du jeton Expo", e);
    return;
  }
  
  if (!token) {
      console.log("N'a pas pu obtenir le jeton de notification.");
      return;
  }

  // --- NOUVELLE LOGIQUE ---
  // On écrit directement dans Firestore
  try {
    const tokenDocRef = doc(db, 'push_tokens', userId);
    await setDoc(tokenDocRef, {
      token: token,
      updatedAt: Timestamp.now(),
    });
    console.log(`Jeton enregistré directement dans Firestore pour l'utilisateur ${userId}.`);
  } catch (error) {
    console.error("Erreur lors de l'écriture du jeton dans Firestore:", error);
  }
  // --- FIN DE LA NOUVELLE LOGIQUE ---

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}

// node scripts/send-test-notification.js "all" "Test Final" "Félicitations, ça marche !"