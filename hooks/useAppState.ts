import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import * as Battery from 'expo-battery';

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
    const checkNetwork = async () => {
      const networkState = await Network.getNetworkStateAsync();
      setAppState(prev => ({
        ...prev,
        isOnline: (networkState.isConnected && networkState.isInternetReachable) ?? false,
      }));
    };

    const checkBattery = async () => {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      setAppState(prev => ({
        ...prev,
        batteryLevel,
        isBatteryLow: batteryLevel < LOW_BATTERY_THRESHOLD,
      }));
    };

    checkNetwork();
    checkBattery();

    const networkSubscription = Network.addNetworkStateListener(checkNetwork);
    const batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setAppState(prev => ({
        ...prev,
        batteryLevel,
        isBatteryLow: batteryLevel < LOW_BATTERY_THRESHOLD,
      }));
    });

    return () => {
      networkSubscription.remove();
      batterySubscription.remove();
    };
  }, []);

  return appState;
};
