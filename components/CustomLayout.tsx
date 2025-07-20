// components/CustomLayout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Typage des routes pour TS
const routes: { icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { icon: 'home-outline', route: '/(tabs)/home' },
  { icon: 'heart-outline', route: '/(tabs)/favorites' },
  { icon: 'cart-outline', route: '/(tabs)/cart' },
  { icon: 'person-outline', route: '/(tabs)/profile' },
];

export default function CustomLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    setOpen((prev) => {
      Animated.timing(slideAnim, {
        toValue: prev ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return !prev;
    });
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  // Cacher le menu sur les routes d'authentification
  const isAuthRoute =
    pathname === '/' ||
    pathname.startsWith('/(auth)') ||
    pathname === '/(auth)/login' ||
    pathname === '/(auth)/register';

  return (
    <View style={{ flex: 1 }}>
      <Slot />

      {!isAuthRoute && (
        <>
          <TouchableOpacity style={styles.bar} onPress={toggleMenu}>
            <Text style={styles.barText}>|||</Text>
          </TouchableOpacity>

          {open && (
            <Animated.View style={[styles.menu, { transform: [{ translateX }] }]}>
              {routes.map((item) => {
                const active = pathname === item.route;
                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.iconButton, active && styles.active]}
                    onPress={() => {
                      router.push(item.route as any);
                      toggleMenu();
                    }}
                  >
                    <Ionicons name={item.icon} size={28} color={active ? '#fff' : '#333'} />
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: '40%',
    right: 0,
    width: 20,
    height: 80,
    backgroundColor: '#fb923c',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    zIndex: 10,
  },
  barText: {
    color: '#fff',
    fontWeight: 'bold',
    transform: [{ rotate: '90deg' }],
  },
  menu: {
    position: 'absolute',
    top: '30%',
    right: 30,
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    padding: 8,
    elevation: 5,
    zIndex: 9,
  },
  iconButton: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  active: {
    backgroundColor: '#fb923c',
  },
});
