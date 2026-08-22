'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeName = 'ocean' | 'aurora' | 'sunset' | 'forest' | 'midnight';

export interface ThemeConfig {
  id: ThemeName;
  name: string;
  accent: string;
  accentGradient: string;
  glow: string;
  bg: string;
  cardBg: string;
  border: string;
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    accent: '#00F0FF',
    accentGradient: 'linear-gradient(135deg, #00F0FF 0%, #0072FF 100%)',
    glow: 'rgba(0, 240, 255, 0.4)',
    bg: '#060B19',
    cardBg: 'rgba(10, 20, 45, 0.6)',
    border: 'rgba(0, 240, 255, 0.25)',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    accent: '#00FF9D',
    accentGradient: 'linear-gradient(135deg, #00FF9D 0%, #00B8D9 100%)',
    glow: 'rgba(0, 255, 157, 0.4)',
    bg: '#051512',
    cardBg: 'rgba(10, 35, 30, 0.6)',
    border: 'rgba(0, 255, 157, 0.25)',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    accent: '#FF5E7E',
    accentGradient: 'linear-gradient(135deg, #FF5E7E 0%, #FF9F43 100%)',
    glow: 'rgba(255, 94, 126, 0.4)',
    bg: '#1A0C16',
    cardBg: 'rgba(40, 15, 32, 0.6)',
    border: 'rgba(255, 94, 126, 0.25)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    accent: '#39FF14',
    accentGradient: 'linear-gradient(135deg, #39FF14 0%, #00E676 100%)',
    glow: 'rgba(57, 255, 20, 0.4)',
    bg: '#09140A',
    cardBg: 'rgba(15, 35, 18, 0.6)',
    border: 'rgba(57, 255, 20, 0.25)',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    accent: '#A855F7',
    accentGradient: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
    glow: 'rgba(168, 85, 247, 0.4)',
    bg: '#0B071A',
    cardBg: 'rgba(25, 15, 45, 0.6)',
    border: 'rgba(168, 85, 247, 0.25)',
  },
};

interface ThemeContextType {
  activeTheme: ThemeConfig;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  activeTheme: THEMES.ocean,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('ocean');

  const activeTheme = THEMES[currentTheme] || THEMES.ocean;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', activeTheme.accent);
    root.style.setProperty('--theme-gradient', activeTheme.accentGradient);
    root.style.setProperty('--theme-glow', activeTheme.glow);
    root.style.setProperty('--theme-bg', activeTheme.bg);
    root.style.setProperty('--theme-card-bg', activeTheme.cardBg);
    root.style.setProperty('--theme-border', activeTheme.border);
  }, [currentTheme, activeTheme]);

  return (
    <ThemeContext.Provider value={{ activeTheme, setTheme: setCurrentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
