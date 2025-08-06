import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Ionicons } from '@expo/vector-icons';

interface TrackingEvent {
  date: Date;
  status: string;
  message: string;
  location?: string;
}

interface Order {
  id: string;
  tracking: TrackingEvent[];
  status: string;
}

const trackingSteps = [
  { status: 'pending', label: 'Commande confirmée' },
  { status: 'processing', label: 'En préparation' },
  { status: 'shipped', label: 'Expédiée' },
  { status: 'delivered', label: 'Livrée' },
];

export default function TrackingPage() {
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'orders', id as string), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setOrder({
          id: doc.id,
          tracking: data.tracking?.map((event: any) => ({
            ...event,
            date: event.date.toDate()
          })) || [],
          status: data.status
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading || !order) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  const currentStepIndex = trackingSteps.findIndex(step => step.status === order.status);

  return (
    
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text>ID: {id}</Text>
      </View>

      <View style={styles.timeline}>
        {trackingSteps.map((step, index) => (
          <View key={step.status} style={styles.timelineStep}>
            <View style={[
              styles.timelineIcon,
              index <= currentStepIndex ? styles.activeStep : styles.inactiveStep
            ]}>
              <Ionicons 
                name={
                  index === currentStepIndex ? "time" : 
                  index < currentStepIndex ? "checkmark" : "ellipse"
                } 
                size={16} 
                color="#fff" 
              />
            </View>
            <View style={styles.timelineContent}>
              <Text style={[
                styles.timelineTitle,
                index <= currentStepIndex ? styles.activeText : styles.inactiveText
              ]}>
                {step.label}
              </Text>
              {index <= currentStepIndex && order.tracking.find(e => e.status === step.status) && (
                <Text style={styles.timelineDate}>
                  {order.tracking.find(e => e.status === step.status)?.date.toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.events}>
        <Text style={styles.sectionTitle}>Détails du suivi</Text>
        {order.tracking.map((event, index) => (
          <View key={index} style={styles.event}>
            <View style={styles.eventDot} />
            <View style={styles.eventContent}>
              <Text style={styles.eventMessage}>{event.message}</Text>
              <Text style={styles.eventDate}>{event.date.toLocaleString()}</Text>
              {event.location && (
                <Text style={styles.eventLocation}>
                  <Ionicons name="location" size={14} /> {event.location}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timeline: {
    marginBottom: 24,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activeStep: {
    backgroundColor: '#6C63FF',
  },
  inactiveStep: {
    backgroundColor: '#ccc',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  activeText: {
    fontWeight: 'bold',
    color: '#333',
  },
  inactiveText: {
    color: '#999',
  },
  timelineDate: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  events: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  event: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C63FF',
    marginRight: 16,
    marginTop: 6,
  },
  eventContent: {
    flex: 1,
  },
  eventMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#6C63FF',
  },
});