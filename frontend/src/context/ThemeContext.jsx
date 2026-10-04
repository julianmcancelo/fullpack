import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Explicitly default to Light Mode ('light' / false)
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('ml_manager_theme');
      if (saved === 'dark') return true;
      return false; // Default is Light Mode
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ml_manager_theme', isDark ? 'dark' : 'light');
      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    } catch (e) {
      console.error('Error applying theme:', e);
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);
  const setLightMode = () => setIsDark(false);
  const setDarkMode = () => setIsDark(true);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setLightMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
