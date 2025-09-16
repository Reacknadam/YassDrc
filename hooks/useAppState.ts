import { useEffect, useState } from 'react';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';

const LOW_BATTERY_THRESHOLD = 0.2;

export interface AppState {
  isOnline: boolean | null;
  batteryLevel: number;
  isBatteryLow: boolean;
}

export const useAppState = (): AppState => {
  const [appState, setAppState] = useState<AppState>({
    isOnline: null,
    batteryLevel: 1,
    isBatteryLow: false,
  });

  useEffect(() => {
    // 1. État réseau
    const unsubscribeNet = NetInfo.addEventListener(state =>
      setAppState(prev => ({
        ...prev,
        isOnline: state.isConnected && state.isInternetReachable !== false,
      }))
    );

    // 2. État batterie initial
    Battery.getBatteryLevelAsync().then(level =>
      setAppState(prev => ({
        ...prev,
        batteryLevel: level,
        isBatteryLow: level < LOW_BATTERY_THRESHOLD,
      }))
    );

    // 3. Changements de batterie
    const batterySub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
      setAppState(prev => ({
        ...prev,
        batteryLevel,
        isBatteryLow: batteryLevel < LOW_BATTERY_THRESHOLD,
      }))
    );

    return () => {
      unsubscribeNet();
      batterySub.remove();
    };
  }, []);

  return appState;
};