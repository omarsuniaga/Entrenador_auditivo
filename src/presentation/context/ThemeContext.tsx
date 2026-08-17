/**
 * Presentation Context: ThemeContext
 * Manages Dark / Light mode with persistent storage in localStorage.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'audiofit_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}

    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light', 'light');
      root.classList.remove('theme-dark', 'dark');
      document.body.style.backgroundColor = '#F4F6FB';
      document.body.style.color = '#0F172A';
    } else {
      root.classList.add('theme-dark', 'dark');
      root.classList.remove('theme-light', 'light');
      document.body.style.backgroundColor = '#05070A';
      document.body.style.color = '#E2E8F0';
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
