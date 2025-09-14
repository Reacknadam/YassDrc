import React from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Driver } from './OrderCard';

interface DriverModalProps {
  visible: boolean;
  onClose: () => void;
  drivers: Driver[];
  onAssignDriver: (driver: Driver) => void;
  onFocusDriver: (driver: Driver) => void;
}

const DriverModal: React.FC<DriverModalProps> = ({ visible, onClose, drivers, onAssignDriver, onFocusDriver }) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={true}>
      <View style={styles.driverModalContainer}>
        <View style={styles.driverModalContent}>
          <View style={styles.driverModalHeader}>
            <Text style={styles.driverModalTitle}>Livreurs disponibles</Text>
            <TouchableOpacity onPress={onClose} style={styles.driverCloseButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {drivers.length === 0 ? (
            <View style={styles.noDriversContainer}>
              <Ionicons name="car-outline" size={48} color="#CBD5E1" />
              <Text style={styles.noDriversText}>Aucun livreur disponible</Text>
              <Text style={styles.noDriversSubtext}>
                Aucun livreur n'est actuellement disponible dans votre zone.
              </Text>
            </View>
          ) : (
            <FlatList
              data={drivers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.driverItem}>
                  <View style={styles.driverInfo}>
                    <Ionicons name="person-circle" size={40} color="#4F46E5" />
                    <View style={styles.driverDetails}>
                      <Text style={styles.driverName}>{item.name}</Text>
                      <View style={styles.driverDetailRow}>
                        <Ionicons name="call-outline" size={14} color="#64748B" />
                        <Text style={styles.driverPhone}>{item.phoneNumber}</Text>
                      </View>
                      <View style={styles.driverDetailRow}>
                        <Ionicons name="navigate-circle-outline" size={14} color="#10B981" />
                        <Text style={styles.driverDistance}>{item.distance} km de vous</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.driverItemActions}>
                    <TouchableOpacity
                      onPress={() => onFocusDriver(item)}
                      style={styles.focusButton}
                    >
                      <Ionicons name="locate-outline" size={20} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => onAssignDriver(item)}
                    >
                      <Text style={styles.assignButtonText}>Assigner</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  driverModalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  driverModalContent: { backgroundColor: '#FFF', borderRadius: 16, width: '90%', maxHeight: '80%', padding: 20 },
  driverModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  driverModalTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  driverCloseButton: { padding: 4 },
  noDriversContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  noDriversText: { fontSize: 16, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 8 },
  noDriversSubtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  driverItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  driverDetails: { marginLeft: 12 },
  driverName: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  driverPhone: { fontSize: 14, color: '#64748B' },
  driverDetailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  driverDistance: { fontSize: 13, color: '#10B981', fontWeight: '500' },
  driverItemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignButton: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  assignButtonText: { color: '#FFF', fontWeight: '600' },
  focusButton: { padding: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
});

export default DriverModal;
