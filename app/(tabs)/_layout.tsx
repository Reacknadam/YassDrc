// app/(tabs)/_layout.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  Text
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

type IconName = keyof typeof Ionicons.glyphMap;
type ValidTab = 'home' | 'help' | 'conv' | 'profile' | 'news' | 'check';

const { width } = Dimensions.get('window');
const TAB_HEIGHT = 70;

export default function TabsLayout() {
  const router = useRouter();
  const { authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ValidTab>('home');
  const [isSeller, setIsSeller] = useState(false);
  const indicatorPosition = useRef(new Animated.Value(0)).current;

  // Écoute en temps réel du statut vendeur
  useEffect(() => {
    if (!authUser?.id) return;
    const userRef = doc(db, 'users', authUser.id);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsSeller(userData.isSellerVerified || false);
      }
    });
    return () => unsubscribe();
  }, [authUser?.id]);

  const tabCount = isSeller ? 5 : 4;
  const TAB_WIDTH = width / tabCount;

  const handleTabPress = (tab: ValidTab, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    router.replace(`/(tabs)/${tab}` as any);
    
    Animated.spring(indicatorPosition, {
      toValue: index * TAB_WIDTH,
      damping: 15,
      stiffness: 100,
      useNativeDriver: true,
    }).start();
  };

  const getTabIndex = (tab: ValidTab): number => {
    const baseTabs = ['home', 'help', 'conv', 'profile'];
    const sellerTabs = ['home', 'help', 'check', 'conv', 'profile'];
    const tabsArray = isSeller ? sellerTabs : baseTabs;
    return tabsArray.indexOf(tab);
  };

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* Composant Tabs */}
        <Tabs
          screenOptions={{
            tabBarShowLabel: false,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        >
          <Tabs.Screen name="home" />
          <Tabs.Screen name="help" />
          <Tabs.Screen name="conv" />
          <Tabs.Screen name="profile" />
          <Tabs.Screen name="news" />
          <Tabs.Screen name="check" />
        </Tabs>

        {/* Barre de navigation en bas */}
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
              <NavButton 
                icon="home-outline" 
                activeIcon="home"
                label="Accueil"
                active={activeTab === 'home'}
                onPress={() => handleTabPress('home', getTabIndex('home'))}
              />
              
            
              
              {isSeller && (
                <NavButton 
                  icon="checkmark-circle-outline" 
                  activeIcon="checkmark-circle"
                  label="Livraison"
                  active={activeTab === 'check'}
                  onPress={() => handleTabPress('check', getTabIndex('check'))}
                />
              )}
       

              
              <NavButton 
                icon="person-outline" 
                activeIcon="person"
                label="Profil"
                active={activeTab === 'profile'}
                onPress={() => handleTabPress('profile', getTabIndex('profile'))}
              />
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
    // Remplacement de absolute par normal flow
    width: '100%',
  },
  navBar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
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
