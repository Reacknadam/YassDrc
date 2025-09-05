import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/firebase/config';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Alert } from 'react-native';

const WORKER = 'https://yass-webhook.israelntalu328.workers.dev';

export default function FastgoPayment() {
  const { authUser } = useAuth();
  const { orderId, latitude, longitude } = useLocalSearchParams();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);

  const depositId = `${authUser?.id}_${Date.now()}`;

  const confirmPayment = () => {
    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${WORKER}/check-payment/${depositId}`);
        const data = await res.json();

        if (data.status === 'SUCCESS') {
          clearInterval(interval);

          // ✅ Enregistrer la livraison FASTGO
         await setDoc(doc(db, 'deliveries', orderId as string), {

            orderId,
            sellerId: authUser?.id,
            status: 'pending',
            location: { latitude: Number(latitude), longitude: Number(longitude) },
            createdAt: serverTimestamp(),
          });

          Alert.alert('✅ Paiement réussi', 'Votre livraison FASTGO est en cours...');
          router.replace('/check');
        }
      } catch (err) {
        console.warn('Erreur polling paiement:', err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        Alert.alert('⏱ Délai dépassé', 'Le paiement n’a pas été confirmé.');
        router.replace('/check');
      }
    }, 3000);
  };

  useEffect(() => {
    confirmPayment();
  }, []);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Paiement FASTGO</title>
      </head>
      <body style="margin:0;padding:0;">
        <iframe
          src="${WORKER}/payment-page?depositId=${depositId}&amount=2000&currency=FC"
          width="100%"
          height="100%"
          frameborder="0"
        />
      </body>
    </html>
  `;

  return (
    <WebView
      ref={webviewRef}
      source={{ html: htmlContent }}
      style={{ flex: 1 }}
    />
  );
}