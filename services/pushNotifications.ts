// src/lib/push.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
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
    console.log('❌ Simulateur');
    return;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('❌ Permission refusée');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.manifest2?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('❌ projectId absent');
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  console.log('🔑 Token obtenu :', token);

  // ID unique généré côté Expo (reste stable pour l’appareil)
  const deviceId = `${Platform.OS}-${Constants.deviceId ?? Constants.installationId}`;
  const docId = `device_${deviceId}`;

  await setDoc(doc(db, 'push_tokens', docId), {
    token,
    createdAt: Timestamp.now(),
    platform: Platform.OS,
  });
  console.log('✅ Token enregistré pour device', deviceId);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}