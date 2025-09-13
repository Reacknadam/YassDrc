import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    card: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    primary: string;
    surface: string;
    muted: string;
  };
};

const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#f5f5f5',
    card: '#ffffff',
    border: '#eeeeee',
    textPrimary: '#333333',
    textSecondary: '#666666',
    primary: '#6C63FF',
    surface: '#f0f0f0',
    muted: '#999999',
  },
};

const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#0f1115',
    card: '#171a21',
    border: '#232733',
    textPrimary: '#eaeef5',
    textSecondary: '#aab2c0',
    primary: '#7c86ff',
    surface: '#1f2430',
    muted: '#7d8596',
  },
};

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = 'app_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') setMode(saved);
      } catch {}
    })();
  }, []);

  const toggleTheme = async () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    try { await AsyncStorage.setItem(THEME_KEY, next); } catch {}
  };

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};


