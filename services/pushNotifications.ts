// src/lib/push.ts
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Push notifications non disponibles sur simulateur.');
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

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.error('Erreur Critique: projectId absent dans app.json.');
    Alert.alert('Erreur de Configuration', 'Impossible d’enregistrer l’appareil.');
    return;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('🔑 Token Expo Push obtenu :', token);

    /* ------ ID stable ------ */
    let installationId = '';
    if (Platform.OS === 'android') {
      installationId = await Application.getAndroidId();
    } else {
      installationId = await Application.getIosIdForVendorAsync();
    }
    if (!installationId) installationId = `fb-${Date.now()}`;

    const docId = `device_${installationId}`;
    const docRef = doc(db, 'push_tokens', docId);
    const snap = await getDoc(docRef);

    // ✅ Dédoublonnage : on écrit uniquement si le token change
    if (snap.exists() && snap.data().token === token) {
      console.log('✅ Token déjà enregistré (identique)');
    } else {
      await setDoc(
        docRef,
        {
          token,
          createdAt: snap.exists() ? snap.data().createdAt : Timestamp.now(),
          updatedAt: Timestamp.now(),
          platform: Platform.OS,
        },
        { merge: true }
      );
      console.log('✅ Token enregistré / mis à jour');
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du token :", error);
    Alert.alert('Erreur de Notification', 'Une erreur est survenue.');
  }
}