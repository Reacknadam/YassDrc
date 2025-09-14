import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export const useLiveLocation = (enabled: boolean = true) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      return;
    }

    const startWatching = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);

        if (status !== 'granted') {
          setError('Permission de localisation refusée');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);

        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          newLocation => {
            setLocation(newLocation);
          }
        );
      } catch (err) {
        setError("Impossible d'accéder à la localisation");
        console.error('Location error:', err);
      }
    };
    
    startWatching();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, [enabled]);

  return { location, error, permissionStatus };
};
