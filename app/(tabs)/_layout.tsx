import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;
type ValidTab = 'home' | 'help' | 'conv' | 'profile' | 'news' | 'check';

const { width } = Dimensions.get('window');
const TAB_HEIGHT = 70;

interface NavButtonConfig {
  tab: ValidTab;
  icon: IconName;
  activeIcon: IconName;
  label: string;
}

export default function TabsLayout() {
  const router = useRouter();
  const { isSeller } = useAuth(); // ✅ Remplace tout le useState + onSnapshot
  const [activeTab, setActiveTab] = useState<ValidTab>('home');
  const indicatorPosition = useRef(new Animated.Value(0)).current;

  
  const navButtons: NavButtonConfig[] = [
    { tab: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Accueil' },
   
    ...(isSeller ? [{ tab: 'check' as ValidTab, icon: 'checkmark-circle-outline' as IconName, activeIcon: 'checkmark-circle' as IconName, label: 'Livraison' }] : []),
    
    { tab: 'profile' as ValidTab, icon: 'person-outline' as IconName, activeIcon: 'person' as IconName, label: 'Profil' }
  ];

  const tabCount = navButtons.length;
  const TAB_WIDTH = width / tabCount;

  React.useEffect(() => {
    const currentIndex = navButtons.findIndex(btn => btn.tab === activeTab);
    if (currentIndex !== -1) {
      Animated.spring(indicatorPosition, {
        toValue: currentIndex * TAB_WIDTH,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [navButtons, activeTab, TAB_WIDTH]);

  const handleTabPress = (tab: ValidTab, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    router.replace(`/(tabs)/${tab}` as any);
  };

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarShowLabel: false,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        >
          {navButtons.map(btn => (
            <Tabs.Screen key={btn.tab} name={btn.tab} />
          ))}
        </Tabs>

        <View style={styles.navWrapper}>
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(245,245,245,0.97)']}
            style={styles.navBar}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Animated.View
              style={[
                styles.indicator,
                { transform: [{ translateX: indicatorPosition }], width: TAB_WIDTH - 30 }
              ]}
            />

            <View style={styles.tabsContainer}>
              {navButtons.map((btn, index) => (
                <NavButton
                  key={btn.tab}
                  icon={btn.icon}
                  activeIcon={btn.activeIcon}
                  label={btn.label}
                  active={activeTab === btn.tab}
                  onPress={() => handleTabPress(btn.tab, index)}
                />
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

interface NavButtonProps {
  icon: IconName;
  activeIcon?: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}

const NavButton = ({ icon, activeIcon, label, active, onPress }: NavButtonProps) => (
  <TouchableOpacity style={styles.tabButton} onPress={onPress}>
    {active ? (
      <LinearGradient
        colors={['#6E45E2', '#88D3CE']}
        style={styles.iconBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={activeIcon || icon} size={24} color="#FFF" />
      </LinearGradient>
    ) : (
      <Ionicons name={icon} size={24} color="#888" />
    )}
    <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  navWrapper: {
    width: '100%',
  },
  navBar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    minWidth: 60,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    backgroundColor: '#6E45E2',
    borderRadius: 3,
    left: 15,
  },
  label: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'Inter-Medium',
  },
  activeLabel: {
    color: '#6E45E2',
    fontFamily: 'Inter-SemiBold',
  },
});