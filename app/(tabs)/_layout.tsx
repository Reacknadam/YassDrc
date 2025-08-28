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

// Définition du type pour les noms d'icônes
type IconName = keyof typeof Ionicons.glyphMap;
// Type pour les onglets valides
type ValidTab = 'home' | 'help' | 'conv' | 'profile' | 'news' | 'check';

const { width } = Dimensions.get('window');
const TAB_HEIGHT = 70;

export default function TabsLayout() {
  const router = useRouter();
  const { authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ValidTab>('home');
  const [navVisible, setNavVisible] = useState(true);
  const [isSeller, setIsSeller] = useState(false);
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Écoute en temps réel des changements du statut vendeur
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

  // Calcul dynamique du nombre d'onglets et de leur largeur
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

  const toggleNavigation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(translateY, {
      toValue: navVisible ? TAB_HEIGHT : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setNavVisible(!navVisible);
  };

  // Déterminer l'index de chaque onglet en fonction du statut vendeur
  const getTabIndex = (tab: ValidTab): number => {
    const baseTabs = ['home', 'help', 'conv', 'profile'];
    const sellerTabs = ['home', 'help', 'check', 'conv', 'profile'];
    
    const tabsArray = isSeller ? sellerTabs : baseTabs;
    return tabsArray.indexOf(tab);
  };

  return (
    <SafeAreaProvider>
      {/* Bouton toggle pour afficher/cacher la navigation */}
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={toggleNavigation}
      >
        <LinearGradient
          colors={navVisible ? ['#6E45E2', '#88D3CE'] : ['#6E45E2', '#88D3CE']}
          style={styles.toggleGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons 
            name={navVisible ? "chevron-down" : "chevron-up"} 
            size={20} 
            color="#FFF" 
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* Barre de navigation avec animation */}
      <Animated.View style={[
        styles.navContainer, 
        { transform: [{ translateY }] }
      ]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(245,245,245,0.97)']}
          style={styles.navBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Indicateur animé */}
          <Animated.View 
            style={[
              styles.indicator, 
              { 
                transform: [{ translateX: indicatorPosition }],
                width: TAB_WIDTH - 30,
              }
            ]} 
          />
          
          {/* Boutons */}
          <View style={styles.tabsContainer}>
            <NavButton 
              icon="home-outline" 
              activeIcon="home"
              label="Accueil"
              active={activeTab === 'home'}
              onPress={() => handleTabPress('home', getTabIndex('home'))}
            />
            
            <NavButton 
              icon="help-circle-outline" 
              activeIcon="help-circle"
              label="Aide"
              active={activeTab === 'help'}
              onPress={() => handleTabPress('help', getTabIndex('help'))}
            />
            
            {isSeller && (
              <NavButton 
                icon="checkmark-circle-outline" 
                activeIcon="checkmark-circle"
                label="Vérif"
                active={activeTab === 'check'}
                onPress={() => handleTabPress('check', getTabIndex('check'))}
              />
            )}
            
            <NavButton 
              icon="chatbubbles-outline" 
              activeIcon="chatbubbles"
              label="Messages"
              active={activeTab === 'conv'}
              onPress={() => handleTabPress('conv', getTabIndex('conv'))}
            />
            
            <NavButton 
              icon="person-outline" 
              activeIcon="person"
              label="Profil"
              active={activeTab === 'profile'}
              onPress={() => handleTabPress('profile', getTabIndex('profile'))}
            />
          </View>
        </LinearGradient>
      </Animated.View>

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
    </SafeAreaProvider>
  );
}

// Composant de bouton personnalisé
interface NavButtonProps {
  icon: IconName;
  activeIcon?: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}

const NavButton = ({ 
  icon, 
  activeIcon,
  label,
  active, 
  onPress,
}: NavButtonProps) => {
  return (
    <TouchableOpacity 
      style={styles.tabButton}
      onPress={onPress}
    >
      {active ? (
        <LinearGradient
          colors={['#6E45E2', '#88D3CE']}
          style={styles.iconBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons 
            name={activeIcon || icon} 
            size={24} 
            color="#FFF" 
          />
        </LinearGradient>
      ) : (
        <Ionicons 
          name={icon} 
          size={24} 
          color="#888" 
        />
      )}
      <Text style={[styles.label, active && styles.activeLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
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
  toggleButton: {
    position: 'absolute',
    bottom: TAB_HEIGHT + 15,
    right: 20,
    zIndex: 101,
  },
  toggleGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
});