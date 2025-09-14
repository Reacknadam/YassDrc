import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConnectionStatusBarProps {
  isOnline: boolean | null;
  isBatteryLow: boolean;
}

const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({ isOnline, isBatteryLow }) => {
  if (isOnline !== false && !isBatteryLow) return null;

  return (
    <View style={styles.connectionStatusBar}>
      {isOnline === false && (
        <View style={styles.statusItem}>
          <Ionicons name="cloud-offline" size={16} color="#FFF" />
          <Text style={styles.statusText}>Hors ligne</Text>
        </View>
      )}
      {isBatteryLow && (
        <View style={styles.statusItem}>
          <Ionicons name="battery-dead" size={16} color="#FFF" />
          <Text style={styles.statusText}>Batterie faible</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  connectionStatusBar: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ConnectionStatusBar;
