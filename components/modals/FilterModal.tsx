import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: { city: string }) => void;
  currentCity: string;
  cities: string[];
  theme: any;
}

const FilterModal: React.FC<FilterModalProps> = ({ visible, onClose, onApply, currentCity, cities, theme }) => {
  const [selectedCity, setSelectedCity] = useState(currentCity);

  const handleApply = () => {
    onApply({ city: selectedCity });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={onClose}>
        <SafeAreaView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <View onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filtrer par ville</Text>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.pickerContainer, { backgroundColor: theme.colors.card }]}>
              <Picker 
                selectedValue={selectedCity} 
                onValueChange={setSelectedCity} 
                style={{ color: theme.colors.text }}
                dropdownIconColor={theme.colors.text}
              >
                {cities.map(c => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
            </View>
            
            <TouchableOpacity style={[styles.applyButton, { backgroundColor: theme.colors.primary }]} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  pickerContainer: { borderRadius: 12, height: 50, justifyContent: 'center', marginBottom: 20 },
  applyButton: { padding: 15, borderRadius: 12, alignItems: 'center' },
  applyButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
