import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Order } from './OrderCard'; // Assuming Order type is exported from OrderCard

const WORKER_URL = 'https://yass-webhook.israelntalu328.workers.dev';
const API_RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 3000;

interface PaymentWorkerResponse {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  amount: number;
  currency: 'CDF';
  transactionId?: string;
}

const handleError = (error: unknown, message: string, userMessage?: string) => {
  console.error(message, error);
  Alert.alert('Erreur', userMessage || message);
};

const retryFetch = async <T,>(
  url: string,
  options?: RequestInit,
  retries = API_RETRY_COUNT
): Promise<T> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      if (response.status >= 500 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
        return retryFetch(url, options, retries - 1);
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      return retryFetch(url, options, retries - 1);
    }
    throw error;
  }
};

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  order: Order;
  onPaymentSuccess: () => void;
  onPaymentFailure: (error: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ visible, onClose, order, onPaymentSuccess, onPaymentFailure }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || !order.sellerDepositId) return;

    const initializePayment = async () => {
      setIsLoading(true);
      try {
        const response = await retryFetch<{ html: string }>(
          `${WORKER_URL}/payment-page?amount=1500&currency=CDF`
        );
        setHtmlContent(response.html);
      } catch (error) {
        handleError(
          error,
          'Payment initialization failed',
          "Impossible d'initialiser le paiement. Veuillez réessayer."
        );
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [visible, order]);

  useEffect(() => {
    if (!visible || !order.sellerDepositId) return;

    const pollPaymentStatus = async (attempts: number = API_RETRY_COUNT) => {
      try {
        const result = await retryFetch<PaymentWorkerResponse>(
          `${WORKER_URL}/check-payment/${order.sellerDepositId}`
        );

        if (result.status === 'SUCCESS') {
          onPaymentSuccess();
          onClose();
          return;
        } else if (result.status === 'FAILURE') {
          onPaymentFailure('Le paiement a échoué');
          onClose();
          return;
        }

        if (attempts > 0) {
          pollRef.current = setTimeout(
            () => pollPaymentStatus(attempts - 1),
            5000
          ) as unknown as number;
        } else {
          onPaymentFailure('Temps de paiement dépassé');
          onClose();
        }
      } catch (error) {
        console.error('Payment polling error:', error);
        if (attempts > 0) {
          pollRef.current = setTimeout(
            () => pollPaymentStatus(attempts - 1),
            5000
          ) as unknown as number;
        } else {
          onPaymentFailure('Erreur de vérification du paiement');
          onClose();
        }
      }
    };

    pollPaymentStatus();

    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
      }
    };
  }, [visible, order, onPaymentSuccess, onPaymentFailure, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Paiement de la course</Text>
          <View style={{ width: 28 }} />
        </View>

        {isLoading ? (
          <View style={styles.paymentLoadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.paymentLoadingText}>Préparation du paiement...</Text>
          </View>
        ) : (
          <WebView
            source={{ html: htmlContent }}
            style={styles.webview}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.paymentLoadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.paymentLoadingText}>Chargement de la page de paiement...</Text>
              </View>
            )}
            onError={syntheticEvent => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error: ', nativeEvent);
              handleError(
                nativeEvent,
                'WebView error',
                'Erreur de chargement de la page de paiement'
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  closeButton: { padding: 4 },
  paymentLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  paymentLoadingText: { marginTop: 16, fontSize: 16, color: '#64748B', textAlign: 'center' },
  webview: { flex: 1 },
});

export default PaymentModal;
