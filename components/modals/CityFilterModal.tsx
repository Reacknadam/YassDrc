import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CityFilterModalProps {
  visible: boolean;
  cities: string[];
  currentCity: string;
  onClose: () => void;
  onSelectCity: (city: string) => void;
}

const CityFilterModal: React.FC<CityFilterModalProps> = ({
  visible,
  cities,
  currentCity,
  onClose,
  onSelectCity,
}) => {
  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onSelectCity(item)}
    >
      <Text style={[styles.itemText, item === currentCity && styles.selectedItemText]}>
        {item}
      </Text>
      {item === currentCity && (
        <Feather name="check" size={24} color="#6C63FF" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choisir une ville</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={cities}
            renderItem={renderItem}
            keyExtractor={(item) => item}
            style={styles.list}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemText: {
    fontSize: 18,
    color: '#555',
  },
  selectedItemText: {
    fontWeight: 'bold',
    color: '#6C63FF',
  },
});

export default CityFilterModal;
